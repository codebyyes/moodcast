// MoodCast Firebase web app configuration.
// This is a public client config; it is safe to ship in the page.
export const firebaseConfig = {
  apiKey: "AIzaSyAJJNZAIe_eX8M2oeNKfk9HaRsVNNTpdyM",
  authDomain: "moodcast-dc0c1.firebaseapp.com",
  projectId: "moodcast-dc0c1",
  storageBucket: "moodcast-dc0c1.firebasestorage.app",
  messagingSenderId: "248360910834",
  appId: "1:248360910834:web:837fbf78a771d7bc58756b"
};

// Firebase App Check.
// The hackathon rules accept debug tokens. This token is registered in the
// Firebase console (App Check > Apps > Manage debug tokens).
// Before a public launch, replace it with a reCAPTCHA provider and remove the token.
export const APP_CHECK_DEBUG_TOKEN = "bfb59750-e0d5-4161-a3d6-4ef207829f46";

// Firebase JS SDK version loaded from the CDN (hybrid inference needs 12.5.0+).
export const FIREBASE_SDK_VERSION = "13.4.0";
