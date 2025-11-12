import mongoose, { Schema, Document } from 'mongoose';

export interface ISong extends Document {
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
  createdAt: Date;
  updatedAt: Date;
}

const SongSchema: Schema = new Schema(
  {
    name: { type: String, required: true, index: true },
    artists: { type: String, required: true, index: true },
    youtube_link: { type: String, required: true },
    viewcount: { type: Number, required: true, index: true },
    release_year: { type: Number, required: true, index: true },
    decade: { type: Number, required: true, index: true },
    preprocessed: {
      level1: { type: String, required: true },
      level2: { type: String, required: true },
      level3: { type: String, required: true }
    }
  },
  { timestamps: true }
);

// Indexes for efficient queries
SongSchema.index({ decade: 1, viewcount: -1 });
SongSchema.index({ release_year: 1, viewcount: -1 });

export default mongoose.model<ISong>('Song', SongSchema);

