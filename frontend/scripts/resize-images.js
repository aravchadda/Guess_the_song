const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const albumCoversDir = path.join(__dirname, '../public/album-covers');
const targetSize = 300;

async function resizeAndCompressImages() {
  try {
    // Read all files in the album-covers directory
    const files = fs.readdirSync(albumCoversDir);
    
    // Filter for image files
    const imageFiles = files.filter(file => {
      const ext = path.extname(file).toLowerCase();
      return ['.jpg', '.jpeg', '.png', '.webp'].includes(ext);
    });

    console.log(`Found ${imageFiles.length} images to process...`);

    // Process each image
    for (const file of imageFiles) {
      const inputPath = path.join(albumCoversDir, file);
      const ext = path.extname(file).toLowerCase();
      
      // Determine output format (keep original format, but optimize)
      const outputPath = inputPath; // Overwrite original
      
      try {
        console.log(`Processing: ${file}`);
        
        // Get image metadata
        const metadata = await sharp(inputPath).metadata();
        console.log(`  Original size: ${metadata.width}x${metadata.height}`);
        
        // Create temporary output path
        const outputPath = path.join(albumCoversDir, `temp_${file.replace(ext, '.jpg')}`);
        
        // Resize and compress to temporary file
        await sharp(inputPath)
          .resize(targetSize, targetSize, {
            fit: 'cover', // Cover the entire area, may crop
            position: 'center'
          })
          .jpeg({ quality: 85, mozjpeg: true }) // Convert to JPEG with compression
          .toFile(outputPath);
        
        // Replace original with resized version
        const finalPath = path.join(albumCoversDir, file.replace(ext, '.jpg'));
        if (inputPath !== finalPath) {
          // If extension changed, delete original
          fs.unlinkSync(inputPath);
        }
        // Move temp file to final location
        fs.renameSync(outputPath, finalPath);
        
        if (ext !== '.jpg') {
          console.log(`  Converted ${ext} to .jpg`);
        }
        
        // Get new metadata
        const newMetadata = await sharp(finalPath).metadata();
        const stats = fs.statSync(finalPath);
        console.log(`  New size: ${newMetadata.width}x${newMetadata.height}`);
        console.log(`  File size: ${(stats.size / 1024).toFixed(2)} KB`);
        console.log(`  ✓ Completed: ${file}\n`);
      } catch (error) {
        console.error(`  ✗ Error processing ${file}:`, error.message);
      }
    }

    console.log('All images processed successfully!');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

resizeAndCompressImages();

