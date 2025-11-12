import pandas as pd
from googleapiclient.discovery import build
import time

# Your existing API key
YOUTUBE_API_KEY = 'AIzaSyBcjt0f5foEt6YW9yiBbAWFzQsqhNiTh-E'

def search_youtube_by_title(song_title, artist_name):
    youtube = build('youtube', 'v3', developerKey=YOUTUBE_API_KEY)
    search_query = f"{song_title} {artist_name}"

    # Search for the video - get top 5 results
    request = youtube.search().list(
        part='id,snippet',
        type='video',
        q=search_query,
        maxResults=5,  # Get top 5 results
        videoCategoryId='10'  # Music category
    )
    
    response = request.execute()
    
    if response['items']:
        # Collect all video IDs from top 5 results
        video_ids = [item['id']['videoId'] for item in response['items']]
        
        # Get video statistics for all videos at once
        video_request = youtube.videos().list(
            part='statistics',
            id=','.join(video_ids)
        )
        video_response = video_request.execute()
        
        if video_response['items']:
            # Find the video with the highest view count
            best_video = None
            max_views = 0
            
            for video in video_response['items']:
                view_count = int(video['statistics']['viewCount'])
                if view_count > max_views:
                    max_views = view_count
                    best_video = video['id']
            
            if best_video:
                video_url = f"https://www.youtube.com/watch?v={best_video}"
                return video_url, max_views
    
    return None, None

# Read the CSV
df = pd.read_csv('spotify_playlist_tracks.csv')

# Strip whitespace from column names
df.columns = df.columns.str.strip()

# Strip whitespace from data values (song names and artists)
df['Song_Name'] = df['Song_Name'].astype(str).str.strip()
df['Artists'] = df['Artists'].astype(str).str.strip()

# Initialize ViewCount column if it doesn't exist
if 'ViewCount' not in df.columns:
    df['ViewCount'] = None

# Convert ViewCount to numeric, handling any non-numeric values
df['ViewCount'] = pd.to_numeric(df['ViewCount'], errors='coerce')

print(f"\n📊 Total songs in dataset: {len(df)}")
print(f"📊 Songs with existing view counts: {df['ViewCount'].notna().sum()}")
print(f"📊 Songs needing view count updates: {df['ViewCount'].isna().sum()}")

# ============================================
# STEP 1: UPDATE VIEW COUNTS FOR ALL SONGS
# ============================================
print("\n" + "="*60)
print("STEP 1: Updating view counts for all songs...")
print("="*60)

total_songs = len(df)
for idx, (index, row) in enumerate(df.iterrows(), 1):
    song = row['Song_Name']
    artist = row['Artists']
    current_views = row['ViewCount']
    
    print(f"\n[{idx}/{total_songs}] Searching YouTube for: {song} by {artist}")
    
    try:
        link, views = search_youtube_by_title(song, artist)
        
        if link and views:
            df.at[index, 'YouTube_Link'] = link
            df.at[index, 'ViewCount'] = views
            if pd.notna(current_views):
                change = views - current_views
                print(f"✅ Updated: {link} with {views:,} views (change: {change:+,})")
            else:
                print(f"✅ Found: {link} with {views:,} views")
        else:
            print(f"❌ No video found for {song}")
    except Exception as e:
        print(f"❌ Error with {song}: {e}")
    
    time.sleep(1)  # To avoid hitting rate limits

# Save intermediate results
df.to_csv('spotify_playlist_tracks.csv', index=False)
print("\n💾 Intermediate results saved!")

# ============================================
# STEP 2: SORT BY VIEW COUNT AND PROCESS 100 LEAST VIEWED
# ============================================
print("\n" + "="*60)
print("STEP 2: Sorting by view count and processing 100 least viewed songs...")
print("="*60)

# Sort by ViewCount (ascending - lowest first), putting NaN values last
df = df.sort_values('ViewCount', ascending=True, na_position='last').reset_index(drop=True)

print(f"\n📊 View count statistics:")
print(f"   Min views: {df['ViewCount'].min():,.0f}")
print(f"   Max views: {df['ViewCount'].max():,.0f}")
print(f"   Mean views: {df['ViewCount'].mean():,.0f}")

# Get the 100 rows with least views
bottom_100 = df.head(100)
print(f"\n🔄 Processing 100 songs with least views...")
print(f"   View count range: {bottom_100['ViewCount'].min():,.0f} to {bottom_100['ViewCount'].max():,.0f}")

# Track indices to remove (songs with less than 1 million views)
indices_to_remove = []

for idx, (index, row) in enumerate(bottom_100.iterrows(), 1):
    song = row['Song_Name']
    artist = row['Artists']
    current_views = row['ViewCount']
    
    print(f"\n[{idx}/100] Re-checking: {song} by {artist} (current: {current_views:,.0f} views)")
    
    try:
        link, views = search_youtube_by_title(song, artist)
        
        if link and views:
            if views < 1000000:
                print(f"🗑️  Skipping {song} - view count {views:,} is below 1 million")
                indices_to_remove.append(index)
            else:
                df.at[index, 'YouTube_Link'] = link
                df.at[index, 'ViewCount'] = views
                print(f"✅ Updated: {link} with {views:,} views")
        else:
            print(f"❌ No video found for {song}")
            indices_to_remove.append(index)
    except Exception as e:
        print(f"❌ Error with {song}: {e}")
        indices_to_remove.append(index)
    
    time.sleep(1)  # To avoid hitting rate limits

# Remove songs with less than 1 million views
if indices_to_remove:
    print(f"\n🗑️  Removing {len(indices_to_remove)} songs with less than 1 million views...")
    df = df.drop(indices_to_remove).reset_index(drop=True)

# Save final results to the CSV
df.to_csv('spotify_playlist_tracks.csv', index=False)
print("\n✅ Done! Final results saved to spotify_playlist_tracks.csv")
print(f"📊 Final dataset contains {len(df)} songs")
