#!/usr/bin/env node
// migrate_to_firestore.mjs - ONE-OFF script: uploads the current
// mtg/data/*.json files into Firestore under users/{ownerUid}/... Run this
// once, locally, after setting up your Firebase project (see the setup steps
// in the migration plan / conversation). This script is never deployed to the
// site and is not imported by anything in mtg/js/.
//
// Requires: npm install firebase-admin  (run in the repo root or scripts/,
// wherever you set up a package.json for this)
//
// Usage:
//   node scripts/migrate_to_firestore.mjs <path-to-service-account-key.json> <owner-uid> [data-dir]
//
// The service-account key is a sensitive credential - keep it out of git
// (see the .gitignore entry added alongside this script) and delete the file
// once the migration is done; it's only needed for this one-time run.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const [, , keyPath, ownerUid, dataDirArg] = process.argv;
if (!keyPath || !ownerUid) {
  console.error('Usage: node scripts/migrate_to_firestore.mjs <service-account-key.json> <owner-uid> [data-dir]');
  process.exit(1);
}

const dataDir = dataDirArg || path.join(process.cwd(), 'mtg', 'data');

function loadJson(file) {
  return JSON.parse(readFileSync(path.join(dataDir, file), 'utf8'));
}

const serviceAccount = JSON.parse(readFileSync(keyPath, 'utf8'));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function migrate() {
  const collection = loadJson('collection.json');
  const decks = loadJson('decks.json');
  const binders = loadJson('binders.json');
  const boxes = loadJson('boxes.json');

  const userRef = db.collection('users').doc(ownerUid);

  let batch = db.batch();
  let opCount = 0;
  async function stageWrite(ref, data) {
    batch.set(ref, data);
    opCount += 1;
    if (opCount >= 400) { // stay comfortably under Firestore's 500-op batch limit
      await batch.commit();
      batch = db.batch();
      opCount = 0;
    }
  }

  for (const [cardKey, entry] of Object.entries(collection)) {
    await stageWrite(userRef.collection('collectionCards').doc(cardKey), entry);
  }
  for (const deck of decks) {
    await stageWrite(userRef.collection('decks').doc(deck.id), deck);
  }
  for (const binder of binders) {
    await stageWrite(userRef.collection('binders').doc(binder.id), binder);
  }
  for (const box of boxes) {
    await stageWrite(userRef.collection('boxes').doc(box.id), box);
  }

  if (opCount > 0) await batch.commit();

  console.log(
    `Migrated ${Object.keys(collection).length} collection cards, ${decks.length} decks, ` +
    `${binders.length} binders, ${boxes.length} boxes to users/${ownerUid} in Firestore.`
  );
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
