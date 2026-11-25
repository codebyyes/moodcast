# MoodCast: handoff notes for any AI assistant

Read this first. It records what was decided, what is done and what is left, so a new session can continue without the original conversation.

## The person you are helping

- Replies in **Traditional Chinese (Taiwan)**. Keep replies short and concrete.
- **Complete beginner**: does not write code. Give one step at a time (what to tap, what to paste), and ask for a screenshot after each step.
- Works mostly on an **iPad** (Chrome on iPad cannot run on-device AI).
- Has an **M4 Mac mini, 16 GB RAM, 256 GB SSD** at home, available on **Sunday Nov 30, 2026** for testing and recording. Busy preparing for graduate school until Nov 29.
- Prefers honest, careful wording; dislikes overclaiming. Wants the app kept clearly **non-medical**.

## The hackathon

- **#BuildHybridAI 2026** (Google, Devpost): https://firebasehybridaihackathon.devpost.com/
- **Deadline: Nov 30, 2026, 2:00 PM PST = Dec 1, 2026, 6:00 AM Taipei.**
- Required: Firebase AI Logic hybrid inference, App Check (debug token accepted), public repo with an open-source license, runtime calls to Firebase AI Logic, English support, YouTube demo video under 3 minutes (English or English subtitles), a test link free until judging ends, text description.
- Registered on Devpost. Project draft created: name **MoodCast**; elevator pitch (194 chars): "Write your day. On-device AI reads it, names your mood weather, leaves a caring note and shows a weekly mood light. Your diary never leaves your device; the cloud sees only a digest you approve."
- The full English project report (design source of truth) is a Claude Docs artifact titled "MoodCast: A Privacy-First Mood Weather Journal": https://claude.ai/artifact/1VAvXKkpNETTrLu7CkqEpB

## Accounts and IDs (all public client values)

- GitHub repo: `codebyyes/moodcast` (public, MIT license).
- Hosting plan: **GitHub Pages** → https://codebyyes.github.io/moodcast/ (chosen over Firebase Hosting because the user cannot use a terminal on iPad).
- Firebase project: `moodcast-dc0c1`, **Spark (free) plan, no credit card**. Web app nickname "MoodCast Web". Config is in `firebase-config.js`.
- Firebase AI Logic: enabled with **Gemini Developer API** (free tier). AI monitoring turned off. Gemini in Firebase and Google Analytics turned off (privacy).
- App Check: enforced for AI Logic. The app runs in **debug-token mode**; token is in `firebase-config.js` and must be registered in Firebase console → App Check → Apps → MoodCast Web → ⋮ → Manage debug tokens. Status at last check: **App Check "未註冊" (not registered) — still to do**.
- Firebase JS SDK loaded from CDN `https://www.gstatic.com/firebasejs/13.4.0/` (hybrid needs 12.5.0+).

## Product decisions (do not change without asking the user)

1. **Diary text never leaves the device.** Entry reading uses `InferenceMode.ONLY_ON_DEVICE`. There is deliberately **no cloud fallback** for diary text. On unsupported devices the user picks the weather by hand.
2. **Weekly forecast**: off by default; user opts in. Sends only a **weekly digest** (per day: weather, triggers, one de-identified line written on the device). The user **previews and can edit or remove every line** before sending. Uses `PREFER_IN_CLOUD` (falls back on-device when offline). Badge from `response.inferenceSource`.
3. Digest lines: no names, places, companies or quotes; intense content restated calmly without graphic detail (e.g. "mood very low; described hurting themselves"). **The diary itself is never altered.** If the user edits a line back to intense wording, show: "With this wording, the AI provider's safety rules may prevent a reply."
4. **Weather**: sunny, partly_cloudy, rain, thunderstorm, fog. **Day color** (judged by the on-device AI): green / yellow / red.
5. **Weekly mood light** (3 colors, computed on device, **cannot be turned off**): red if 3+ red days or any day mentioning hurting oneself / not wanting to live; yellow if 3+ yellow-or-red days; else green. Every light explains itself in one line; a single-day red names the day gently.
6. **One note per entry, no chat.** Fixed privacy footer under every note (app text, not model text).
12. **Support wording**: never say "reaching out is up to you" or "you don't have to carry it alone". Say that a friend, a counselor or a doctor can help, and give a direction: look up support services where you live; in the US, call or text 988.
7. **Not surveillance, not medical.** MoodCast never reports, notifies or contacts anyone. Avoid medical words (diagnose, screening, depression, checkup-as-medical). Use "mood light", "mood check-in", "wellbeing". Heavy entries: acknowledge pain + one line "call or text 988" (US standard chosen for the hackathon).
8. Age: 18+, phrased as **Google's Gemini API terms require it**, not as MoodCast's own rule.
9. Hackathon scope: passcode lock screen is in; **encryption of stored entries and an encrypted backup file are "next steps"**, not built.
10. Chrome's on-device model supports English, Spanish, Japanese, German, French (not Chinese) → the hackathon build is **English**.
11. Demo mode loads one sample week (fictional office worker, see `demo-data.js`) into last week, so judges see the light and forecast immediately.

## Files

- `index.html` – all screens (onboarding promise, lock, Today, Calendar, Weekly light, About/demo).
- `app.js` – all logic: Firebase init + App Check, reader model (on-device, JSON via `responseConstraint`), forecast model, calendar, light rules, digest, demo.
- `styles.css`, `demo-data.js`, `firebase-config.js`, `README.md`, `LICENSE` (MIT).

## Remaining steps

- [ ] Give Claude push access to the repo (Claude GitHub App) or upload files by hand.
- [ ] Push the code; turn on **GitHub Pages** (Settings → Pages → Deploy from branch → main / root).
- [ ] Register the App Check debug token in the Firebase console.
- [ ] Test the cloud forecast on iPad (demo week → Weekly light → turn on forecast → send).
- [ ] **Sunday Nov 30 on the Mac mini**: Chrome 139+, enable `chrome://flags/#prompt-api-for-gemini-nano-multimodal-input`, restart, make sure 22 GB free; prepare on-device AI; test reading entries (including a heavy test entry); fix issues.
- [ ] Record the demo video (under 3 min, English): promise → write → read on device → calendar → weekly light → digest preview → forecast with badge → DevTools Network showing only the digest goes out.
- [ ] Update the report's "Challenges" section with what really happened; move anything not built to "What's next".
- [ ] Devpost submission: repo URL, Pages URL, YouTube URL, text description (from the report), thumbnail screenshot.
