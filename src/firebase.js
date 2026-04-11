// ============================================================
// SETUP INSTRUCTIONS:
// 1. Go to https://console.firebase.google.com
// 2. Click "Create a project" (or "Add project")
// 3. Name it "weekly-planner" (or whatever you like)
// 4. Disable Google Analytics (not needed) and click Create
// 5. Once created, click the web icon </> to add a web app
// 6. Name it "weekly-planner" and click Register
// 7. Copy the firebaseConfig values and paste them below
// 8. Then go to Build > Authentication > Get Started
//    - Enable "Email/Password" sign-in method
// 9. Then go to Build > Firestore Database > Create Database
//    - Choose "Start in test mode" for now
//    - Pick the closest region to you
// 10. Then go to Build > Storage > Get Started
//    - Choose "Start in test mode"
//    - Pick the same region as your Firestore database
// ============================================================

import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyBR5ZlpIhYLgIRA3c6NwqLF1XgIs6Zg4bU",
  authDomain: "weekly-planner-f0bd6.firebaseapp.com",
  projectId: "weekly-planner-f0bd6",
  storageBucket: "weekly-planner-f0bd6.firebasestorage.app",
  messagingSenderId: "434228618561",
  appId: "1:434228618561:web:dc92712627224ae3b2edc0",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
});
export const storage = getStorage(app);

// Request persistent storage so the browser/Electron doesn't evict the IndexedDB cache.
// This makes offline data much more durable across sessions.
if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) {
  navigator.storage.persist().catch(() => {});
}
