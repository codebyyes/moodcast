# MoodCast

**A privacy-first mood weather journal.** Write your day. On-device AI reads it, names your mood weather, leaves a caring note and shows a weekly mood light. Your diary never leaves your device; the cloud sees only a digest you approve.

Built for **#BuildHybridAI 2026** with **Firebase AI Logic hybrid inference** (Web, Chrome).

## How MoodCast uses Firebase AI Logic

| Task | Input | Inference mode | Why |
| --- | --- | --- | --- |
| Read a diary entry: weather, day color, triggers, one note, one de-identified digest line | Raw diary text (private) | `ONLY_ON_DEVICE` (Gemini Nano in Chrome) | Diary text never leaves the device, by design. Structured JSON via `responseConstraint`. |
| Weekly mood forecast | A digest the user reviews and edits; no diary text | `PREFER_IN_CLOUD`, falls back to on-device when offline | Needs stronger reasoning across the week; still works without a connection. |

- The app shows where each forecast was written ("Written in the cloud" / "Written on this device") from `response.inferenceSource`.
- Firebase App Check protects the Gemini API (debug token for the hackathon build).
- The weekly mood light is computed on the device with simple, visible rules. It describes mood only; MoodCast is not a medical device.

The code lives in [`app.js`](app.js): `getAI`, `GoogleAIBackend`, `getGenerativeModel`, `InferenceMode`, `Schema`, `initializeDeviceModel` and `generateContent` are all called at runtime.

## Run it

MoodCast is a static web app with no build step.

1. Use **Chrome 139+ on a desktop computer** (Windows 10/11, macOS 13+, Linux) with at least 22 GB free disk space and 16 GB RAM or a GPU with more than 4 GB VRAM.
2. Open `chrome://flags/#prompt-api-for-gemini-nano-multimodal-input`, set it to **Enabled**, and restart Chrome.
3. Open the hosted app: **https://codebyyes.github.io/moodcast/**
4. Press **Get started**, accept the promise and confirm you are 18+. **Test passcode: `1234`** (pre-filled in this hackathon test version, so you can come back later). If you change it and forget it, use **Start over** on the lock screen; this deletes the entries on that device.
5. Press **Prepare on-device AI** once (the first download takes a few minutes).
6. Go to **About → Load demo week** to see the calendar, the weekly light and the forecast right away, or write your own entry and press **Read my day**.

To run locally, serve the folder over HTTP (for example `npx serve .`) and open it in Chrome.

### Using your own Firebase project

Edit [`firebase-config.js`](firebase-config.js): replace `firebaseConfig` with your web app config, enable **Firebase AI Logic** with the **Gemini Developer API**, and register your own App Check debug token (or switch to a reCAPTCHA provider).

## Privacy, in one table

| What | Where it is processed |
| --- | --- |
| Diary entry | Only on the device |
| Weather, day color, note, digest line | Created on the device, stored in the browser |
| Weekly mood light | Calculated on the device |
| Weekly forecast | Only the digest the user approves, sent to Gemini |

MoodCast never reports, notifies or contacts anyone. It is a diary, not a monitoring system.

## What's next

- Encryption of stored entries and an encrypted backup file the user keeps
- A **recovery code** shown once at setup, so users can regain access after a forgotten passcode without an email address or an account
- An iOS version with Apple Foundation Models through Firebase AI Logic

## License

[MIT](LICENSE)
