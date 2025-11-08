import os
import pandas as pd
import yt_dlp
from yt_dlp.utils import download_range_func

# Configuration
CSV_FILE = 'spotify_playlist_tracks.csv'  # Replace with your CSV filename
OUTPUT_FOLDER = 'music_collection'
START_TIME = 20  # seconds
END_TIME = 45    # seconds

# Create output folder if it doesn't exist
os.makedirs(OUTPUT_FOLDER, exist_ok=True)

# Read the CSV file
df = pd.read_csv(CSV_FILE)

# Create ViewCount column if it doesn't exist
if 'ViewCount' not in df.columns:
    df['ViewCount'] = None

# Process each video link
for idx, row in df.iterrows():
    youtube_link = row['YouTube_Link']
    
    try:
        # First, extract metadata to get view count and title
        info_opts = {
            'quiet': True,
            'no_warnings': True,
        }
        
        with yt_dlp.YoutubeDL(info_opts) as ydl:
            info_dict = ydl.extract_info(youtube_link, download=False)
            view_count = info_dict.get('view_count', 0)
            video_title = info_dict.get('title', f'video_{idx}')
            
            # Clean the title to make it a valid filename
            safe_title = "".join(c for c in video_title if c.isalnum() or c in (' ', '-', '_')).rstrip()
            safe_title = safe_title.replace(' ', '_')
            
        # Update view count in dataframe
        df.at[idx, 'ViewCount'] = view_count
        
        # Download the audio segment (20s to 45s)
        output_path = os.path.join(OUTPUT_FOLDER, f'{safe_title}.mp3')
        
        # Check if file already exists
        if os.path.exists(output_path):
            print(f"⊙ Skipped (already exists): {safe_title} | Views: {view_count:,}")
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
        
        print(f"✓ Downloaded: {safe_title} | Views: {view_count:,}")
        
    except Exception as e:
        print(f"✗ Error processing {youtube_link}: {str(e)}")
        df.at[idx, 'ViewCount'] = 'Error'

# Save the updated CSV with view counts
df.to_csv(CSV_FILE, index=False)
print(f"\n✓ Updated CSV saved: {CSV_FILE}")
print(f"✓ Audio files saved in: {OUTPUT_FOLDER}/")
