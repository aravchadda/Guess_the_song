#!/bin/bash

# Script to compress and convert all videos to MP4 format
# Uses H.264 codec with CRF 23 for good quality/size balance

cd "$(dirname "$0")/../frontend/public" || exit 1

echo "🎬 Starting video compression and conversion..."
echo ""

# Function to compress/convert a video
compress_video() {
    local input="$1"
    local output="$2"
    
    if [ ! -f "$input" ]; then
        echo "⚠️  File not found: $input"
        return 1
    fi
    
    echo "📹 Processing: $input"
    
    # Get file size before
    local size_before=$(du -h "$input" | cut -f1)
    
    # Convert/compress using H.264 with CRF 23 (good quality, smaller size)
    # -c:v libx264: Use H.264 codec
    # -crf 23: Quality setting (18-28 range, 23 is good balance)
    # -preset medium: Encoding speed vs compression (medium is good balance)
    # -c:a aac: Audio codec
    # -b:a 128k: Audio bitrate
    # -movflags +faststart: Optimize for web streaming
    ffmpeg -i "$input" \
        -c:v libx264 \
        -crf 23 \
        -preset medium \
        -c:a aac \
        -b:a 128k \
        -movflags +faststart \
        -y \
        "$output" 2>/dev/null
    
    if [ $? -eq 0 ]; then
        local size_after=$(du -h "$output" | cut -f1)
        echo "   ✅ Done: $size_before → $size_after"
        echo ""
        return 0
    else
        echo "   ❌ Failed to process: $input"
        echo ""
        return 1
    fi
}

# Convert .MOV files to .mp4
echo "🔄 Converting .MOV files to .mp4..."
for mov_file in *.MOV; do
    if [ -f "$mov_file" ]; then
        mp4_name="${mov_file%.MOV}.mp4"
        compress_video "$mov_file" "$mp4_name"
        
        # Remove original .MOV file after successful conversion
        if [ -f "$mp4_name" ]; then
            echo "   🗑️  Removing original: $mov_file"
            rm "$mov_file"
        fi
    fi
done

# Compress existing .mp4 files (create compressed versions)
echo "🗜️  Compressing existing .mp4 files..."
for mp4_file in *.mp4; do
    if [ -f "$mp4_file" ]; then
        compressed_name="${mp4_file%.mp4}_compressed.mp4"
        compress_video "$mp4_file" "$compressed_name"
        
        # Replace original with compressed version if compression was successful
        if [ -f "$compressed_name" ]; then
            # Compare file sizes
            original_size=$(stat -f%z "$mp4_file" 2>/dev/null || stat -c%s "$mp4_file" 2>/dev/null)
            compressed_size=$(stat -f%z "$compressed_name" 2>/dev/null || stat -c%s "$compressed_name" 2>/dev/null)
            
            if [ "$compressed_size" -lt "$original_size" ]; then
                echo "   🔄 Replacing original with compressed version..."
                mv "$compressed_name" "$mp4_file"
            else
                echo "   ⚠️  Compressed version is larger, keeping original..."
                rm "$compressed_name"
            fi
        fi
    fi
done

echo "✨ All videos processed!"
echo ""
echo "📊 Summary:"
echo "   - .MOV files converted to .mp4"
echo "   - .mp4 files compressed (if smaller)"

