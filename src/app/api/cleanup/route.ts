import { NextResponse } from 'next/server';
import { getDb } from '../../../lib/db';

// GET /api/cleanup — delete expired file_uploads (calendar videos/images past their date)
// Can be called by a cron job or manually
export async function GET() {
  const db = await getDb();

  // Delete file_uploads that have expired
  const result = await db.collection('file_uploads').deleteMany({
    expires_at: { $ne: null, $lt: new Date() },
  });

  // Also clear the video_url and image references from calendar events
  // for events that happened before today
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(23, 59, 59, 999);

  const expiredEvents = await db.collection('calendar').find({
    date: { $lt: yesterday.toISOString() },
    $or: [
      { video_url: { $ne: null, $regex: /^\/api\/upload\// } },
      { image: { $ne: null, $regex: /^\/api\/upload\// } },
    ],
  }).toArray();

  let cleared = 0;
  for (const event of expiredEvents) {
    // Delete the referenced files from file_uploads
    const urls: string[] = [];
    if (event.video_url?.startsWith('/api/upload/')) urls.push(event.video_url);
    if (event.image?.startsWith('/api/upload/')) urls.push(event.image);

    for (const url of urls) {
      const fileId = url.replace('/api/upload/', '');
      try {
        const { ObjectId } = await import('mongodb');
        if (ObjectId.isValid(fileId)) {
          await db.collection('file_uploads').deleteOne({ _id: new ObjectId(fileId) });
        }
      } catch { /* ignore */ }
    }

    // Clear the URLs from the event (keep the event itself)
    await db.collection('calendar').updateOne(
      { _id: event._id },
      {
        $set: {
          ...(event.video_url?.startsWith('/api/upload/') ? { video_url: null, video_path: null } : {}),
          ...(event.image?.startsWith('/api/upload/') ? { image: null } : {}),
        },
      }
    );
    cleared++;
  }

  return NextResponse.json({
    success: true,
    expired_files_deleted: result.deletedCount,
    events_cleared: cleared,
  });
}
