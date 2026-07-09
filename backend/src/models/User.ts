import mongoose, { Schema, Document } from 'mongoose';

// Successful guesses broken down by which level they were guessed on:
// drums = level 1 (hardest, drums only), instruments = level 2 (vocals
// removed), vocals = level 3 (full mix, easiest).
export interface ISuccessfulGuesses {
  drums: number;
  instruments: number;
  vocals: number;
}

export interface IUser extends Document {
  googleId: string;
  email: string;
  name: string;
  picture?: string;
  totalPoints: number;
  songsPlayed: number;
  successfulGuesses: ISuccessfulGuesses;
  failedGuesses: number;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema: Schema = new Schema(
  {
    googleId: { type: String, required: true, unique: true, index: true },
    email: { type: String, required: true, index: true },
    name: { type: String, required: true },
    picture: { type: String },
    // Cached/derived from successfulGuesses (drums*10 + instruments*5 + vocals*1)
    // at guess time -- kept as a stored field so the leaderboard can sort on an
    // indexed value instead of aggregating on every request.
    totalPoints: { type: Number, default: 0, index: true },
    songsPlayed: { type: Number, default: 0 },
    successfulGuesses: {
      drums: { type: Number, default: 0 },
      instruments: { type: Number, default: 0 },
      vocals: { type: Number, default: 0 }
    },
    failedGuesses: { type: Number, default: 0 }
  },
  { timestamps: true }
);

export default mongoose.model<IUser>('User', UserSchema);
