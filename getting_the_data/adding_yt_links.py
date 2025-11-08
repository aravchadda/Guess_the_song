import pandas as pd
from googleapiclient.discovery import build
import time

# Your existing API key
YOUTUBE_API_KEY = 'AIzaSyDRcsUa8vFdemu9DSzr4sPGHSimpK5ePiY'

def search_youtube_by_title(song_title, artist_name):
    youtube = build('youtube', 'v3', developerKey=YOUTUBE_API_KEY)
    search_query = f"{song_title} {artist_name}"

    # Search for the video
    request = youtube.search().list(
        part='id,snippet',
        type='video',
        q=search_query,
        maxResults=1,  # Get top result
        videoCategoryId='10'  # Music category
    )
    
    response = request.execute()
    
    if response['items']:
        video_id = response['items'][0]['id']['videoId']
        video_url = f"https://www.youtube.com/watch?v={video_id}"
        
        # Get video statistics to fetch view count
        video_request = youtube.videos().list(
            part='statistics',
            id=video_id
        )
        video_response = video_request.execute()
        
        if video_response['items']:
            view_count = int(video_response['items'][0]['statistics']['viewCount'])
            return video_url, view_count
    
    return None, None

# Read the CSV
df = pd.read_csv('spotify_playlist_tracks.csv')

# Initialize ViewCount column if it doesn't exist
if 'ViewCount' not in df.columns:
    df['ViewCount'] = None

# Track indices to remove (songs with less than 1 million views)
indices_to_remove = []

# Loop through each row
for index, row in df.iterrows():
    youtube_link = row.get('YouTube_Link', None)
    view_count = row.get('ViewCount', None)
    
    # Skip if YouTube_Link already exists and is valid (not empty, not containing "Error") and has view count
    if pd.notna(youtube_link) and youtube_link and not (isinstance(youtube_link, str) and 'error' in youtube_link.lower()) and pd.notna(view_count):
        # Check if existing song has less than 1 million views
        if int(view_count) < 1000000:
            print(f"🗑️  Removing {row['Song_Name']} - view count {view_count} is below 1 million")
            indices_to_remove.append(index)
        else:
            print(f"⏭️  Skipping {row['Song_Name']} - already has valid link with {view_count} views")
        continue
    
    song = row['Song_Name']
    artist = row['Artists']
    print(f"Searching YouTube for: {song} by {artist}")
    try:
        link, views = search_youtube_by_title(song, artist)
        
        if link and views:
            if views < 1000000:
                print(f"🗑️  Skipping {song} - view count {views:,} is below 1 million")
                indices_to_remove.append(index)
            else:
                df.at[index, 'YouTube_Link'] = link
                df.at[index, 'ViewCount'] = views
                print(f"✅ Found: {link} with {views:,} views")
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
    df = df.drop(indices_to_remove)

# Save results to the CSV
df.to_csv('spotify_playlist_tracks.csv', index=False)
print("\n✅ Done! Results saved to spotify_playlist_tracks.csv")
