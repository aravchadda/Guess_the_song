"""
Builds backend/preprocessed/<ID>/level{1,2,3}.mp3 from the Kaggle notebook
outputs and the original clips.

Expects, at the repo root:
- guess_the_song_drums.zip          (from kaggle_level_pipeline.ipynb, drums section)
- guess_the_song_instrumentals.zip  (from kaggle_level_pipeline.ipynb, vocal-removal section)
- music_collection/<ID>.mp3         (original clips, from audio_downloader.py)

Each ID's three sources become:
- level1.mp3  <- guess_the_song_drums.zip's <ID>.mp3          (drums only, hardest)
- level2.mp3  <- guess_the_song_instrumentals.zip's <ID>.mp3  (vocals removed)
- level3.mp3  <- music_collection/<ID>.mp3                     (original, easiest)

Run from the repo root: python getting_the_data/build_preprocessed_folders.py
"""
import zipfile
import shutil
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PREPROCESSED_DIR = ROOT / 'backend' / 'preprocessed'
DRUMS_ZIP = ROOT / 'guess_the_song_drums.zip'
INSTR_ZIP = ROOT / 'guess_the_song_instrumentals.zip'
MUSIC_DIR = ROOT / 'music_collection'


def main():
    for required in [DRUMS_ZIP, INSTR_ZIP, MUSIC_DIR]:
        if not required.exists():
            raise FileNotFoundError(
                f'{required} not found. Run kaggle_level_pipeline.ipynb and place its two '
                f'output zips at the repo root, and make sure music_collection/ exists '
                f'(from audio_downloader.py).'
            )

    PREPROCESSED_DIR.mkdir(parents=True, exist_ok=True)

    drums_zf = zipfile.ZipFile(DRUMS_ZIP)
    instr_zf = zipfile.ZipFile(INSTR_ZIP)

    drums_ids = sorted(n[:-4] for n in drums_zf.namelist())
    instr_ids = sorted(n[:-4] for n in instr_zf.namelist())
    mc_ids = sorted(f[:-4] for f in os.listdir(MUSIC_DIR) if f.endswith('.mp3'))

    if not (drums_ids == instr_ids == mc_ids):
        raise AssertionError(
            "ID sets don't match between the drums zip, instrumentals zip, and "
            "music_collection/ -- aborting rather than building a mismatched dataset."
        )
    song_ids = drums_ids
    print(f'Building preprocessed folders for {len(song_ids)} songs...')

    errors = []
    for i, song_id in enumerate(song_ids, 1):
        song_dir = PREPROCESSED_DIR / song_id
        song_dir.mkdir(parents=True, exist_ok=True)

        try:
            with drums_zf.open(f'{song_id}.mp3') as src, open(song_dir / 'level1.mp3', 'wb') as dst:
                shutil.copyfileobj(src, dst)
            with instr_zf.open(f'{song_id}.mp3') as src, open(song_dir / 'level2.mp3', 'wb') as dst:
                shutil.copyfileobj(src, dst)
            shutil.copy(MUSIC_DIR / f'{song_id}.mp3', song_dir / 'level3.mp3')

            for lvl in ['level1.mp3', 'level2.mp3', 'level3.mp3']:
                if (song_dir / lvl).stat().st_size == 0:
                    errors.append(f'{song_id}/{lvl} is 0 bytes')
        except Exception as e:
            errors.append(f'{song_id}: {e}')

        if i % 200 == 0 or i == len(song_ids):
            print(f'  {i}/{len(song_ids)} done')

    drums_zf.close()
    instr_zf.close()

    print(f'\nErrors: {len(errors)}')
    for e in errors[:20]:
        print(' ', e)

    folder_count = len(list(PREPROCESSED_DIR.iterdir()))
    file_count = sum(1 for _ in PREPROCESSED_DIR.glob('*/*.mp3'))
    print(f'\nFinal: {folder_count} song folders, {file_count} mp3 files '
          f'(expect {len(song_ids)} and {len(song_ids) * 3})')


if __name__ == '__main__':
    main()
