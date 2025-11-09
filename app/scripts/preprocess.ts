#!/usr/bin/env ts-node
/**
 * Preprocessing Script - Generates level1, level2, level3 mp3 files from stems
 * 
 * Usage: ts-node preprocess.ts
 * 
 * Expects:
 * - CSV at: ../backend/spotify_playlist_tracks.csv
 * - Stems at: ../backend/separated/<Song_Name>/{drums,guitar,bass,piano,vocals,other}.mp3
 * 
 * Generates:
 * - ../backend/preprocessed/<Song_Name>/{level1,level2,level3}.mp3
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
 * Sanitize song name for filesystem use (only replace truly invalid characters)
 */
function sanitizeSongName(songName: string): string {
  // Only replace characters that are invalid in Windows filesystem
  return songName
    .replace(/[<>:"|?*]/g, '_') // Replace invalid chars
    .trim();
}

/**
 * Convert song name to match folder naming convention
 * - Apostrophes (') -> underscores (_)
 * - Question marks (?) -> hash (#)
 * - Colons (:) -> hash (#)
 * - Double quotes (") -> hash (#)
 */
function convertToFolderName(songName: string): string {
  return songName
    .replace(/"/g, '#')  // Double quotes to hash
    .replace(/'/g, '_')   // Apostrophes to underscores
    .replace(/\?/g, '#')  // Question marks to hash
    .replace(/:/g, '#');  // Colons to hash
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
 * Check if all required stems exist for a song
 */
function checkStemsExist(songFolder: string): { exists: boolean; missing: string[] } {
  const requiredStems = ['drums.mp3', 'bass.mp3', 'guitar.mp3', 'piano.mp3', 'vocals.mp3', 'other.mp3'];
  const missing: string[] = [];
  
  for (const stem of requiredStems) {
    if (!fs.existsSync(path.join(songFolder, stem))) {
      missing.push(stem);
    }
  }
  
  return {
    exists: missing.length === 0,
    missing
  };
}

/**
 * Process a single song
 * @returns true if song was processed, false if skipped (already exists)
 */
async function processSong(songName: string): Promise<boolean> {
  // Convert apostrophes to underscores to match folder naming convention
  const folderName = convertToFolderName(songName);
  const separatedFolder = path.join(SEPARATED_PATH, folderName);
  const sanitizedName = sanitizeSongName(songName);
  const preprocessedFolder = path.join(PREPROCESSED_PATH, sanitizedName);
  
  const level1Path = path.join(preprocessedFolder, 'level1.mp3');
  const level2Path = path.join(preprocessedFolder, 'level2.mp3');
  const level3Path = path.join(preprocessedFolder, 'level3.mp3');
  
  // Check if all preprocessed files already exist
  if (fs.existsSync(level1Path) && fs.existsSync(level2Path) && fs.existsSync(level3Path)) {
    console.log(`  ⏭️  Skipping: Already preprocessed`);
    return false;
  }
  
  // Check if separated folder exists
  if (!fs.existsSync(separatedFolder)) {
    throw new Error(`Separated folder not found: ${separatedFolder}`);
  }
  
  // Check if all stems exist
  const stemCheck = checkStemsExist(separatedFolder);
  if (!stemCheck.exists) {
    throw new Error(`Missing stems in ${separatedFolder}: ${stemCheck.missing.join(', ')}`);
  }
  
  // Create preprocessed folder
  if (!fs.existsSync(preprocessedFolder)) {
    fs.mkdirSync(preprocessedFolder, { recursive: true });
  }
  
  // Level 1: Mix drums + bass
  console.log(`  - Creating level1 (drums + bass)...`);
  await runFFmpeg([
    '-y',
    '-i', path.join(separatedFolder, 'drums.mp3'),
    '-i', path.join(separatedFolder, 'bass.mp3'),
    '-filter_complex', 'amix=inputs=2:duration=first:dropout_transition=0',
    '-c:a', 'libmp3lame',
    '-qscale:a', '4',
    level1Path
  ]);
  
  // Level 2: Mix drums + bass + guitar + piano
  console.log(`  - Creating level2 (drums + bass + guitar + piano)...`);
  await runFFmpeg([
    '-y',
    '-i', path.join(separatedFolder, 'drums.mp3'),
    '-i', path.join(separatedFolder, 'bass.mp3'),
    '-i', path.join(separatedFolder, 'guitar.mp3'),
    '-i', path.join(separatedFolder, 'piano.mp3'),
    '-filter_complex', 'amix=inputs=4:duration=first:dropout_transition=0',
    '-c:a', 'libmp3lame',
    '-qscale:a', '4',
    level2Path
  ]);
  
  // Level 3: Mix everything (drums + bass + guitar + piano + vocals + other)
  console.log(`  - Creating level3 (full mix: drums + bass + guitar + piano + vocals + other)...`);
  await runFFmpeg([
    '-y',
    '-i', path.join(separatedFolder, 'drums.mp3'),
    '-i', path.join(separatedFolder, 'bass.mp3'),
    '-i', path.join(separatedFolder, 'guitar.mp3'),
    '-i', path.join(separatedFolder, 'piano.mp3'),
    '-i', path.join(separatedFolder, 'vocals.mp3'),
    '-i', path.join(separatedFolder, 'other.mp3'),
    '-filter_complex', 'amix=inputs=6:duration=first:dropout_transition=0',
    '-c:a', 'libmp3lame',
    '-qscale:a', '4',
    level3Path
  ]);
  
  console.log(`  ✅ Completed preprocessing`);
  return true;
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
    console.error('Please ensure the "separated" folder exists with stem files.');
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
  let skipCount = 0;
  let failCount = 0;
  
  for (let i = 0; i < songs.length; i++) {
    const song = songs[i];
    const songName = song.Song_Name.trim();
    const artists = song.Artists.trim();
    
    console.log(`[${i + 1}/${songs.length}] Processing: ${songName}`);
    
    try {
      // Use exact Song_Name from CSV (folder name should match exactly)
      const wasProcessed = await processSong(songName);
      
      const sanitizedName = sanitizeSongName(songName);
      const releaseYear = parseFloat(song.Release);
      const decade = Math.floor(releaseYear / 10) * 10;
      
      processedSongs.push({
        name: songName,
        artists: artists,
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
      
      if (wasProcessed) {
        successCount++;
      } else {
        skipCount++;
      }
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
  console.log(`   Processed: ${successCount} songs`);
  console.log(`   Skipped (already exists): ${skipCount} songs`);
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
