const CAROUSEL_AUDIO_FILES = [
  '/audio/ariana.mp3',
  '/audio/bad-bunny.mp3',
  '/audio/kendrick.mp3',
  '/audio/single-ladies.mp3',
  '/audio/royals.mp3',
  '/audio/hard-times.mp3',
  '/audio/tame-impala.mp3',
];

export interface PreloadedCarouselAudio {
  playbackUrl: string;
}

let readyAudio: PreloadedCarouselAudio | null = null;
let pendingPreload: Promise<PreloadedCarouselAudio | null> | null = null;

export function getRandomCarouselAudioUrl(): string {
  return CAROUSEL_AUDIO_FILES[Math.floor(Math.random() * CAROUSEL_AUDIO_FILES.length)];
}

export function preloadNextCarouselAudio(): Promise<PreloadedCarouselAudio | null> {
  if (typeof window === 'undefined') return Promise.resolve(null);
  if (readyAudio) return Promise.resolve(readyAudio);
  if (pendingPreload) return pendingPreload;

  const sourceUrl = getRandomCarouselAudioUrl();
  pendingPreload = fetch(sourceUrl)
    .then((response) => {
      if (!response.ok) throw new Error(`Failed to preload ${sourceUrl}`);
      return response.blob();
    })
    .then((blob) => {
      readyAudio = {
        playbackUrl: URL.createObjectURL(blob),
      };
      return readyAudio;
    })
    .catch((error) => {
      console.log('Carousel audio preload error:', error);
      return null;
    })
    .finally(() => {
      pendingPreload = null;
    });

  return pendingPreload;
}

export function consumePreloadedCarouselAudio(): PreloadedCarouselAudio | null {
  const audio = readyAudio;
  readyAudio = null;
  return audio;
}

export function releasePreloadedCarouselAudio(audio: PreloadedCarouselAudio | null): void {
  if (!audio) return;
  URL.revokeObjectURL(audio.playbackUrl);
}
