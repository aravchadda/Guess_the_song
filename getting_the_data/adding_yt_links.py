import pandas as pd
from googleapiclient.discovery import build
import time

# Your existing API key
YOUTUBE_API_KEY = 'AIzaSyDRcsUa8vFdemu9DSzr4sPGHSimpK5ePiY'

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

# Initialize ViewCount column if it doesn't exist
if 'ViewCount' not in df.columns:
    df['ViewCount'] = None

# Track indices to remove (songs with less than 1 million views)
indices_to_remove = []

# ============================================
# PROCESS ROWS 0-99
# ============================================
start_idx = 0
end_idx = 99
print(f"\n🔄 Processing rows {start_idx} to {end_idx}...")

for index, row in df.iterrows():
    if index < start_idx or index > end_idx:
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

# ============================================
# PROCESS ROWS 100-199 (COMMENTED - UNCOMMENT TO RUN)
# ============================================
# start_idx = 100
# end_idx = 199
# print(f"\n🔄 Processing rows {start_idx} to {end_idx}...")
# 
# for index, row in df.iterrows():
#     if index < start_idx or index > end_idx:
#         continue
#     
#     song = row['Song_Name']
#     artist = row['Artists']
#     print(f"Searching YouTube for: {song} by {artist}")
#     try:
#         link, views = search_youtube_by_title(song, artist)
#         
#         if link and views:
#             if views < 1000000:
#                 print(f"🗑️  Skipping {song} - view count {views:,} is below 1 million")
#                 indices_to_remove.append(index)
#             else:
#                 df.at[index, 'YouTube_Link'] = link
#                 df.at[index, 'ViewCount'] = views
#                 print(f"✅ Found: {link} with {views:,} views")
#         else:
#             print(f"❌ No video found for {song}")
#             indices_to_remove.append(index)
#     except Exception as e:
#         print(f"❌ Error with {song}: {e}")
#         indices_to_remove.append(index)
#     
#     time.sleep(1)  # To avoid hitting rate limits

# ============================================
# PROCESS ROWS 200-299 (COMMENTED - UNCOMMENT TO RUN)
# ============================================
# start_idx = 200
# end_idx = 299
# print(f"\n🔄 Processing rows {start_idx} to {end_idx}...")
# 
# for index, row in df.iterrows():
#     if index < start_idx or index > end_idx:
#         continue
#     
#     song = row['Song_Name']
#     artist = row['Artists']
#     print(f"Searching YouTube for: {song} by {artist}")
#     try:
#         link, views = search_youtube_by_title(song, artist)
#         
#         if link and views:
#             if views < 1000000:
#                 print(f"🗑️  Skipping {song} - view count {views:,} is below 1 million")
#                 indices_to_remove.append(index)
#             else:
#                 df.at[index, 'YouTube_Link'] = link
#                 df.at[index, 'ViewCount'] = views
#                 print(f"✅ Found: {link} with {views:,} views")
#         else:
#             print(f"❌ No video found for {song}")
#             indices_to_remove.append(index)
#     except Exception as e:
#         print(f"❌ Error with {song}: {e}")
#         indices_to_remove.append(index)
#     
#     time.sleep(1)  # To avoid hitting rate limits

# ============================================
# PROCESS ROWS 300-END (COMMENTED - UNCOMMENT TO RUN)
# ============================================
# start_idx = 300
# end_idx = len(df) - 1
# print(f"\n🔄 Processing rows {start_idx} to {end_idx}...")
# 
# for index, row in df.iterrows():
#     if index < start_idx:
#         continue
#     
#     song = row['Song_Name']
#     artist = row['Artists']
#     print(f"Searching YouTube for: {song} by {artist}")
#     try:
#         link, views = search_youtube_by_title(song, artist)
#         
#         if link and views:
#             if views < 1000000:
#                 print(f"🗑️  Skipping {song} - view count {views:,} is below 1 million")
#                 indices_to_remove.append(index)
#             else:
#                 df.at[index, 'YouTube_Link'] = link
#                 df.at[index, 'ViewCount'] = views
#                 print(f"✅ Found: {link} with {views:,} views")
#         else:
#             print(f"❌ No video found for {song}")
#             indices_to_remove.append(index)
#     except Exception as e:
#         print(f"❌ Error with {song}: {e}")
#         indices_to_remove.append(index)
#     
#     time.sleep(1)  # To avoid hitting rate limits

# Remove songs with less than 1 million views
if indices_to_remove:
    print(f"\n🗑️  Removing {len(indices_to_remove)} songs with less than 1 million views...")
    df = df.drop(indices_to_remove)

# Save results to the CSV
df.to_csv('spotify_playlist_tracks.csv', index=False)
print("\n✅ Done! Results saved to spotify_playlist_tracks.csv")
