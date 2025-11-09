import os
import pandas as pd
import yt_dlp
from yt_dlp.utils import download_range_func

# Configuration
CSV_FILE = 'spotify_playlist_tracks.csv'  # Replace with your CSV filename
OUTPUT_FOLDER = 'music_collection'
START_TIME = 40 # seconds
END_TIME = 65    # seconds

# Create output folder if it doesn't exist
os.makedirs(OUTPUT_FOLDER, exist_ok=True)

# Read the CSV file
df = pd.read_csv(CSV_FILE)

# Process each video link
for idx, row in df.iterrows():
    youtube_link = row['YouTube_Link']
    song_name = row['Song_Name']
    
    try:
        # Use the song name from CSV (no cleaning/modification)
        safe_title = song_name
        
        # Download the audio segment (20s to 45s)
        output_path = os.path.join(OUTPUT_FOLDER, f'{safe_title}.mp3')
        
        # Check if file already exists
        if os.path.exists(output_path):
            print(f"⊙ Skipped (already exists): {safe_title}")
            continue
        
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
        
        with yt_dlp.YoutubeDL(download_opts) as ydl:
            ydl.download([youtube_link])
        
        print(f"✓ Downloaded: {safe_title}")
        
    except Exception as e:
        print(f"✗ Error processing {youtube_link}: {str(e)}")

print(f"\n✓ Audio files saved in: {OUTPUT_FOLDER}/")
