// updateCalendarDates.js

const admin = require('firebase-admin');
const path = require('path');

// 1. Load your service account key JSON file
//    Place it in the project root as "service-account.json"
const serviceAccount = require(path.join(__dirname, 'service-account.json'));

// 2. Initialize the Admin SDK with your service account
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function bumpDates() {
  const batchSize = 500;
  let lastDoc = null;

  try {
    while (true) {
      let q = db.collection('calendar').orderBy(admin.firestore.FieldPath.documentId()).limit(batchSize);
      if (lastDoc) {
        q = q.startAfter(lastDoc);
      }
      const snapshot = await q.get();
      if (snapshot.empty) break;

      const batch = db.batch();
      snapshot.docs.forEach(docSnap => {
        const data = docSnap.data();
        if (!data.date || !(data.date.toDate instanceof Function)) return;

        const original = data.date.toDate();
        // bump forward one day
        const bumped = new Date(original);
        bumped.setDate(bumped.getDate() + 1);

        batch.update(docSnap.ref, { date: admin.firestore.Timestamp.fromDate(bumped) });
      });

      await batch.commit();
      lastDoc = snapshot.docs[snapshot.docs.length - 1];
      console.log(`Updated batch up to ${lastDoc.id}`);
      if (snapshot.size < batchSize) break;
    }

    console.log('All calendar dates bumped by one day.');
  } catch (err) {
    console.error('Error bumping dates:', err);
  }
}

bumpDates();
