import fs from 'fs';
import path from 'path';

type PreprocessedAudio = Partial<Record<'level1' | 'level2' | 'level3', string>>;

export function getAvailableAudioLevels(preprocessed: PreprocessedAudio): number[] {
  const audioRoot = process.env.AUDIO_PATH || path.join(__dirname, '../../preprocessed');

  return ([1, 2, 3] as const).filter((level) => {
    const storedPath = preprocessed[`level${level}`];
    if (!storedPath) return false;

    const relativePath = decodeURIComponent(storedPath.replace(/^\/preprocessed\//, ''));
    return fs.existsSync(path.join(audioRoot, relativePath));
  });
}
