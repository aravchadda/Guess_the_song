import mongoose, { Schema, Document } from 'mongoose';

// Fixed set of genres every song is classified into - see
// getting_the_data/artist_genres.json for how these were assigned
// (Haiku-classified per unique artist string, not per song). Hindi is its
// own bucket regardless of the song's actual sub-genre - it's surfaced in
// the UI as a separate include/exclude toggle, not one of the tickable
// genre checkboxes (those are the other 4).
export const GENRES = ['Pop', 'Rock', 'Hip-Hop', 'R&B', 'Hindi'] as const;
export type Genre = (typeof GENRES)[number];

export interface ISong extends Document {
  name: string;
  artists: string;
  youtube_link: string;
  viewcount: number;
  release_year: number;
  decade: number;
  genre: Genre;
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
    genre: { type: String, required: true, enum: GENRES, index: true },
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
SongSchema.index({ genre: 1, decade: 1 });

export default mongoose.model<ISong>('Song', SongSchema);

