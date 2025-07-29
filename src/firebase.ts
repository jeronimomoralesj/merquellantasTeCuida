// src/firebase.ts
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Your config from environment variables
const firebaseConfig = {
  apiKey:             process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain:         process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId:          process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket:      process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId:  process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId:              process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
};

// Main app (used for normal auth and Firestore)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth    = getAuth(app);
export const db      = getFirestore(app);
export const storage = getStorage(app);

// Secondary app (used for safe user creation only)
const secondaryApp = getApps().find(app => app.name === 'Secondary') 
  ?? initializeApp(firebaseConfig, 'Secondary');
export const secondaryAuth = getAuth(secondaryApp);
