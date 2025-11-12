import mongoose, { Schema, Document } from 'mongoose';

export interface IAttempt {
  attemptNumber: number;
  guessText: string;
  timestamp: Date;
  correct: boolean;
}

export interface IPlay extends Document {
  songId: mongoose.Types.ObjectId;
  mode: 'random' | 'decade';
  modeValue?: string;
  startedAt: Date;
  finishedAt?: Date;
  currentLevel: number; // Current level (1, 2, or 3)
  guessedLevel?: number; // Level at which correct guess was made
  wasCorrect: boolean;
  attempts: IAttempt[];
  createdAt: Date;
  updatedAt: Date;
}

const AttemptSchema: Schema = new Schema({
  attemptNumber: { type: Number, required: true },
  guessText: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  correct: { type: Boolean, required: true }
}, { _id: false });

const PlaySchema: Schema = new Schema(
  {
    songId: { type: Schema.Types.ObjectId, ref: 'Song', required: true, index: true },
    mode: { type: String, enum: ['random', 'decade'], required: true },
    modeValue: { type: String },
    startedAt: { type: Date, default: Date.now },
    finishedAt: { type: Date },
    currentLevel: { type: Number, default: 1, min: 1, max: 3 },
    guessedLevel: { type: Number, min: 1, max: 3 },
    wasCorrect: { type: Boolean, default: false },
    attempts: [AttemptSchema]
  },
  { timestamps: true }
);

// Index for stats queries
PlaySchema.index({ wasCorrect: 1, guessedLevel: 1 });
PlaySchema.index({ createdAt: -1 });

export default mongoose.model<IPlay>('Play', PlaySchema);

