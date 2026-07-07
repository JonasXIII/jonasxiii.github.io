// auth.js - Google sign-in for the site owner. Anyone can sign in (harmless -
// it grants no access on its own), but only the account matching OWNER_UID
// is allowed to write, both client-side (isOwner(), checked by state.js
// before every mutation) and server-side (Firestore Security Rules, which are
// the real enforcement - the client check just avoids a confusing failed
// write for anyone who isn't you).
import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
} from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js';
import { auth, OWNER_UID } from './firebase.js';

const provider = new GoogleAuthProvider();

export function signInWithGoogle() {
  return signInWithPopup(auth, provider);
}

export function signOutUser() {
  return firebaseSignOut(auth);
}

export function getCurrentUser() {
  return auth.currentUser;
}

export function isOwner() {
  return !!auth.currentUser && auth.currentUser.uid === OWNER_UID;
}

export function onAuthChange(callback) {
  return onAuthStateChanged(auth, callback);
}
