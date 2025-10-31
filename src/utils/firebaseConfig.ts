import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getDatabase, type Database } from 'firebase/database';

// Firebase configuration
// Values from environment variables, with fallback to your configured values
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyBZewVYHndKa7p2-PL8bmWMNDurBqmixac',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'word-master-sync.firebaseapp.com',
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || 'https://word-master-sync-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'word-master-sync',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'word-master-sync.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '943536020597',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:943536020597:web:07c263d328789617bdac3c'
};

// Initialize Firebase
let app: FirebaseApp | null = null;
let database: Database | null = null;

try {
  // Check if Firebase config is available
  if (firebaseConfig.apiKey && firebaseConfig.databaseURL) {
    app = initializeApp(firebaseConfig);
    database = getDatabase(app);
    console.log('Firebase initialized successfully');
  } else {
    console.warn('Firebase config not found. Using BroadcastChannel only for same-device sync.');
  }
} catch (error) {
  console.error('Error initializing Firebase:', error);
  console.warn('Falling back to BroadcastChannel only for same-device sync.');
}

export { app, database, firebaseConfig };

