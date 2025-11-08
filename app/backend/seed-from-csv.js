// Script to seed all songs from CSV to MongoDB
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const csvParser = require('csv-parser');

const MONGODB_URI = 'mongodb://localhost:27017/guess-the-song';
const CSV_PATH = path.join(__dirname, 'spotify_playlist_tracks.csv');

const SongSchema = new mongoose.Schema({
  name: String,
  artists: String,
  youtube_link: String,
  viewcount: Number,
  release_year: Number,
  decade: Number,
  preprocessed: {
    level1: String,
    level2: String,
    level3: String
  }
}, { timestamps: true });

const Song = mongoose.model('Song', SongSchema);

function sanitizeSongName(songName) {
  return songName
    .replace(/[<>:"|?*]/g, '_')
    .replace(/\//g, '_')
    .replace(/\\/g, '_')
    .trim();
}

async function seedFromCSV() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');
    
    // Clear existing songs
    const existingCount = await Song.countDocuments();
    if (existingCount > 0) {
      console.log(`🗑️  Clearing ${existingCount} existing songs...`);
      await Song.deleteMany({});
      console.log('✅ Cleared existing songs\n');
    }
    
    // Read and parse CSV
    const songs = [];
    
    await new Promise((resolve, reject) => {
      fs.createReadStream(CSV_PATH)
        .pipe(csvParser())
        .on('data', (row) => {
          const songName = row.Song_Name.trim();
          const sanitizedName = sanitizeSongName(songName);
          const releaseYear = parseFloat(row.Release);
          const decade = Math.floor(releaseYear / 10) * 10;
          
          songs.push({
            name: songName,
            artists: row.Artists.trim(),
            youtube_link: row.YouTube_Link.trim(),
            viewcount: parseInt(row.ViewCount),
            release_year: releaseYear,
            decade: decade,
            preprocessed: {
              level1: `/preprocessed/${sanitizedName}/level1.mp3`,
              level2: `/preprocessed/${sanitizedName}/level2.mp3`,
              level3: `/preprocessed/${sanitizedName}/level3.mp3`
            }
          });
        })
        .on('end', () => resolve())
        .on('error', (err) => reject(err));
    });
    
    console.log(`📊 Found ${songs.length} songs in CSV\n`);
    console.log('💾 Inserting songs into database...');
    
    // Insert all songs
    let inserted = 0;
    for (const songData of songs) {
      try {
        await Song.create(songData);
        inserted++;
        if (inserted % 50 === 0) {
          console.log(`   Inserted ${inserted}/${songs.length}...`);
        }
      } catch (error) {
        console.error(`   ❌ Failed to insert "${songData.name}": ${error.message}`);
      }
    }
    
    console.log(`\n✅ Successfully inserted ${inserted} songs!\n`);
    
    // Show stats
    const totalSongs = await Song.countDocuments();
    const decades = await Song.distinct('decade');
    
    console.log('📊 Database Summary:');
    console.log(`   Total Songs: ${totalSongs}`);
    console.log(`   Decades: ${decades.sort().join(', ')}`);
    console.log(`   Average Views: ${Math.round(songs.reduce((sum, s) => sum + s.viewcount, 0) / songs.length).toLocaleString()}`);
    
    console.log('\n⚠️  IMPORTANT:');
    console.log('   Audio files are not yet processed.');
    console.log('   To play songs with actual audio:');
    console.log('   1. Add stems to: app/backend/separated/<Song_Name>/');
    console.log('   2. Run: cd app/scripts && npm run preprocess');
    console.log('\n   For now, you can browse songs and see the game UI!');
    
    await mongoose.disconnect();
    console.log('\n👋 Done!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

seedFromCSV();

