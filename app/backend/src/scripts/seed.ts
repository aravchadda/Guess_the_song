#!/usr/bin/env ts-node
/**
 * Database Seeding Script
 * 
 * Usage: npm run seed
 * 
 * Reads preprocessed_songs.json and populates MongoDB
 */

import mongoose from 'mongoose';
import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';
import Song from '../models/Song';

// Load environment variables from backend
dotenv.config({ path: path.join(__dirname, '../../.env') });

const PREPROCESSED_JSON = path.join(__dirname, '../../../scripts/preprocessed_songs.json');

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

async function seedDatabase() {
  try {
    console.log('🌱 Starting database seed...\n');
    
    // Check if JSON file exists
    if (!fs.existsSync(PREPROCESSED_JSON)) {
      console.error(`❌ Preprocessed JSON not found: ${PREPROCESSED_JSON}`);
      console.error('Please run the preprocessing script first: npm run preprocess');
      process.exit(1);
    }
    
    // Connect to MongoDB
    const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/guess-the-song';
    console.log(`📡 Connecting to MongoDB: ${MONGODB_URI}`);
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');
    
    // Read preprocessed songs
    const songsData: PreprocessedSong[] = JSON.parse(
      fs.readFileSync(PREPROCESSED_JSON, 'utf-8')
    );
    
    console.log(`📊 Found ${songsData.length} songs to seed\n`);
    
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

