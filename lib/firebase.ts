"use client";

// Lazy Firebase web-SDK init.
//
// Why "OrNull" everywhere: we want `npm run build` to succeed even if no env
// vars are set (CI, fresh clone before .env.local exists, etc.). Hooks call
// these getters and bail to an empty-state branch when they return null.
//
// Why module-level singletons: `initializeApp` errors if called more than
// once with the same config. Caching keeps re-renders cheap too.

import { getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { env, firebaseConfigured } from "./env";

let _app: FirebaseApp | null = null;
let _auth: Auth | null = null;
let _db: Firestore | null = null;

function app(): FirebaseApp | null {
  if (!firebaseConfigured()) return null;
  if (_app) return _app;
  _app = getApps()[0] ?? initializeApp(env.firebase as Record<string, string>);
  return _app;
}

export function getAuthOrNull(): Auth | null {
  const a = app();
  if (!a) return null;
  return (_auth ??= getAuth(a));
}

export function getDbOrNull(): Firestore | null {
  const a = app();
  if (!a) return null;
  return (_db ??= getFirestore(a));
}
