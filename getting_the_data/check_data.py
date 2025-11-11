import pandas as pd

df = pd.read_csv('spotify_playlist_tracks.csv')
df.columns = df.columns.str.strip()
df['ViewCount'] = pd.to_numeric(df['ViewCount'], errors='coerce')

print(f'Total songs: {len(df)}')
print(f'Songs with view counts: {df["ViewCount"].notna().sum()}')
print(f'Songs without view counts: {df["ViewCount"].isna().sum()}')
print(f'\nView count stats:')
print(df['ViewCount'].describe())
print(f'\nBottom 10 songs by view count:')
bottom_10 = df.nsmallest(10, 'ViewCount', keep='all')[['Song_Name', 'Artists', 'ViewCount']]
print(bottom_10.to_string())

