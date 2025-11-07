import os
import spotipy
from spotipy.oauth2 import SpotifyClientCredentials
import pandas as pd

def get_playlist_tracks(sp, playlist_id_or_url):
    """
    Extract all tracks from a Spotify playlist (supports URL or ID).
    Returns a DataFrame with columns: Song Name, Artist(s)
    """
    # Normalize playlist ID from URL if needed
    playlist_id = playlist_id_or_url
    if 'spotify.com' in playlist_id_or_url:
        playlist_id = playlist_id_or_url.split('playlist/')[-1].split('?')[0]

    # Try to fetch playlist name (optional, for logging)
    try:
        playlist_meta = sp.playlist(playlist_id, fields='name,id')
        playlist_name = playlist_meta.get('name', playlist_id)
    except Exception:
        playlist_name = playlist_id  # fallback

    print(f"Fetching tracks from playlist: {playlist_name} ({playlist_id})")

    tracks_data = []
    results = sp.playlist_tracks(playlist_id)

    # Paginate through results
    while results:
        for item in results.get('items', []):
            track = item.get('track')
            if track is None:
                continue  # skip local/removed tracks

            track_name = track.get('name')
            artists = ', '.join([artist.get('name') for artist in track.get('artists', [])])

            tracks_data.append({
                'Song Name': track_name,
                'Artist(s)': artists
            })

        # Next page
        if results.get('next'):
            results = sp.next(results)
            print(f"Fetched {len(tracks_data)} tracks so far from {playlist_name}...")
        else:
            break

    print(f"Total tracks fetched from {playlist_name}: {len(tracks_data)}")
    return pd.DataFrame(tracks_data)


def fetch_multiple_playlists(playlists, client_id, client_secret, output_file='spotify_playlist_tracks.csv'):
    """
    Fetch tracks for multiple playlists and append/update output CSV.
    Keeps only 'Song Name' and 'Artist(s)' columns.
    Removes duplicates based only on those two columns.
    """
    client_credentials_manager = SpotifyClientCredentials(
        client_id=client_id,
        client_secret=client_secret
    )
    sp = spotipy.Spotify(client_credentials_manager=client_credentials_manager)

    dfs = []
    for p in playlists:
        try:
            df = get_playlist_tracks(sp, p)
            if not df.empty:
                dfs.append(df)
        except Exception as e:
            print(f"Warning: failed to fetch playlist {p}: {e}")

    if not dfs:
        print("No tracks fetched from any playlist.")
        return

    new_df = pd.concat(dfs, ignore_index=True)

    # If file exists, merge with it
    if os.path.exists(output_file):
        try:
            existing_df = pd.read_csv(output_file)
            combined = pd.concat([existing_df, new_df], ignore_index=True)
            combined = combined.drop_duplicates(subset=['Song Name', 'Artist(s)'], keep='first')
            combined.to_csv(output_file, index=False)
            print(f"Updated file saved to {output_file} ({len(combined)} total unique tracks).")
        except Exception as e:
            print(f"Error reading existing CSV ({e}). Writing new file instead.")
            new_df.drop_duplicates(subset=['Song Name', 'Artist(s)']).to_csv(output_file, index=False)
            print(f"Wrote {len(new_df)} unique tracks to {output_file}.")
    else:
        # Write fresh
        new_df.drop_duplicates(subset=['Song Name', 'Artist(s)']).to_csv(output_file, index=False)
        print(f"Wrote {len(new_df)} unique tracks to new file {output_file}.")


if __name__ == "__main__":
    # Spotify credentials
    CLIENT_ID = '0f5f408c76494254ac81a52f6f2b78f2'
    CLIENT_SECRET = '0a2e9fef88d4441bb8f19c2309fc3090'

    # List of playlist IDs or URLs
    PLAYLISTS = [
        'https://open.spotify.com/playlist/6i2Qd6OpeRBAzxfscNXeWp?si=c75919d9d12c434e',
        'https://open.spotify.com/playlist/30gaLMEHOtdG9OGWPbCqic?si=3906cb1e82494aec',
        'https://open.spotify.com/playlist/4wJLkwU84uscxJ7SOlmUX1?si=cb3ad75d14494ad7',
        'https://open.spotify.com/playlist/5ABHKGoOzxkaa28ttQV9sE?si=d8736294a33f4721'
    ]

    OUTPUT_FILE = 'spotify_playlist_tracks.csv'

    # Fetch and save
    fetch_multiple_playlists(PLAYLISTS, CLIENT_ID, CLIENT_SECRET, output_file=OUTPUT_FILE)
