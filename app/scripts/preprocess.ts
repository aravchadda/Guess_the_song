#!/usr/bin/env ts-node
/**
 * Preprocessing Script - Generates level1, level2, level3 mp3 files from stems
 * 
 * Usage: ts-node preprocess.ts
 * 
 * Expects:
 * - CSV at: ../../getting_the_data/spotify_playlist_tracks.csv
 * - Stems at: ../../separated/<Song_Name>/{drums,guitar,bass,piano,vocals}.mp3
 * 
 * Generates:
 * - ../../preprocessed/<Song_Name>/{level1,level2,level3}.mp3
 * - ./preprocessed_songs.json (metadata for seeding)
 */

import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import csv from 'csv-parser';

interface SongRow {
  Song_Name: string;
  Artists: string;
  YouTube_Link: string;
  ViewCount: string;
  Release: string;
}

interface PreprocessedSong {
  name: string;
  artists: string;
  youtube_link: string;
  viewcount: number;
  release_year: number;
  decade: number;
  preprocessed: {
    level1: string;
    level2: string;
    level3: string;
  };
}

// Paths
const PROJECT_ROOT = path.join(__dirname, '..');
const CSV_PATH = path.join(PROJECT_ROOT, 'backend/spotify_playlist_tracks.csv');
const SEPARATED_PATH = path.join(PROJECT_ROOT, 'backend/separated');
const PREPROCESSED_PATH = path.join(PROJECT_ROOT, 'backend/preprocessed');
const OUTPUT_JSON = path.join(__dirname, 'preprocessed_songs.json');

/**
 * Sanitize song name for filesystem use (matches YouTube video title format)
 */
function sanitizeSongName(songName: string): string {
  return songName
    .replace(/[<>:"|?*]/g, '_') // Replace invalid chars
    .replace(/[^\w\s-]/g, '') // Remove non-alphanumeric except spaces, hyphens, underscores
    .replace(/\s+/g, '_') // Replace spaces with underscores
    .trim();
}

/**
 * Find the actual folder name for a song by fuzzy matching
 */
function findSongFolder(songName: string, artists: string, separatedPath: string): string | null {
  const availableFolders = fs.readdirSync(separatedPath);
  
  // Clean the song name and artists for matching
  const cleanSong = songName.toLowerCase().replace(/[^\w\s]/g, '').trim();
  const cleanArtists = artists.toLowerCase().replace(/[^\w\s]/g, '').trim();
  
  // Try to find a folder that contains the song name or artist
  for (const folder of availableFolders) {
    const folderLower = folder.toLowerCase();
    
    // Check if folder name contains significant parts of the song name
    const songWords = cleanSong.split(/\s+/).filter(w => w.length > 2); // Skip short words
    const matchingWords = songWords.filter(word => folderLower.includes(word));
    
    // If most of the song name words are in the folder, it's likely a match
    if (matchingWords.length >= Math.min(2, songWords.length)) {
      return folder;
    }
    
    // Also check for artist name
    const artistWords = cleanArtists.split(/\s+/).filter(w => w.length > 2);
    const matchingArtists = artistWords.filter(word => folderLower.includes(word));
    
    if (matchingArtists.length > 0 && matchingWords.length > 0) {
      return folder;
    }
  }
  
  return null;
}

/**
 * Run ffmpeg command
 */
function runFFmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', args);
    
    let stderr = '';
    ffmpeg.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    ffmpeg.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`FFmpeg failed with code ${code}: ${stderr}`));
      }
    });
    
    ffmpeg.on('error', (err) => {
      reject(new Error(`Failed to spawn ffmpeg: ${err.message}`));
    });
  });
}

/**
 * Check if all stems exist for a song
 */
function checkStemsExist(songFolder: string): boolean {
  const stems = ['drums.mp3', 'guitar.mp3', 'bass.mp3', 'piano.mp3', 'vocals.mp3'];
  return stems.every(stem => fs.existsSync(path.join(songFolder, stem)));
}

/**
 * Process a single song
 */
async function processSong(songName: string, actualFolderName: string): Promise<void> {
  const sanitizedName = sanitizeSongName(songName);
  const separatedFolder = path.join(SEPARATED_PATH, actualFolderName);
  const preprocessedFolder = path.join(PREPROCESSED_PATH, sanitizedName);
  
  // Check if stems exist
  if (!fs.existsSync(separatedFolder)) {
    throw new Error(`Separated folder not found: ${separatedFolder}`);
  }
  
  if (!checkStemsExist(separatedFolder)) {
    throw new Error(`Missing stems in: ${separatedFolder}`);
  }
  
  // Create preprocessed folder
  if (!fs.existsSync(preprocessedFolder)) {
    fs.mkdirSync(preprocessedFolder, { recursive: true });
  }
  
  const level1Path = path.join(preprocessedFolder, 'level1.mp3');
  const level2Path = path.join(preprocessedFolder, 'level2.mp3');
  const level3Path = path.join(preprocessedFolder, 'level3.mp3');
  
  // Level 1: Copy drums
  console.log(`  - Creating level1 (drums only)...`);
  fs.copyFileSync(
    path.join(separatedFolder, 'drums.mp3'),
    level1Path
  );
  
  // Level 2: Mix drums + guitar + bass + piano
  console.log(`  - Creating level2 (drums+guitar+bass+piano)...`);
  await runFFmpeg([
    '-y',
    '-i', path.join(separatedFolder, 'drums.mp3'),
    '-i', path.join(separatedFolder, 'guitar.mp3'),
    '-i', path.join(separatedFolder, 'bass.mp3'),
    '-i', path.join(separatedFolder, 'piano.mp3'),
    '-filter_complex', 'amix=inputs=4:duration=first:dropout_transition=0',
    '-c:a', 'libmp3lame',
    '-qscale:a', '4',
    level2Path
  ]);
  
  // Level 3: Mix all including vocals
  console.log(`  - Creating level3 (full mix)...`);
  await runFFmpeg([
    '-y',
    '-i', path.join(separatedFolder, 'drums.mp3'),
    '-i', path.join(separatedFolder, 'guitar.mp3'),
    '-i', path.join(separatedFolder, 'bass.mp3'),
    '-i', path.join(separatedFolder, 'piano.mp3'),
    '-i', path.join(separatedFolder, 'vocals.mp3'),
    '-filter_complex', 'amix=inputs=5:duration=first:dropout_transition=0',
    '-c:a', 'libmp3lame',
    '-qscale:a', '4',
    level3Path
  ]);
  
  console.log(`  ✅ Completed preprocessing`);
}

/**
 * Read CSV and process all songs
 */
async function main() {
  console.log('🎵 Starting preprocessing pipeline...\n');
  
  // Check if CSV exists
  if (!fs.existsSync(CSV_PATH)) {
    console.error(`❌ CSV not found: ${CSV_PATH}`);
    process.exit(1);
  }
  
  // Check if separated folder exists
  if (!fs.existsSync(SEPARATED_PATH)) {
    console.error(`❌ Separated folder not found: ${SEPARATED_PATH}`);
    console.error('Please create the "separated" folder with stem files.');
    console.error('Expected: C:\\Users\\dell\\Desktop\\Guess_the_song\\app\\backend\\separated');
    process.exit(1);
  }
  
  // Create preprocessed folder
  if (!fs.existsSync(PREPROCESSED_PATH)) {
    fs.mkdirSync(PREPROCESSED_PATH, { recursive: true });
  }
  
  // Read and parse CSV
  const songs: SongRow[] = [];
  await new Promise<void>((resolve, reject) => {
    fs.createReadStream(CSV_PATH)
      .pipe(csv())
      .on('data', (row: SongRow) => songs.push(row))
      .on('end', () => resolve())
      .on('error', (err: Error) => reject(err));
  });
  
  console.log(`📊 Found ${songs.length} songs in CSV\n`);
  
  // Process each song
  const processedSongs: PreprocessedSong[] = [];
  let successCount = 0;
  let failCount = 0;
  
  for (let i = 0; i < songs.length; i++) {
    const song = songs[i];
    const songName = song.Song_Name.trim();
    const artists = song.Artists.trim();
    
    console.log(`[${i + 1}/${songs.length}] Processing: ${songName}`);
    
    try {
      // Find the actual folder name using fuzzy matching
      const actualFolderName = findSongFolder(songName, artists, SEPARATED_PATH);
      
      if (!actualFolderName) {
        console.log(`  ⏭️  Skipping: No matching folder found`);
        failCount++;
        console.log('');
        continue;
      }
      
      console.log(`  📁 Found folder: ${actualFolderName}`);
      await processSong(songName, actualFolderName);
      
      const sanitizedName = sanitizeSongName(songName);
      const releaseYear = parseFloat(song.Release);
      const decade = Math.floor(releaseYear / 10) * 10;
      
      processedSongs.push({
        name: songName,
        artists: song.Artists.trim(),
        youtube_link: song.YouTube_Link.trim(),
        viewcount: parseInt(song.ViewCount),
        release_year: releaseYear,
        decade: decade,
        preprocessed: {
          level1: `/preprocessed/${sanitizedName}/level1.mp3`,
          level2: `/preprocessed/${sanitizedName}/level2.mp3`,
          level3: `/preprocessed/${sanitizedName}/level3.mp3`
        }
      });
      
      successCount++;
    } catch (error: any) {
      console.error(`  ❌ Failed: ${error.message}`);
      failCount++;
    }
    
    console.log('');
  }
  
  // Save processed songs to JSON
  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(processedSongs, null, 2));
  
  console.log('\n' + '='.repeat(60));
  console.log(`✅ Preprocessing complete!`);
  console.log(`   Success: ${successCount} songs`);
  console.log(`   Failed: ${failCount} songs`);
  console.log(`   Output: ${OUTPUT_JSON}`);
  console.log('='.repeat(60));
}

// Run if executed directly
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

