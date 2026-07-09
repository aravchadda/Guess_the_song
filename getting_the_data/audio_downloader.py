import os
import shutil
import threading
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed

import pandas as pd
import yt_dlp
from yt_dlp.utils import download_range_func

# Configuration
CSV_FILE = 'combined_songs_with_links.csv'
OUTPUT_FOLDER = '../music_collection'
BACKUP_DIR = 'temp_backups'
START_TIME = 40  # seconds
END_TIME = 65    # seconds
MAX_WORKERS = 4  # concurrent downloads

os.makedirs(OUTPUT_FOLDER, exist_ok=True)
os.makedirs(BACKUP_DIR, exist_ok=True)

ts = datetime.now().strftime('%Y%m%d_%H%M%S')

# Read the CSV file (ID must stay a zero-padded string, e.g. "0001" -- otherwise
# pandas infers it as an int and strips the leading zeros, breaking filenames)
df = pd.read_csv(CSV_FILE, dtype={'ID': str})

shutil.copy(CSV_FILE, f'{BACKUP_DIR}/combined_songs_with_links_{ts}_pre_download.csv')


def download_song(row):
    youtube_link = row['YouTube_Link']
    song_name = row['Song']
    song_id = row['ID']

    if pd.isna(youtube_link):
        return song_name, 'skipped (no link)'

    output_path = os.path.join(OUTPUT_FOLDER, f'{song_id}.mp3')

    if os.path.exists(output_path):
        return song_name, 'skipped (already exists)'

    download_opts = {
        'format': 'bestaudio/best',
        'download_ranges': download_range_func(None, [(START_TIME, END_TIME)]),
        'force_keyframes_at_cuts': True,
        'outtmpl': output_path.replace('.mp3', '.%(ext)s'),
        'postprocessors': [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'mp3',
            'preferredquality': '192',
        }],
        'quiet': True,
        'no_warnings': True,
    }

    try:
        with yt_dlp.YoutubeDL(download_opts) as ydl:
            ydl.download([youtube_link])
        return song_name, 'downloaded'
    except Exception as e:
        return song_name, f'error: {e}'


rows = [row for _, row in df.iterrows()]
lock = threading.Lock()
completed = 0
counts = {'downloaded': 0, 'skipped': 0, 'error': 0}

print(f"Processing {len(rows)} songs with {MAX_WORKERS} concurrent workers...\n")

with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
    futures = {executor.submit(download_song, row): row['Song'] for row in rows}
    for future in as_completed(futures):
        song_name, status = future.result()
        with lock:
            completed += 1
            if status == 'downloaded':
                counts['downloaded'] += 1
                symbol = 'OK'
            elif status.startswith('skipped'):
                counts['skipped'] += 1
                symbol = 'SKIP'
            else:
                counts['error'] += 1
                symbol = 'ERR'
            safe_name = song_name.encode('ascii', 'replace').decode('ascii')
            print(f"[{completed}/{len(rows)}] {symbol} {status}: {safe_name}")

print(f"\nDone. Downloaded: {counts['downloaded']}, Skipped: {counts['skipped']}, Errors: {counts['error']}")
print(f"Audio files saved in: {OUTPUT_FOLDER}/")
