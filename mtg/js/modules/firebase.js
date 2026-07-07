// firebase.js - Firebase app initialization.
//
// The config below is NOT a secret - Firebase's web config is meant to be
// public and safe to commit. Security comes from Firestore Security Rules
// (see firestore.rules at the repo root) plus Firebase Auth, not from hiding
// these values. See the setup instructions for where to get them.
//
// TODO (one-time setup): replace firebaseConfig and OWNER_UID below.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js';

// From: Firebase Console -> Project Settings -> General -> Your apps -> Web app.
const firebaseConfig = {
  apiKey: 'REPLACE_ME',
  authDomain: 'REPLACE_ME.firebaseapp.com',
  projectId: 'REPLACE_ME',
  storageBucket: 'REPLACE_ME.appspot.com',
  messagingSenderId: 'REPLACE_ME',
  appId: 'REPLACE_ME',
};

// From: Firebase Console -> Authentication -> Users, after signing in once via
// this app's "Sign in" button. This is what Firestore Security Rules check
// against to allow writes, and what the client uses to know it's you (see
// isOwner() in auth.js).
export const OWNER_UID = 'REPLACE_WITH_YOUR_UID';

const app = initializeApp(firebaseConfig);

// Persistent local cache: queues writes made while offline and syncs them
// automatically once back online. This is what makes "edit from anywhere,
// even with spotty wifi" actually work, for free.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});

export const auth = getAuth(app);
