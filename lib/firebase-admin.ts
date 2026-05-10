// Server-only Firestore client. Never import this from a "use client" file.
//
// Why admin SDK and not the web SDK on the server:
//   1. The re-extraction job (step 11) writes to entries' `extracted` map
//      WITHOUT changing the `submittedBy` field. The Firestore rules
//      require submittedBy on every write, so the only legitimate way to
//      do this kind of orchestration write is through admin (which
//      bypasses rules entirely).
//   2. We want to avoid the awkwardness of "is there a real auth user
//      in this request?" since identity is just a typed name on the client.
//
// Auth via service account JSON pasted as a single env var
// (FIREBASE_SERVICE_ACCOUNT_JSON). See .env.local.example for how to get it.

import "server-only";
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

let _app: App | null = null;
let _db: Firestore | null = null;

function ensureApp(): App {
  if (_app) return _app;
  const existing = getApps()[0];
  if (existing) {
    _app = existing;
    return _app;
  }
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_JSON is not set. See .env.local.example for how to obtain a service-account JSON.",
    );
  }
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_JSON is set but isn't valid JSON. Paste the entire service-account file as a single-line value.",
    );
  }
  _app = initializeApp({
    credential: cert(parsed as Parameters<typeof cert>[0]),
  });
  return _app;
}

export function getAdminDb(): Firestore {
  if (_db) return _db;
  _db = getFirestore(ensureApp());
  return _db;
}
