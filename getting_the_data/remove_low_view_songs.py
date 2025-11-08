import os
import pandas as pd

# Configuration
CSV_FILE = 'spotify_playlist_tracks.csv'
OUTPUT_FOLDER = 'music_collection'
MIN_VIEWS = 1_000_000  # 1 million views threshold

# Read the CSV file
df = pd.read_csv(CSV_FILE)

# Check if ViewCount column exists
if 'ViewCount' not in df.columns:
    print("Error: ViewCount column not found in CSV!")
    exit(1)

# Track statistics
rows_to_remove = []
files_deleted = 0
files_not_found = 0

print(f"Scanning for songs with less than {MIN_VIEWS:,} views...\n")

# Process each row
for idx, row in df.iterrows():
    view_count = row['ViewCount']
    
    # Skip if ViewCount is not a valid number
    if pd.isna(view_count) or view_count == 'Error':
        print(f"⊗ Skipping row {idx}: Invalid view count ({view_count})")
        continue
    
    try:
        view_count = int(view_count)
    except (ValueError, TypeError):
        print(f"⊗ Skipping row {idx}: Cannot convert view count to number ({view_count})")
        continue
    
    # Check if below threshold
    if view_count < MIN_VIEWS:
        # Get the track name to construct filename
        track_name = row.get('Track_Name', f'video_{idx}')
        artist_name = row.get('Artist_Name', '')
        
        # Try to construct the video title similar to how YouTube would format it
        # This is an approximation - we'll search for files containing the track name
        safe_track = "".join(c for c in track_name if c.isalnum() or c in (' ', '-', '_')).rstrip()
        safe_track = safe_track.replace(' ', '_')
        
        # Look for matching files in the music collection folder
        deleted = False
        if os.path.exists(OUTPUT_FOLDER):
            for filename in os.listdir(OUTPUT_FOLDER):
                # Check if the track name appears in the filename
                if safe_track.lower() in filename.lower() and filename.endswith('.mp3'):
                    file_path = os.path.join(OUTPUT_FOLDER, filename)
                    try:
                        os.remove(file_path)
                        print(f"✗ Deleted: {filename} | Views: {view_count:,}")
                        files_deleted += 1
                        deleted = True
                        break
                    except Exception as e:
                        print(f"✗ Error deleting {filename}: {str(e)}")
        
        if not deleted:
            print(f"⊙ File not found for: {track_name} | Views: {view_count:,}")
            files_not_found += 1
        
        # Mark row for removal
        rows_to_remove.append(idx)

# Remove rows from dataframe
if rows_to_remove:
    df = df.drop(rows_to_remove)
    df = df.reset_index(drop=True)
    
    # Save the updated CSV
    df.to_csv(CSV_FILE, index=False)
    print(f"\n{'='*60}")
    print(f"✓ Removed {len(rows_to_remove)} rows from CSV")
    print(f"✓ Deleted {files_deleted} audio files")
    print(f"⊙ {files_not_found} audio files not found")
    print(f"✓ Updated CSV saved: {CSV_FILE}")
    print(f"✓ Remaining songs: {len(df)}")
else:
    print(f"\n{'='*60}")
    print("✓ No songs found with less than 1 million views!")
    print(f"✓ Total songs: {len(df)}")

