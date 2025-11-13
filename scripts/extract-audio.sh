#!/bin/bash

# Script to extract audio from all song videos
# Outputs MP3 files for use in carousel

cd "$(dirname "$0")/../frontend/public" || exit 1

echo "🎵 Extracting audio from song videos..."
echo ""

# List of video files to extract audio from
videos=(
  "ariana.mp4"
  "bad-bunny.mp4"
  "kendrick.mp4"
  "single-ladies.mp4"
  "royals.mp4"
  "hard-times.mp4"
  "tame-impala.mp4"
)

# Create audio directory if it doesn't exist
mkdir -p audio

# Function to extract audio from a video
extract_audio() {
    local video="$1"
    local audio_name="${video%.mp4}.mp3"
    local output="audio/$audio_name"
    
    if [ ! -f "$video" ]; then
        echo "⚠️  Video not found: $video"
        return 1
    fi
    
    echo "🎤 Extracting audio from: $video"
    
    # Extract audio using ffmpeg
    # -i: input file
    # -vn: disable video
    # -acodec libmp3lame: use MP3 codec
    # -q:a 2: high quality audio (0-9, 2 is high quality)
    # -ar 44100: sample rate 44.1kHz
    # -ac 2: stereo audio
    ffmpeg -i "$video" \
        -vn \
        -acodec libmp3lame \
        -q:a 2 \
        -ar 44100 \
        -ac 2 \
        -y \
        "$output" 2>/dev/null
    
    if [ $? -eq 0 ]; then
        local size=$(du -h "$output" | cut -f1)
        echo "   ✅ Created: $output ($size)"
        echo ""
        return 0
    else
        echo "   ❌ Failed to extract audio from: $video"
        echo ""
        return 1
    fi
}

# Extract audio from all videos
for video in "${videos[@]}"; do
    extract_audio "$video"
done

echo "✨ Audio extraction complete!"
echo ""
echo "📊 Summary:"
echo "   - Audio files created in: frontend/public/audio/"
echo "   - Format: MP3, 44.1kHz, Stereo, High Quality"
