import pandas as pd
import yt_dlp
from concurrent.futures import ThreadPoolExecutor, as_completed
import threading
import shutil
import os
from datetime import datetime

CSV_FILE = 'combined_songs_with_links.csv'
BACKUP_DIR = 'temp_backups'
MAX_WORKERS = 8  # concurrent yt-dlp searches
SAVE_EVERY = 25  # checkpoint frequency

os.makedirs(BACKUP_DIR, exist_ok=True)


def search_youtube_by_title(song_title, artist_name):
    """Search YouTube (via yt-dlp, no API/quota involved), get the top 5 results,
    and return the link + view count of whichever has the most views."""
    query = f"ytsearch5:{song_title} {artist_name}"
    opts = {'quiet': True, 'no_warnings': True, 'extract_flat': False}
    with yt_dlp.YoutubeDL(opts) as ydl:
        info = ydl.extract_info(query, download=False)
        entries = [e for e in (info.get('entries') or []) if e]
        if not entries:
            return None, None
        best = max(entries, key=lambda e: e.get('view_count') or 0)
        views = best.get('view_count')
        link = best.get('webpage_url')
        if link and views:
            return link, views
        return None, None


ts = datetime.now().strftime('%Y%m%d_%H%M%S')

# Read the combined CSV
df = pd.read_csv(CSV_FILE)
df.columns = df.columns.str.strip()

df['ViewCount'] = pd.to_numeric(df['ViewCount'], errors='coerce')

shutil.copy(CSV_FILE, f'{BACKUP_DIR}/combined_songs_with_links_{ts}_pre_ytlinks.csv')

# Only fetch for rows that don't already have a link (existing links/views are kept as-is)
todo = df[df['YouTube_Link'].isna()].index.tolist()

print(f"\nTotal songs in dataset: {len(df)}")
print(f"Songs with existing YouTube links (kept as-is): {len(df) - len(todo)}")
print(f"Songs needing YouTube lookup: {len(todo)}")
print(f"Using {MAX_WORKERS} concurrent workers\n")


def process_row(idx):
    song = df.at[idx, 'Song']
    artist = df.at[idx, 'Artist']
    try:
        link, views = search_youtube_by_title(song, artist)
        return idx, song, artist, link, views, None
    except Exception as e:
        return idx, song, artist, None, None, str(e)


lock = threading.Lock()
completed = 0

with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
    futures = {executor.submit(process_row, idx): idx for idx in todo}
    for future in as_completed(futures):
        idx, song, artist, link, views, err = future.result()
        with lock:
            completed += 1
            if err:
                print(f"[{completed}/{len(todo)}] Error with {song}: {err}")
            elif link:
                df.at[idx, 'YouTube_Link'] = link
                df.at[idx, 'ViewCount'] = views
                print(f"[{completed}/{len(todo)}] Found: {song} by {artist} -> {views:,} views")
            else:
                print(f"[{completed}/{len(todo)}] No video found for {song}")

            if completed % SAVE_EVERY == 0:
                df.to_csv(CSV_FILE, index=False)
                shutil.copy(CSV_FILE, f'{BACKUP_DIR}/combined_songs_with_links_{ts}_progress_{completed}.csv')
                print(f"   (checkpoint saved at {completed}/{len(todo)})")

# Final save
df.to_csv(CSV_FILE, index=False)
shutil.copy(CSV_FILE, f'{BACKUP_DIR}/combined_songs_with_links_{ts}_final.csv')

print(f"\nDone. {df['YouTube_Link'].notna().sum()}/{len(df)} songs now have a YouTube link.")
