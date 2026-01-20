// pages/api/delete-all-users.js
// or app/api/delete-all-users/route.js (for Next.js 13+ App Router)

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

// Initialize Firebase Admin if not already initialized
if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

// For Pages Router (Next.js 12 and below)
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const auth = getAuth();
    let deletedCount = 0;
    let nextPageToken;

    do {
      // List users in batches of 1000 (Firebase max)
      const listUsersResult = await auth.listUsers(1000, nextPageToken);
      
      const uids = listUsersResult.users.map(userRecord => userRecord.uid);
      
      if (uids.length > 0) {
        // Delete users in batch
        const deleteResult = await auth.deleteUsers(uids);
        deletedCount += deleteResult.successCount;
        
        if (deleteResult.failureCount > 0) {
          console.log(`Failed to delete ${deleteResult.failureCount} users`);
          deleteResult.errors.forEach(err => {
            console.log(`Error deleting user ${err.index}:`, err.error);
          });
        }
      }
      
      nextPageToken = listUsersResult.pageToken;
    } while (nextPageToken);

    return res.status(200).json({ 
      success: true, 
      deletedCount,
      message: `Successfully deleted ${deletedCount} users` 
    });
  } catch (error) {
    console.error('Error deleting users:', error);
    return res.status(500).json({ 
      error: 'Failed to delete users',
      details: error.message 
    });
  }
}

// For App Router (Next.js 13+)
// Uncomment this if you're using App Router instead
/*
export async function POST(request) {
  try {
    const auth = getAuth();
    let deletedCount = 0;
    let nextPageToken;

    do {
      const listUsersResult = await auth.listUsers(1000, nextPageToken);
      
      const uids = listUsersResult.users.map(userRecord => userRecord.uid);
      
      if (uids.length > 0) {
        const deleteResult = await auth.deleteUsers(uids);
        deletedCount += deleteResult.successCount;
        
        if (deleteResult.failureCount > 0) {
          console.log(`Failed to delete ${deleteResult.failureCount} users`);
          deleteResult.errors.forEach(err => {
            console.log(`Error deleting user ${err.index}:`, err.error);
          });
        }
      }
      
      nextPageToken = listUsersResult.pageToken;
    } while (nextPageToken);

    return Response.json({ 
      success: true, 
      deletedCount,
      message: `Successfully deleted ${deletedCount} users` 
    });
  } catch (error) {
    console.error('Error deleting users:', error);
    return Response.json({ 
      error: 'Failed to delete users',
      details: error.message 
    }, { status: 500 });
  }
}
*/