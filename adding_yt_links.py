import pandas as pd
from googleapiclient.discovery import build
import time

# Your existing API key
YOUTUBE_API_KEY = 'AIzaSyBcjt0f5foEt6YW9yiBbAWFzQsqhNiTh-E'

def search_youtube_by_title(song_title, artist_name):
    youtube = build('youtube', 'v3', developerKey=YOUTUBE_API_KEY)
    search_query = f"{song_title} {artist_name}"

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
        return video_url
    return None

# Read the CSV
df = pd.read_csv('spotify_playlist_tracks.csv')

# Create a new column for links
df['YouTube_Link'] = None

# Loop through each row
for index, row in df.iterrows():
    song = row['Song_Name']
    artist = row['Artists']
    print(f"Searching YouTube for: {song} by {artist}")
    try:
        link = search_youtube_by_title(song, artist)
        df.at[index, 'YouTube_Link'] = link
        print(f"✅ Found: {link}")
    except Exception as e:
        print(f"❌ Error with {song}: {e}")
        df.at[index, 'YouTube_Link'] = None
    
    time.sleep(1)  # To avoid hitting rate limits

# Save results to a new CSV
df.to_csv('spotify_playlist_tracks.csv', index=False)
print("\n✅ Done! Results saved to songs_with_links.csv")
