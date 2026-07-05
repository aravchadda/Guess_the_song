import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  googleId: string;
  email: string;
  name: string;
  picture?: string;
  totalPoints: number;
  songsPlayed: number;
  successfulGuesses: number;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema: Schema = new Schema(
  {
    googleId: { type: String, required: true, unique: true, index: true },
    email: { type: String, required: true, index: true },
    name: { type: String, required: true },
    picture: { type: String },
    totalPoints: { type: Number, default: 0, index: true },
    songsPlayed: { type: Number, default: 0 },
    successfulGuesses: { type: Number, default: 0 }
  },
  { timestamps: true }
);

export default mongoose.model<IUser>('User', UserSchema);
