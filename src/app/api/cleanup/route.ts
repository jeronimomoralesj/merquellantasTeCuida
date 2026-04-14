import { NextResponse } from 'next/server';
import { GridFSBucket, ObjectId } from 'mongodb';
import { getDb } from '../../../lib/db';

// GET /api/cleanup — delete expired uploads (calendar videos/images past their date)
// Can be called by a cron job or manually
export async function GET() {
  const db = await getDb();
  const bucket = new GridFSBucket(db, { bucketName: 'uploads' });
  const now = new Date();

  // Delete expired legacy base64 files
  const legacyResult = await db.collection('file_uploads').deleteMany({
    expires_at: { $ne: null, $lt: now },
  });

  // Delete expired GridFS files
  const expiredGridFiles = await db.collection('uploads.files').find({
    'metadata.expires_at': { $ne: null, $lt: now },
  }).project({ _id: 1 }).toArray();

  let gridDeleted = 0;
  for (const f of expiredGridFiles) {
    try {
      await bucket.delete(f._id as ObjectId);
      gridDeleted++;
    } catch { /* ignore */ }
  }

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
    const urls: string[] = [];
    if (event.video_url?.startsWith('/api/upload/')) urls.push(event.video_url);
    if (event.image?.startsWith('/api/upload/')) urls.push(event.image);

    for (const url of urls) {
      const fileId = url.replace('/api/upload/', '');
      if (!ObjectId.isValid(fileId)) continue;
      const oid = new ObjectId(fileId);
      try { await bucket.delete(oid); } catch { /* not in GridFS */ }
      try { await db.collection('file_uploads').deleteOne({ _id: oid }); } catch { /* ignore */ }
    }

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
    legacy_files_deleted: legacyResult.deletedCount,
    gridfs_files_deleted: gridDeleted,
    events_cleared: cleared,
  });
}
