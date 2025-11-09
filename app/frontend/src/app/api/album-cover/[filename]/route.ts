import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(
  request: NextRequest,
  { params }: { params: { filename: string } }
) {
  try {
    const filename = params.filename;
    
    // Path to album covers directory (one level up from frontend to app, then to album-covers)
    const albumCoversPath = path.join(process.cwd(), '..', 'album-covers', filename);
    
    // Check if file exists
    if (!fs.existsSync(albumCoversPath)) {
      return new NextResponse('Image not found', { status: 404 });
    }

    // Read the file
    const imageBuffer = fs.readFileSync(albumCoversPath);
    
    // Determine content type based on file extension
    const ext = path.extname(filename).toLowerCase();
    let contentType = 'image/jpeg';
    if (ext === '.png') contentType = 'image/png';
    if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
    if (ext === '.gif') contentType = 'image/gif';
    if (ext === '.webp') contentType = 'image/webp';

    return new NextResponse(imageBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    console.error('Error serving album cover:', error);
    return new NextResponse('Error loading image', { status: 500 });
  }
}

