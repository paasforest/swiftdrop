import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';

// Firebase configuration
// TODO: Replace with your actual Firebase project credentials
const firebaseConfig = {
  // Prefer Expo env vars if set; otherwise fall back to your provided RTDB config.
  apiKey:
    process.env.EXPO_PUBLIC_FIREBASE_API_KEY ||
    'AIzaSyBRlGO-9LJpmfOrooKQK3tLspAFlucreJ0',
  authDomain:
    process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ||
    'swiftdrop-c0110.firebaseapp.com',
  databaseURL:
    process.env.EXPO_PUBLIC_FIREBASE_DATABASE_URL ||
    'https://swiftdrop-c0110-default-rtdb.europe-west1.firebasedatabase.app',
  projectId:
    process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || 'swiftdrop-c0110',
  storageBucket:
    process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ||
    'swiftdrop-c0110.firebasestorage.app',
  messagingSenderId:
    process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ||
    '129983146930',
  appId:
    process.env.EXPO_PUBLIC_FIREBASE_APP_ID ||
    '1:129983146930:web:68bfe3599931722d8ad2ab',
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Realtime Database
const database = getDatabase(app);

export { app, database };
