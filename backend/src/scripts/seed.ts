#!/usr/bin/env ts-node
/**
 * Database Seeding Script
 *
 * Usage: npm run seed
 *
 * Reads getting_the_data/combined_songs_with_links.csv and populates MongoDB.
 * Each row's ID (e.g. "0001") maps directly to backend/preprocessed/<ID>/,
 * which holds level1.mp3 (drums only), level2.mp3 (vocals removed),
 * level3.mp3 (full mix) - built by the Kaggle notebooks in getting_the_data/.
 */

import mongoose from 'mongoose';
import * as fs from 'fs';
import * as path from 'path';
import csv from 'csv-parser';
import dotenv from 'dotenv';
import Song from '../models/Song';

// Load environment variables from the single project-root .env
dotenv.config({ path: path.join(__dirname, '../../../.env') });

const CSV_PATH = path.join(__dirname, '../../../getting_the_data/combined_songs_with_links.csv');

interface SongRow {
  ID: string;
  Song: string;
  Artist: string;
  Year: string;
  Weeks_in_Charts: string;
  Rank: string;
  YouTube_Link: string;
  ViewCount: string;
}

interface SongData {
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
 * Every row's ID maps directly to backend/preprocessed/<ID>/level{1,2,3}.mp3.
 */
function generatePreprocessedPaths(id: string): { level1: string; level2: string; level3: string } {
  return {
    level1: `/preprocessed/${id}/level1.mp3`,
    level2: `/preprocessed/${id}/level2.mp3`,
    level3: `/preprocessed/${id}/level3.mp3`
  };
}

async function seedDatabase() {
  try {
    console.log('🌱 Starting database seed...\n');

    if (!fs.existsSync(CSV_PATH)) {
      console.error(`❌ CSV file not found: ${CSV_PATH}`);
      process.exit(1);
    }

    const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/guess-the-song';
    console.log(`📡 Connecting to MongoDB...`);
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    console.log('📖 Reading CSV file...');
    const rows: SongRow[] = [];
    await new Promise<void>((resolve, reject) => {
      fs.createReadStream(CSV_PATH)
        .pipe(csv())
        .on('data', (row: SongRow) => {
          if (row.ID && row.Song && row.Song.trim()) {
            rows.push(row);
          }
        })
        .on('end', () => resolve())
        .on('error', (err: Error) => reject(err));
    });

    console.log(`📊 Found ${rows.length} songs in CSV\n`);

    const preprocessedDir = path.join(__dirname, '../../preprocessed');
    const songsData: SongData[] = [];
    const missingAudio: string[] = [];

    for (const row of rows) {
      const id = row.ID.trim();
      const name = row.Song.trim();
      const artists = row.Artist.trim();
      const releaseYear = parseInt(row.Year, 10);
      const decade = Math.floor(releaseYear / 10) * 10;
      const viewcount = parseInt(row.ViewCount, 10) || 0;
      const preprocessed = generatePreprocessedPaths(id);

      // Verify all three levels actually exist on disk before seeding this
      // song - catches a mismatched/incomplete preprocessed/ folder early
      // rather than shipping a song that 404s in the game.
      const songDir = path.join(preprocessedDir, id);
      const allLevelsExist = ['level1.mp3', 'level2.mp3', 'level3.mp3'].every((f) =>
        fs.existsSync(path.join(songDir, f))
      );
      if (!allLevelsExist) {
        missingAudio.push(id);
        continue;
      }

      songsData.push({
        name,
        artists,
        youtube_link: row.YouTube_Link ? row.YouTube_Link.trim() : '',
        viewcount,
        release_year: releaseYear,
        decade,
        preprocessed
      });
    }

    if (missingAudio.length > 0) {
      console.warn(`⚠️  Skipping ${missingAudio.length} songs missing audio on disk: ${missingAudio.slice(0, 10).join(', ')}${missingAudio.length > 10 ? ', ...' : ''}\n`);
    }

    // Clear existing songs (this is a full re-seed, not an incremental upsert)
    const existingCount = await Song.countDocuments();
    if (existingCount > 0) {
      console.log(`⚠️  Found ${existingCount} existing songs. Clearing...`);
      await Song.deleteMany({});
      console.log('✅ Cleared existing songs\n');
    }

    console.log('📥 Inserting songs...');
    let insertedCount = 0;
    let failedCount = 0;

    for (const songData of songsData) {
      try {
        await Song.create(songData);
        insertedCount++;
        if (insertedCount % 100 === 0) {
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
    console.log(`   Skipped (missing audio): ${missingAudio.length} songs`);
    console.log('='.repeat(60));

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
