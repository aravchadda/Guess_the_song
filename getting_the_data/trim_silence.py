#!/usr/bin/env python3
"""
Trim + process MP3 audio:

1) Load MP3 → decode
2) Trim leading audio until its dBFS reaches TRIM_THRESHOLD_DB (absolute dBFS)
3) If the file NEVER reaches the threshold, make it a 0.1s silent file
4) Save trimmed audio as WAV (lossless temp)
5) Run ffmpeg filters, encode final MP3
"""

import subprocess
from pathlib import Path
from pydub import AudioSegment
import math
import sys

# ---------- CONFIG ----------
ROOT_FOLDER = Path("backend/preprocessed")
TRIM_THRESHOLD_DB = 5.0      # Absolute dBFS threshold to stop trimming
WINDOW_MS = 50                # Window size in ms for scanning
TEMP_SUFFIX = ".tmp_trim.wav"
FINAL_SUFFIX = "_final.mp3"

FFMPEG_BITRATE = "320k"
FFMPEG_FILTERS = (
    "afftdn=nf=-20,"                             # denoise (valid range for nf is -80..-20)
    "acompressor=threshold=-22dB:ratio=2:attack=10:release=120,"
    "loudnorm=I=-14:TP=-1:LRA=11"
)

# ---------- SINGLE FILE MODE ----------
SINGLE_FILE = r"C:\Users\dell\Desktop\Guess_the_song\backend\preprocessed\Photograph\level2.mp3"
# --------------------------------------


def first_position_reaching_threshold(audio: AudioSegment, threshold_db: float, window_ms: int) -> int:
    """
    Return ms index of the first window whose dBFS >= threshold_db.
    If none found, return -1.
    """
    length = len(audio)
    pos = 0
    while pos < length:
        chunk = audio[pos: pos + window_ms]
        chunk_dbfs = chunk.dBFS
        if math.isfinite(chunk_dbfs) and chunk_dbfs >= threshold_db:
            return pos
        pos += window_ms
    return -1  # never reaches threshold


def trim_leading_to_threshold_wav(input_path: Path, temp_out_wav: Path,
                                  threshold_db: float, window_ms: int) -> int:
    """
    Trim leading audio up to the first window >= threshold_db.
    If file NEVER reaches threshold, return a 0.1s WAV file.
    """
    audio = AudioSegment.from_file(input_path)

    # 1) Try absolute threshold detection
    pos = first_position_reaching_threshold(audio, threshold_db, window_ms)

    if pos == -1:
        # --------- NEW BEHAVIOR: NO THRESHOLD FOUND → MAKE FILE 0.1s ---------
        print("  File never reaches threshold → making it a 0.1s file.")
        tiny = AudioSegment.silent(duration=100)  # 0.1 seconds = 100 ms
        tiny.export(temp_out_wav, format="wav")
        return 0

    # 2) Threshold found: trim normally
    if pos <= 0:
        audio.export(temp_out_wav, format="wav")
        return 0

    trimmed = audio[pos:]
    trimmed.export(temp_out_wav, format="wav")
    return pos


def run_ffmpeg_filters(input_file: Path, output_file: Path, filters: str, bitrate: str):
    """Run ffmpeg with filters and encode final MP3."""
    cmd = [
        "ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
        "-i", str(input_file),
        "-af", filters,
        "-b:a", bitrate,
        str(output_file)
    ]
    subprocess.run(cmd, check=True)


def process_file(mp3_path: Path):
    print(f"\nProcessing: {mp3_path}")
    temp_wav = mp3_path.with_suffix(TEMP_SUFFIX)
    final_path = mp3_path.with_name(mp3_path.stem + FINAL_SUFFIX)

    try:
        start_trim_ms = trim_leading_to_threshold_wav(
            mp3_path, temp_wav, TRIM_THRESHOLD_DB, WINDOW_MS
        )

        if start_trim_ms > 0:
            print(f"  Trimmed {start_trim_ms} ms (first window >= {TRIM_THRESHOLD_DB} dBFS).")

        print("  Running ffmpeg filters...")
        run_ffmpeg_filters(temp_wav, final_path, FFMPEG_FILTERS, FFMPEG_BITRATE)

        print(f"  Saved final file: {final_path}")

    except Exception as e:
        print(f"ERROR processing {mp3_path}: {e}", file=sys.stderr)

    finally:
        if temp_wav.exists():
            temp_wav.unlink()


def main():
    # ---------- SINGLE FILE MODE ----------
    if SINGLE_FILE:
        single_path = Path(SINGLE_FILE)
        if not single_path.exists():
            print(f"Error: SINGLE_FILE not found: {single_path}")
            return
        process_file(single_path)
        return

    print("No mode selected. Set SINGLE_FILE or enable batch mode.")


if __name__ == "__main__":
    main()
