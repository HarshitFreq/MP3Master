import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const downloadsDir = path.join(process.cwd(), 'tmp', 'downloads');
    if (!fs.existsSync(downloadsDir)) {
      return NextResponse.json({ success: true, deletedCount: 0 });
    }

    const files = fs.readdirSync(downloadsDir);
    const now = Date.now();
    const MAX_AGE_MS = 10 * 60 * 1000; // 10 minutes
    let deletedCount = 0;

    for (const file of files) {
      const filePath = path.join(downloadsDir, file);
      try {
        const stats = fs.statSync(filePath);
        if (now - stats.mtimeMs > MAX_AGE_MS) {
          fs.unlinkSync(filePath);
          deletedCount++;
        }
      } catch {
        // Skip
      }
    }

    return NextResponse.json({ success: true, deletedCount });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Cleanup failed' },
      { status: 500 }
    );
  }
}
