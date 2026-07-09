#!/usr/bin/env ts-node
/**
 * One-time migration: roll up the old `plays` collection's historical data
 * into the new per-user counters (User.successfulGuesses / failedGuesses /
 * totalPoints / songsPlayed) before that collection gets dropped.
 *
 * The Play model/schema no longer exists in code (removed along with
 * plays.ts), so this reads the raw `plays` collection directly rather than
 * going through Mongoose - it never needs the schema, just the field names
 * that were always written: userId, wasCorrect, guessedLevel, pointsAwarded,
 * finishedAt.
 *
 * Idempotent: it SETS each user's counters to the freshly-computed totals
 * (not $inc), so re-running it is safe and just recomputes from whatever is
 * still in `plays` - it does not add on top of a previous run. If the
 * `plays` collection has already been dropped, it's a no-op.
 *
 * Guest plays (no userId) can't be attributed to any User document and are
 * skipped - matches the new system, where guest outcomes were never tracked
 * either.
 *
 * Usage: npm run migrate-plays   (run once, before dropping `plays`, as part
 * of the deploy that ships the Play-less backend)
 */

import mongoose from 'mongoose';
import path from 'path';
import dotenv from 'dotenv';
import User from '../models/User';

dotenv.config({ path: path.join(__dirname, '../../../.env') });

interface UserTotals {
  _id: mongoose.Types.ObjectId;
  drums: number;
  instruments: number;
  vocals: number;
  failedGuesses: number;
  totalPoints: number;
  songsPlayed: number;
}

async function migrate() {
  const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/guess-the-song';
  console.log('📡 Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI);
  console.log('✅ Connected\n');

  try {
    const db = mongoose.connection.db!;
    const existing = await db.listCollections({ name: 'plays' }).toArray();
    if (existing.length === 0) {
      console.log('ℹ️  No "plays" collection found (already dropped, or never existed) - nothing to migrate.');
      return;
    }

    const plays = db.collection('plays');
    const totalPlays = await plays.countDocuments();
    const guestPlays = await plays.countDocuments({ userId: { $in: [null, undefined] } });
    console.log(`📊 Found ${totalPlays} play documents (${guestPlays} guest plays with no userId, will be skipped)\n`);

    const results = await plays.aggregate<UserTotals>([
      { $match: { userId: { $exists: true, $ne: null } } },
      {
        $group: {
          _id: '$userId',
          drums: {
            $sum: {
              $cond: [{ $and: [{ $eq: ['$wasCorrect', true] }, { $eq: ['$guessedLevel', 1] }] }, 1, 0]
            }
          },
          instruments: {
            $sum: {
              $cond: [{ $and: [{ $eq: ['$wasCorrect', true] }, { $eq: ['$guessedLevel', 2] }] }, 1, 0]
            }
          },
          vocals: {
            $sum: {
              $cond: [{ $and: [{ $eq: ['$wasCorrect', true] }, { $eq: ['$guessedLevel', 3] }] }, 1, 0]
            }
          },
          failedGuesses: {
            $sum: {
              $cond: [{ $and: [{ $eq: ['$wasCorrect', false] }, { $ne: ['$finishedAt', null] }] }, 1, 0]
            }
          },
          totalPoints: { $sum: { $ifNull: ['$pointsAwarded', 0] } },
          songsPlayed: { $sum: { $cond: [{ $ne: ['$finishedAt', null] }, 1, 0] } }
        }
      }
    ]).toArray();

    console.log(`📥 Aggregated historical stats for ${results.length} distinct users\n`);

    let updated = 0;
    let missingUser = 0;

    for (const r of results) {
      const user = await User.findById(r._id);
      if (!user) {
        missingUser++;
        console.warn(`   ⚠️  No User found for id ${r._id} (had ${r.drums + r.instruments + r.vocals} correct guesses in plays) - skipped`);
        continue;
      }

      user.successfulGuesses = {
        drums: r.drums,
        instruments: r.instruments,
        vocals: r.vocals
      } as any;
      user.failedGuesses = r.failedGuesses;
      user.totalPoints = r.totalPoints;
      user.songsPlayed = r.songsPlayed;
      await user.save();
      updated++;
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ Migration complete');
    console.log(`   Users updated: ${updated}`);
    console.log(`   Users referenced in plays but no longer found: ${missingUser}`);
    console.log(`   Guest plays skipped (untrackable, no userId): ${guestPlays}`);
    console.log('='.repeat(60));
    console.log('\nOnce you\'ve verified this looks right, it\'s safe to drop the "plays" collection.');
  } finally {
    await mongoose.disconnect();
    console.log('\n👋 Disconnected from MongoDB');
  }
}

if (require.main === module) {
  migrate().catch((err) => {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  });
}
