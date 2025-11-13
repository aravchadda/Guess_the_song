#!/usr/bin/env python3
"""
Trim silence from the beginning of audio clips in preprocessed folder.
Removes leading silence/low volume and deletes files that are entirely silent.
"""
import math
import os
from pathlib import Path
from pydub import AudioSegment
from pydub.silence import detect_leading_silence

# Configuration
PREPROCESSED_DIR = Path(__file__).parent.parent / "backend" / "preprocessed"
SILENCE_THRESHOLD = -40  # dBFS threshold for silence detection (lower = more sensitive)
MIN_SILENCE_LEN = 100  # Minimum silence length in ms to consider it as silence
KEEP_LEADING_SILENCE = 0  # Keep this many ms of silence at the start (for natural sound)

def detect_audio_start(audio: AudioSegment, silence_thresh: float = SILENCE_THRESHOLD) -> int:
    """
    Find the first point where audio exceeds the silence threshold.
    Returns the position in milliseconds.
    """
    # Convert to mono for analysis if stereo
    if audio.channels > 1:
        audio_mono = audio.set_channels(1)
    else:
        audio_mono = audio
    
    # Check in chunks of 10ms for efficiency
    chunk_size = 10  # ms
    for i in range(0, len(audio_mono), chunk_size):
        chunk = audio_mono[i:i + chunk_size]
        
        # Use pydub's built-in dBFS property (more reliable)
        db = chunk.dBFS
        
        # Handle case where chunk is completely silent (dBFS returns -inf)
        if db == float('-inf'):
            continue
        
        # If this chunk has significant audio, return its start position
        if db > silence_thresh:
            return max(0, i - KEEP_LEADING_SILENCE)
    
    # No audio found
    return None

def process_audio_file(file_path: Path) -> tuple[bool, str]:
    """
    Process a single audio file: trim leading silence or delete if entirely silent.
    Returns (success, message)
    """
    try:
        # Load audio file
        audio = AudioSegment.from_mp3(file_path)
        
        # Find where audio actually starts
        audio_start = detect_audio_start(audio)
        
        if audio_start is None:
            # Entire file is silent, delete it
            file_path.unlink()
            return True, "deleted (entirely silent)"
        
        if audio_start == 0:
            # No trimming needed
            return True, "no trimming needed"
        
        # Trim the audio
        trimmed = audio[audio_start:]
        
        # Export back to the same file
        trimmed.export(file_path, format="mp3", bitrate="192k")
        
        trimmed_seconds = audio_start / 1000.0
        return True, f"trimmed {trimmed_seconds:.2f}s from start"
        
    except Exception as e:
        return False, f"error: {str(e)}"

def main():
    """Process all audio files in the preprocessed directory."""
    if not PREPROCESSED_DIR.exists():
        print(f"Error: Directory not found: {PREPROCESSED_DIR}")
        return
    
    print(f"Processing audio files in: {PREPROCESSED_DIR}")
    print(f"Silence threshold: {SILENCE_THRESHOLD} dBFS")
    print("-" * 60)
    
    processed = 0
    trimmed = 0
    deleted = 0
    errors = 0
    
    # Process each song folder
    for song_folder in sorted(PREPROCESSED_DIR.iterdir()):
        if not song_folder.is_dir():
            continue
        
        print(f"\n📁 {song_folder.name}")
        
        # Process each level file
        for level in ["level1.mp3", "level2.mp3", "level3.mp3"]:
            level_path = song_folder / level
            
            if not level_path.exists():
                continue
            
            processed += 1
            success, message = process_audio_file(level_path)
            
            if success:
                if "trimmed" in message:
                    trimmed += 1
                    print(f"  ✓ {level}: {message}")
                elif "deleted" in message:
                    deleted += 1
                    print(f"  🗑️  {level}: {message}")
                else:
                    print(f"  ⊙ {level}: {message}")
            else:
                errors += 1
                print(f"  ✗ {level}: {message}")
    
    print("\n" + "=" * 60)
    print(f"Summary:")
    print(f"  Total processed: {processed}")
    print(f"  Trimmed: {trimmed}")
    print(f"  Deleted (silent): {deleted}")
    print(f"  No change: {processed - trimmed - deleted - errors}")
    print(f"  Errors: {errors}")
    print("=" * 60)

if __name__ == "__main__":
    main()
