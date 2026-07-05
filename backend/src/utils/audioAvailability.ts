import path from 'path';
import fs from 'fs';
import { ISong } from '../models/Song';

const AUDIO_PATH = process.env.AUDIO_PATH || path.join(__dirname, '../../preprocessed');

/**
 * Resolve a song's preprocessed URL path (e.g. "/preprocessed/Foo/level1.mp3")
 * to its actual location on disk.
 */
export function resolveAudioPath(urlPath: string): string {
  let relativePath = urlPath.replace(/^\/preprocessed\//, '');
  relativePath = decodeURIComponent(relativePath);
  return path.join(AUDIO_PATH, relativePath);
}

/**
 * Which levels (1/2/3) actually have an audio file on disk for this song.
 * Some songs are missing a level (e.g. a silent/trimmed stem never got
 * exported) - the game should start at and skip between whichever levels
 * actually exist rather than assuming all three are always present.
 */
export function getAvailableLevels(song: Pick<ISong, 'preprocessed'>): number[] {
  const levels: Array<[number, string]> = [
    [1, song.preprocessed.level1],
    [2, song.preprocessed.level2],
    [3, song.preprocessed.level3],
  ];

  return levels
    .filter(([, urlPath]) => urlPath && fs.existsSync(resolveAudioPath(urlPath)))
    .map(([level]) => level);
}
