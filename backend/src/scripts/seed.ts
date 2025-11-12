#!/usr/bin/env ts-node
/**
 * Database Seeding Script
 * 
 * Usage: npm run seed
 * 
 * Reads spotify_playlist_tracks.csv and populates MongoDB
 */

import mongoose from 'mongoose';
import * as fs from 'fs';
import * as path from 'path';
import csv from 'csv-parser';
import dotenv from 'dotenv';
import Song from '../models/Song';

// Load environment variables from backend
dotenv.config({ path: path.join(__dirname, '../../.env') });

const CSV_PATH = path.join(__dirname, '../../spotify_playlist_tracks.csv');

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

/**
 * Sanitize song name for filesystem use (only replace truly invalid characters)
 * Matches the logic from preprocess.ts
 */
function sanitizeSongName(songName: string): string {
  // Only replace characters that are invalid in Windows filesystem
  return songName
    .replace(/[<>:"|?*]/g, '_') // Replace invalid chars
    .trim();
}

/**
 * Generate preprocessed paths for a song
 * Matches the logic from preprocess.ts
 */
function generatePreprocessedPaths(songName: string): { level1: string; level2: string; level3: string } {
  const sanitizedName = sanitizeSongName(songName);
  return {
    level1: `/preprocessed/${sanitizedName}/level1.mp3`,
    level2: `/preprocessed/${sanitizedName}/level2.mp3`,
    level3: `/preprocessed/${sanitizedName}/level3.mp3`
  };
}

async function seedDatabase() {
  try {
    console.log('🌱 Starting database seed...\n');
    
    // Check if CSV file exists
    if (!fs.existsSync(CSV_PATH)) {
      console.error(`❌ CSV file not found: ${CSV_PATH}`);
      process.exit(1);
    }
    
    // Connect to MongoDB
    const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/guess-the-song';
    console.log(`📡 Connecting to MongoDB: ${MONGODB_URI}`);
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');
    
    // Read and parse CSV
    console.log('📖 Reading CSV file...');
    const songs: SongRow[] = [];
    await new Promise<void>((resolve, reject) => {
      fs.createReadStream(CSV_PATH)
        .pipe(csv())
        .on('data', (row: SongRow) => {
          // Filter out empty rows
          if (row.Song_Name && row.Song_Name.trim()) {
            songs.push(row);
          }
        })
        .on('end', () => resolve())
        .on('error', (err: Error) => reject(err));
    });
    
    console.log(`📊 Found ${songs.length} songs in CSV\n`);
    
    // Convert CSV rows to PreprocessedSong format
    const songsData: PreprocessedSong[] = songs.map((song) => {
      const songName = song.Song_Name.trim();
      const artists = song.Artists.trim();
      const releaseYear = parseFloat(song.Release);
      const decade = Math.floor(releaseYear / 10) * 10;
      // Handle ViewCount with spaces and commas
      const viewcount = parseInt(song.ViewCount.replace(/[,\s]/g, '').trim());
      
      return {
        name: songName,
        artists: artists,
        youtube_link: song.YouTube_Link.trim(),
        viewcount: viewcount,
        release_year: releaseYear,
        decade: decade,
        preprocessed: generatePreprocessedPaths(songName)
      };
    });
    
    // Clear existing songs (optional - comment out if you want to keep existing)
    const existingCount = await Song.countDocuments();
    if (existingCount > 0) {
      console.log(`⚠️  Found ${existingCount} existing songs. Clearing...`);
      await Song.deleteMany({});
      console.log('✅ Cleared existing songs\n');
    }
    
    // Insert songs
    console.log('📥 Inserting songs...');
    let insertedCount = 0;
    let failedCount = 0;
    
    for (const songData of songsData) {
      try {
        await Song.create(songData);
        insertedCount++;
        if (insertedCount % 10 === 0) {
          console.log(`   Inserted ${insertedCount}/${songsData.length}...`);
        }
      } catch (error: any) {
        console.error(`   ❌ Failed to insert "${songData.name}": ${error.message}`);
        failedCount++;
      }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ Database seeding complete!');
    console.log(`   Inserted: ${insertedCount} songs`);
    console.log(`   Failed: ${failedCount} songs`);
    console.log('='.repeat(60));
    
    // Show some stats
    const totalSongs = await Song.countDocuments();
    const decades = await Song.distinct('decade');
    console.log(`\n📊 Database Stats:`);
    console.log(`   Total Songs: ${totalSongs}`);
    console.log(`   Decades: ${decades.sort().join(', ')}`);
    
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\n👋 Disconnected from MongoDB');
  }
}

// Run if executed directly
if (require.main === module) {
  seedDatabase();
}

