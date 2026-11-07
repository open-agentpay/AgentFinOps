import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
};

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ slug?: string[] }> }
) {
  const { slug } = await context.params;
  const docsDir = path.join(process.cwd(), 'public', 'docs');

  let relativePath = slug && slug.length > 0 ? slug.join('/') : '';
  if (!relativePath || relativePath === '/') {
    relativePath = 'index.html';
  }

  // Sanitize path against directory traversal
  const safeRelativePath = path.normalize(relativePath).replace(/^(\.\.(\/|\\|$))+/, '');
  let targetFile = path.join(docsDir, safeRelativePath);

  // Resolution order:
  // 1. Direct file match
  // 2. Append .html
  // 3. Append /index.html if directory
  if (!fs.existsSync(targetFile)) {
    if (fs.existsSync(`${targetFile}.html`)) {
      targetFile = `${targetFile}.html`;
    } else if (fs.existsSync(path.join(targetFile, 'index.html'))) {
      targetFile = path.join(targetFile, 'index.html');
    } else {
      const notFoundFile = path.join(docsDir, '404.html');
      if (fs.existsSync(notFoundFile)) {
        const notFoundContent = fs.readFileSync(notFoundFile);
        return new NextResponse(notFoundContent, {
          status: 404,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        });
      }
      return new NextResponse('Documentation page not found', { status: 404 });
    }
  } else if (fs.statSync(targetFile).isDirectory()) {
    const indexInDir = path.join(targetFile, 'index.html');
    if (fs.existsSync(indexInDir)) {
      targetFile = indexInDir;
    }
  }

  try {
    const ext = path.extname(targetFile).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    const content = fs.readFileSync(targetFile);

    return new NextResponse(content, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control':
          ext === '.html'
            ? 'no-cache, must-revalidate'
            : 'public, max-age=31536000, immutable',
      },
    });
  } catch (err) {
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
