// Environment-variable accessors. Centralized so that:
//   1. Misspellings show up here, not scattered across the codebase.
//   2. firebaseConfigured() can be a single source of truth — components and
//      hooks branch on it instead of each re-checking the same six vars.
//   3. The build can succeed without any env vars set: getDbOrNull() returns
//      null, hooks bail out gracefully, pages render empty states.

export const env = {
  firebase: {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "",
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "",
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "",
    messagingSenderId:
      process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "",
  },
  recaptchaSiteKey: process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY ?? "",
} as const;

// Returns true when every required Firebase web-SDK field is non-empty.
// projectId + apiKey + appId are the bare minimum; the others can be derived
// or are optional, but Firebase complains loudly if you initialize with
// blank strings, so we require all six.
export function firebaseConfigured(): boolean {
  const c = env.firebase;
  return Boolean(
    c.apiKey &&
      c.authDomain &&
      c.projectId &&
      c.storageBucket &&
      c.messagingSenderId &&
      c.appId,
  );
}
