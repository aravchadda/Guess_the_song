// Quick script to add a test song to verify the app works
const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb://localhost:27017/guess-the-song';

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

async function addTestSong() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    // Check if songs already exist
    const count = await Song.countDocuments();
    console.log(`📊 Current songs in database: ${count}`);
    
    if (count === 0) {
      // Add a test song
      const testSong = await Song.create({
        name: 'Test Song',
        artists: 'Test Artist',
        youtube_link: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        viewcount: 1000000,
        release_year: 2020,
        decade: 2020,
        preprocessed: {
          level1: '/preprocessed/Test_Song/level1.mp3',
          level2: '/preprocessed/Test_Song/level2.mp3',
          level3: '/preprocessed/Test_Song/level3.mp3'
        }
      });
      
      console.log('✅ Added test song:', testSong.name);
      console.log('\n⚠️  NOTE: This is just a test entry. To play real songs:');
      console.log('   1. Add stems to: app/backend/separated/');
      console.log('   2. Run: cd app/scripts && npm run preprocess');
      console.log('   3. Run: cd app/backend && npm run seed');
    } else {
      console.log('✅ Database already has songs!');
    }
    
    await mongoose.disconnect();
    console.log('👋 Done!');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

addTestSong();

