// MoodCast: a privacy-first mood weather journal.
// Diary text is read only on the device (Gemini Nano in Chrome, via Firebase AI Logic hybrid inference).
// The cloud only ever receives a weekly digest that the user reviews and approves.

import { firebaseConfig, APP_CHECK_DEBUG_TOKEN, FIREBASE_SDK_VERSION } from "./firebase-config.js";
import { DEMO_WEEK } from "./demo-data.js";

/* ---------- constants ---------- */

const WEATHER = {
  sunny:         { icon: "☀️", label: "Sunny" },
  partly_cloudy: { icon: "⛅", label: "Partly cloudy" },
  rain:          { icon: "🌧️", label: "Rain" },
  thunderstorm:  { icon: "⛈️", label: "Thunderstorm" },
  fog:           { icon: "🌫️", label: "Fog" }
};
const DEFAULT_COLOR = { sunny: "green", partly_cloudy: "green", rain: "yellow", thunderstorm: "yellow", fog: "yellow" };
const COLOR_LABEL = { green: "Green day", yellow: "Yellow day", red: "Red day" };
const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const LANG = [{ type: "text", languages: ["en"] }];
const INTENSE = /(kill(ing)?\s+myself|suicid|want(ed)?\s+to\s+die|(don'?t|do not|not)\s+want\s+to\s+(live|be alive)|end\s+(it all|my life)|cut(ting)?\s+myself|hurt(ing)?\s+myself|blood|overdose|hang(ing)?\s+myself)/i;

const READER_SYSTEM = `You are the private reader inside MoodCast, a diary app. The user writes a diary entry about their day. You read it once and reflect it back. You are not a therapist. Never diagnose, never give medical or medication advice, never judge, and never ask questions or start a conversation.
Return JSON with these fields:
- weather: the day's overall mood as weather. sunny = happy, calm, content. partly_cloudy = neutral or mildly bothered. rain = sad or low. thunderstorm = angry, anxious or stressed. fog = confused, drained or tired.
- weatherPhrase: a short weather-style phrase for the day, under 8 words, for example "Afternoon thunderstorm, clearing by evening".
- dayColor: green = coping well with normal ups and downs. yellow = stressed, low or tired but managing. red = persistent distress, not coping, or any mention of hurting oneself or not wanting to live.
- mentionsHurtingSelf: true only if the entry mentions hurting oneself, self-harm, or not wanting to live. Otherwise false.
- triggers: 1 to 3 short lowercase words for what shaped the day, such as work, study, sleep, food, relationships, family, health, money, rest, energy, self-worth.
- note: one or two warm sentences, at most 40 words, that reflect what the user wrote. If the entry is very heavy, acknowledge the pain honestly and gently instead of being cheerful. Never describe methods, and never agree with or encourage self-harm.
- digestLine: one calm, non-judgmental line, at most 25 words, summarizing the day for a weekly digest. Never include names of people, places, companies or schools; use roles such as "manager", "friend" or "family member". Never quote the diary. Leave out graphic details such as methods or injuries; describe intense content calmly, for example "mood very low; described hurting themselves".`;

/* ---------- storage ---------- */

const KEY = "moodcast.v1";
function loadDb() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; }
}
let db = loadDb();
db.entries ||= {};
db.forecasts ||= {};
function saveDb() { localStorage.setItem(KEY, JSON.stringify(db)); }

/* ---------- dates ---------- */

const pad = (n) => String(n).padStart(2, "0");
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseYmd = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const today = () => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); };
const mondayOf = (d) => addDays(new Date(d.getFullYear(), d.getMonth(), d.getDate()), -((d.getDay() + 6) % 7));
const shortDate = (d) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });

/* ---------- dom helpers ---------- */

const $ = (id) => document.getElementById(id);
function show(el, on = true) { el.hidden = !on; }
function toast(msg, ms = 3500) {
  const t = $("toast"); t.textContent = msg; show(t);
  clearTimeout(toast._t); toast._t = setTimeout(() => show(t, false), ms);
}
function el(tag, attrs = {}, ...children) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") e.className = v;
    else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v);
  }
  for (const c of children) if (c != null) e.append(c);
  return e;
}

/* ---------- passcode ---------- */

async function hashCode(salt, code) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${salt}:${code}`));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/* ---------- Firebase AI Logic ---------- */

let readerModel = null;
let forecastModel = null;
let firebaseError = null;
let deviceState = "unknown"; // unavailable | downloadable | downloading | available | unknown
let readerReady = false;
let forecastDeviceReady = false;

async function initFirebase() {
  // App Check debug token must be set before App Check is initialized.
  self.FIREBASE_APPCHECK_DEBUG_TOKEN = APP_CHECK_DEBUG_TOKEN;
  const base = `https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}`;
  const [appMod, checkMod, aiMod] = await Promise.all([
    import(`${base}/firebase-app.js`),
    import(`${base}/firebase-app-check.js`),
    import(`${base}/firebase-ai.js`)
  ]);
  const app = appMod.initializeApp(firebaseConfig);
  checkMod.initializeAppCheck(app, {
    // In debug-token mode the provider below is never called.
    provider: new checkMod.CustomProvider({ getToken: async () => { throw new Error("App Check runs in debug-token mode"); } }),
    isTokenAutoRefreshEnabled: true
  });

  const { getAI, getGenerativeModel, GoogleAIBackend, InferenceMode, Schema } = aiMod;
  const ai = getAI(app, { backend: new GoogleAIBackend() });

  const readerSchema = Schema.object({
    properties: {
      weather: Schema.enumString({ enum: Object.keys(WEATHER) }),
      weatherPhrase: Schema.string(),
      dayColor: Schema.enumString({ enum: ["green", "yellow", "red"] }),
      mentionsHurtingSelf: Schema.boolean(),
      triggers: Schema.array({ items: Schema.string() }),
      note: Schema.string(),
      digestLine: Schema.string()
    }
  });

  // The diary reader runs ONLY on the device. Diary text has no cloud fallback, by design.
  readerModel = getGenerativeModel(ai, {
    mode: InferenceMode.ONLY_ON_DEVICE,
    onDeviceParams: {
      createOptions: {
        expectedInputs: LANG,
        expectedOutputs: LANG,
        initialPrompts: [{ role: "system", content: [{ type: "text", value: READER_SYSTEM }] }]
      },
      promptOptions: { responseConstraint: readerSchema }
    }
  });

  // The weekly forecast sees only the approved digest. It prefers the cloud and falls back to the device when offline.
  const forecastSchema = Schema.object({
    properties: {
      oneLine: Schema.string(),
      storms: Schema.array({ items: Schema.string() }),
      clearSky: Schema.array({ items: Schema.string() }),
      pattern: Schema.string(),
      nextWeek: Schema.string()
    }
  });
  forecastModel = getGenerativeModel(ai, {
    mode: InferenceMode.PREFER_IN_CLOUD,
    inCloudParams: {
      model: "gemini-3.5-flash-lite",
      generationConfig: { maxOutputTokens: 500, temperature: 0.4, responseMimeType: "application/json", responseSchema: forecastSchema }
    },
    onDeviceParams: {
      createOptions: { expectedInputs: LANG, expectedOutputs: LANG },
      promptOptions: { responseConstraint: forecastSchema }
    }
  });
}

async function checkDevice() {
  const status = $("aiStatus");
  if (!("LanguageModel" in self)) {
    deviceState = "unavailable";
    status.textContent = "On-device AI: not available in this browser";
    return;
  }
  try {
    deviceState = await self.LanguageModel.availability({ expectedInputs: LANG, expectedOutputs: LANG });
  } catch {
    deviceState = "unavailable";
  }
  const text = {
    available: "On-device AI: ready",
    downloadable: "On-device AI: needs a one-time download",
    downloading: "On-device AI: downloading…",
    unavailable: "On-device AI: not supported on this device"
  };
  status.textContent = text[deviceState] || "On-device AI: unknown";
}

function updatePrepCard() {
  const needsPrep = !readerReady && (deviceState === "downloadable" || deviceState === "downloading" || deviceState === "available");
  show($("aiPrep"), needsPrep || deviceState === "unavailable");
  if (deviceState === "unavailable") {
    $("aiPrepText").textContent = "This browser can't run on-device AI, so diary entries can't be read here. You can still write, pick the weather yourself and see your calendar. To let the AI read your diary, open MoodCast in Chrome on a desktop computer.";
    show($("prepBtn"), false);
  } else {
    $("aiPrepText").textContent = deviceState === "available"
      ? "On-device AI is downloaded. Press the button once to start it."
      : "On-device AI needs a one-time download of a few minutes. Your diary will be read only by this model, on this device.";
    show($("prepBtn"), true);
  }
}

function reportProgress(p) {
  const bar = $("prepProgress");
  show(bar);
  const v = typeof p === "number" ? p : (p && typeof p.loaded === "number" ? p.loaded : null);
  if (v != null) bar.value = v;
}

async function ensureReader() {
  if (readerReady) return;
  if (!readerModel) throw new Error(firebaseError ? `Firebase failed to load: ${firebaseError}` : "Firebase is still loading");
  if (typeof readerModel.initializeDeviceModel === "function") {
    await readerModel.initializeDeviceModel(reportProgress);
  }
  readerReady = true;
  deviceState = "available";
  $("aiStatus").textContent = "On-device AI: ready";
  updatePrepCard();
}

function parseJson(text) {
  const clean = text.replace(/```json|```/g, "");
  const a = clean.indexOf("{"), b = clean.lastIndexOf("}");
  return JSON.parse(a >= 0 && b > a ? clean.slice(a, b + 1) : clean);
}

/* ---------- screens ---------- */

function showScreen(name) {
  for (const s of ["landing", "onboarding", "lock", "app"]) show($(s), s === name);
}

function switchTab(name) {
  document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t.dataset.tab === name));
  for (const p of ["today", "calendar", "week", "about"]) show($(`tab-${p}`), p === name);
  if (name === "calendar") renderCalendar();
  if (name === "week") renderWeek();
}

/* ---------- today ---------- */

function currentDate() { return $("entryDate").value || ymd(today()); }

function loadEntryIntoForm(dateStr) {
  $("entryDate").value = dateStr;
  const e = db.entries[dateStr];
  $("entryText").value = e?.text || "";
  show($("manualCard"), false);
  renderResult(e);
}

function renderResult(e) {
  if (!e || !e.weather) { show($("resultCard"), false); return; }
  const w = WEATHER[e.weather] || WEATHER.partly_cloudy;
  $("resWeatherIcon").textContent = w.icon;
  $("resWeatherPhrase").textContent = e.weatherPhrase || w.label;
  const chip = $("resDayColor");
  chip.className = `chip ${e.dayColor}`;
  chip.textContent = COLOR_LABEL[e.dayColor] || "";
  $("resTriggers").textContent = e.triggers?.length ? `Shaped by: ${e.triggers.join(", ")}` : "";
  const note = $("resNote");
  note.textContent = e.note || "You picked this weather yourself. The on-device AI can read this entry later.";
  show($("resHelpline"), e.dayColor === "red");
  const src = {
    ON_DEVICE: "Read on this device",
    MANUAL: "Weather picked by you",
    SAMPLE: "Sample entry (press Read my day to read it live)"
  };
  $("resSource").textContent = src[e.source] || "Read on this device";
  show($("resultCard"));
}

function saveText(dateStr, text) {
  const prev = db.entries[dateStr] || {};
  const changed = prev.text !== text;
  db.entries[dateStr] = changed ? { text, savedAt: Date.now() } : prev;
  saveDb();
  return db.entries[dateStr];
}

function showManual(reason) {
  $("manualReason").textContent = reason;
  const picker = $("manualPicker");
  picker.innerHTML = "";
  for (const [key, w] of Object.entries(WEATHER)) {
    picker.append(el("button", { onclick: () => pickManual(key) }, `${w.icon} ${w.label}`));
  }
  show($("manualCard"));
}

function pickManual(key) {
  const dateStr = currentDate();
  const e = db.entries[dateStr] || { text: $("entryText").value };
  Object.assign(e, {
    weather: key, weatherPhrase: WEATHER[key].label, dayColor: DEFAULT_COLOR[key],
    mentionsHurtingSelf: false, triggers: [], note: null, digestLine: "", source: "MANUAL"
  });
  db.entries[dateStr] = e;
  saveDb();
  show($("manualCard"), false);
  renderResult(e);
  toast("Saved on this device.");
}

async function readDay() {
  const dateStr = currentDate();
  const text = $("entryText").value.trim();
  if (!text) { toast("Write a few lines about your day first."); return; }
  saveText(dateStr, text);

  if (deviceState === "unavailable") {
    showManual("Your entry is saved on this device. This browser can't run on-device AI, and MoodCast never sends your diary to the cloud. Pick the weather yourself for now.");
    return;
  }

  const btn = $("readBtn");
  btn.disabled = true; btn.textContent = "Reading on this device…";
  try {
    await ensureReader();
    const result = await readerModel.generateContent(`Diary entry:\n"""\n${text}\n"""`);
    let out;
    try { out = parseJson(result.response.text()); }
    catch { throw new Error("The model's answer could not be understood. Please try again."); }

    const weather = WEATHER[out.weather] ? out.weather : "partly_cloudy";
    let dayColor = ["green", "yellow", "red"].includes(out.dayColor) ? out.dayColor : DEFAULT_COLOR[weather];
    const hurt = out.mentionsHurtingSelf === true;
    if (hurt) dayColor = "red";
    const entry = {
      text, savedAt: Date.now(), weather, dayColor, mentionsHurtingSelf: hurt,
      weatherPhrase: String(out.weatherPhrase || WEATHER[weather].label).slice(0, 80),
      triggers: Array.isArray(out.triggers) ? out.triggers.slice(0, 3).map((t) => String(t).toLowerCase()) : [],
      note: String(out.note || "").slice(0, 400),
      digestLine: String(out.digestLine || "").slice(0, 300),
      source: result.response.inferenceSource || "ON_DEVICE"
    };
    db.entries[dateStr] = entry;
    saveDb();
    renderResult(entry);
  } catch (err) {
    console.error(err);
    const msg = String(err?.message || err);
    const safety = /safety|blocked|SAFETY/i.test(msg);
    showManual(safety
      ? "Your entry is saved, exactly as you wrote it. The AI's safety rules prevented a reply this time. Pick the weather yourself; your calendar and mood light still work."
      : `Your entry is saved, exactly as you wrote it. The on-device reader couldn't read it right now (${msg.slice(0, 120)}). Pick the weather yourself, or try again later.`);
  } finally {
    btn.disabled = false; btn.textContent = "Read my day";
  }
}

/* ---------- calendar ---------- */

let calMonth = new Date(today().getFullYear(), today().getMonth(), 1);

function renderCalendar() {
  $("monthTitle").textContent = calMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const grid = $("calGrid");
  grid.innerHTML = "";
  const lead = (calMonth.getDay() + 6) % 7;
  for (let i = 0; i < lead; i++) grid.append(el("div", { class: "cal-day empty" }));
  const days = new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 0).getDate();
  const todayStr = ymd(today());
  for (let d = 1; d <= days; d++) {
    const date = new Date(calMonth.getFullYear(), calMonth.getMonth(), d);
    const key = ymd(date);
    const e = db.entries[key];
    const cell = el("div", { class: `cal-day${key === todayStr ? " today" : ""}`, onclick: () => { switchTab("today"); loadEntryIntoForm(key); } },
      el("div", {}, String(d)),
      e?.weather ? el("span", { class: "ic" }, WEATHER[e.weather].icon) : (e?.text ? el("span", { class: "ic" }, "📝") : null),
      e?.dayColor ? el("span", { class: `dot ${e.dayColor}` }) : null
    );
    grid.append(cell);
  }
  renderMonthCompare();
}

function monthCounts(first) {
  const counts = Object.fromEntries(Object.keys(WEATHER).map((k) => [k, 0]));
  let written = 0;
  const days = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  for (let d = 1; d <= days; d++) {
    const e = db.entries[ymd(new Date(first.getFullYear(), first.getMonth(), d))];
    if (e?.text || e?.weather) written++;
    if (e?.weather) counts[e.weather]++;
  }
  return { counts, written };
}

function renderMonthCompare() {
  const prev = new Date(calMonth.getFullYear(), calMonth.getMonth() - 1, 1);
  const a = monthCounts(calMonth), b = monthCounts(prev);
  const name = (d) => d.toLocaleDateString("en-US", { month: "short" });
  const t = $("monthCompare");
  t.innerHTML = "";
  t.append(el("tr", {}, el("th", {}, "Weather"), el("th", {}, name(calMonth)), el("th", {}, name(prev))));
  for (const [k, w] of Object.entries(WEATHER)) {
    t.append(el("tr", {}, el("td", {}, `${w.icon} ${w.label}`), el("td", {}, String(a.counts[k])), el("td", {}, String(b.counts[k]))));
  }
  t.append(el("tr", {}, el("td", {}, "Days written"), el("td", {}, String(a.written)), el("td", {}, String(b.written))));
}

/* ---------- weekly light ---------- */

let weekStart = mondayOf(today());

function weekEntries(start) {
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(start, i);
    return { date, key: ymd(date), entry: db.entries[ymd(date)] || null };
  });
}

function computeLight(days) {
  const read = days.filter((d) => d.entry?.dayColor);
  if (!read.length) return { color: "none", text: "No days with weather yet this week. Write and read a day to see your light." };
  const reds = read.filter((d) => d.entry.dayColor === "red");
  const notGreen = read.filter((d) => d.entry.dayColor !== "green");
  const greens = read.filter((d) => d.entry.dayColor === "green");
  const based = ` Based on ${read.length} of 7 days.`;
  const hurtDay = days.find((d) => d.entry?.mentionsHurtingSelf);

  if (hurtDay) {
    const dayName = DAY_NAMES[(hurtDay.date.getDay() + 6) % 7];
    const othersCalm = reds.filter((d) => d !== hurtDay).length < 3;
    return {
      color: "red",
      text: `This week is marked red because of what you wrote on ${dayName}, when you mentioned hurting yourself or not wanting to go on.` +
        (othersCalm ? " The rest of your week looked steadier, and that counts too." : "") +
        " Thoughts like these deserve care, even when they pass. If they come back, consider talking with a friend, a counselor or a doctor." + based
    };
  }
  if (reds.length >= 3) {
    return { color: "red", text: `This week is marked red because ${reds.length} days felt like persistent distress. It may be time to talk to a friend, a counselor or a doctor.` + based };
  }
  if (notGreen.length >= 3) {
    let extra = "";
    if (greens.length) {
      const trig = [...new Set(greens.flatMap((d) => d.entry.triggers || []))];
      extra = ` The ${greens.length === 1 ? "one clear day" : `${greens.length} clear days`} came with ${trig.length ? trig.join(", ") : "a lighter load"}.`;
    }
    return { color: "yellow", text: `This week is marked yellow because ${notGreen.length} days felt stressed, low or tired.${extra} Pay attention to sleep, workload and what triggers the storms.` + based };
  }
  return { color: "green", text: "This week is marked green: normal ups and downs. Keep doing what works." + based };
}

function renderWeek() {
  const days = weekEntries(weekStart);
  $("weekTitle").textContent = `${shortDate(weekStart)} – ${shortDate(addDays(weekStart, 6))}`;
  const wrap = $("weekDays");
  wrap.innerHTML = "";
  days.forEach((d, i) => {
    wrap.append(el("div", { class: "week-day" },
      DAY_NAMES[i].slice(0, 3),
      el("span", { class: "ic" }, d.entry?.weather ? WEATHER[d.entry.weather].icon : "·"),
      d.entry?.dayColor ? el("span", { class: `dot ${d.entry.dayColor}` }) : null
    ));
  });
  const light = computeLight(days);
  const lightBox = $("weekLight");
  lightBox.innerHTML = "";
  const textBox = el("div", {}, el("p", {}, light.text));
  if (light.color === "red") textBox.append(el("p", { class: "helpline small" }, "If you are in the US, you can call or text 988, the Suicide & Crisis Lifeline, any time."));
  lightBox.append(el("div", { class: `lamp ${light.color}`, "aria-label": `${light.color} light` }), textBox);

  show($("forecastOff"), !db.forecastOn);
  show($("forecastOn"), !!db.forecastOn);
  if (db.forecastOn) renderDigest(days);
  const saved = db.forecasts[ymd(weekStart)];
  if (saved) showForecast(saved); else show($("forecastResult"), false);
}

/* ---------- digest + forecast ---------- */

let digestDraft = [];

function renderDigest(days) {
  digestDraft = days
    .filter((d) => d.entry?.weather)
    .map((d, i) => {
      const e = d.entry;
      const dayName = DAY_NAMES[(d.date.getDay() + 6) % 7];
      const head = `${dayName.slice(0, 3)} · ${WEATHER[e.weather].label}${e.triggers?.length ? ` · ${e.triggers.join(", ")}` : ""}`;
      return { head, line: e.digestLine || "" };
    });
  const list = $("digestList");
  list.innerHTML = "";
  if (!digestDraft.length) {
    list.append(el("p", { class: "muted" }, "No days with weather this week yet."));
    return;
  }
  digestDraft.forEach((item, idx) => {
    const warn = el("p", { class: "digest-warn" }, "With this wording, the AI provider's safety rules may prevent a reply.");
    warn.hidden = !INTENSE.test(item.line);
    const ta = el("textarea", { rows: "2" });
    ta.value = item.line;
    ta.addEventListener("input", () => { item.line = ta.value; warn.hidden = !INTENSE.test(ta.value); });
    const del = el("button", { class: "ghost small", onclick: () => { item.removed = true; box.remove(); } }, "Remove this day");
    const box = el("div", { class: "digest-line" }, el("label", {}, item.head), ta, warn, el("div", { class: "row" }, del));
    list.append(box);
  });
}

function showForecast(saved) {
  const body = $("forecastBody");
  body.innerHTML = "";
  const d = saved.data;
  if (!d) {
    body.append(el("p", { class: "fc-text" }, saved.text || ""));
  } else {
    const section = (icon, title, content) => {
      if (!content || (Array.isArray(content) && !content.length)) return;
      const box = el("div", { class: "fc-section" }, el("h4", {}, `${icon} ${title}`));
      if (Array.isArray(content)) box.append(el("ul", {}, ...content.map((c) => el("li", {}, String(c)))));
      else box.append(el("p", {}, String(content)));
      body.append(box);
    };
    section("🌤️", "This week in one line", d.oneLine);
    section("⛈️", "What brought the storms", d.storms);
    section("☀️", "What cleared the sky", d.clearSky);
    section("🔍", "A pattern to notice", d.pattern);
    section("👉", "Next week", d.nextWeek);
  }
  $("forecastSource").textContent = saved.source === "ON_DEVICE" ? "Written on this device" : "Written in the cloud";
  show($("forecastResult"));
}

async function sendDigest() {
  const lines = digestDraft.filter((d) => !d.removed).map((d) => `${d.head}${d.line.trim() ? `: ${d.line.trim()}` : ""}`);
  if (!lines.length) { toast("There is nothing to send for this week."); return; }
  if (!forecastModel) { toast(firebaseError ? `Firebase failed to load: ${firebaseError}` : "Still loading, try again in a moment."); return; }

  const prompt = `You write a short weekly mood summary for one person. You only see a digest that the person approved; you never see their diary.
Write in plain, simple, warm English that anyone can understand in 10 seconds. Do not use weather metaphors in your sentences. Be concrete and refer to what actually happened in the digest.
Rules: no diagnosis, no medical or medication advice, no judgment, no names.
Return JSON with:
- oneLine: one sentence that sums up the week, including how many stormy (rain, thunderstorm or fog) and clear (sunny or partly cloudy) days there were and the main cause of the hard days. Max 25 words.
- storms: 1 to 3 short bullet points (max 14 words each) about what made the hard days hard. Empty if there were no hard days.
- clearSky: 1 to 3 short bullet points (max 14 words each) about what helped on the better days. Empty if there were none.
- pattern: one sentence (max 25 words) about a connection the person may not have noticed, for example stress at work followed by poor sleep.
- nextWeek: one small, concrete step for next week (max 20 words).
If the digest mentions hurting oneself or not wanting to live, make nextWeek gently say that a friend, a counselor or a doctor can help, and that the person can look up support services where they live.

Digest for the week of ${shortDate(weekStart)}:
${lines.join("\n")}`;

  const btn = $("sendDigestBtn");
  btn.disabled = true; btn.textContent = "Writing your forecast…";
  try {
    if (!navigator.onLine && !forecastDeviceReady && typeof forecastModel.initializeDeviceModel === "function") {
      await forecastModel.initializeDeviceModel(reportProgress);
      forecastDeviceReady = true;
    }
    const result = await forecastModel.generateContent(prompt);
    let data;
    try { data = parseJson(result.response.text()); }
    catch { throw new Error("The forecast could not be understood. Please try again."); }
    const source = result.response.inferenceSource || "IN_CLOUD";
    db.forecasts[ymd(weekStart)] = { data, source, at: Date.now() };
    saveDb();
    showForecast(db.forecasts[ymd(weekStart)]);
  } catch (err) {
    console.error(err);
    const msg = String(err?.message || err);
    toast(/safety|blocked/i.test(msg)
      ? "The AI provider's safety rules prevented a reply. Your diary and mood light are not affected."
      : `The forecast couldn't be written right now: ${msg.slice(0, 120)}`, 6000);
  } finally {
    btn.disabled = false; btn.textContent = "Send digest and write my forecast";
  }
}

/* ---------- demo ---------- */

function loadDemo() {
  const start = addDays(mondayOf(today()), -7);
  DEMO_WEEK.forEach((d, i) => {
    db.entries[ymd(addDays(start, i))] = { ...d, savedAt: Date.now(), source: "SAMPLE", sample: true };
  });
  saveDb();
  weekStart = start;
  calMonth = new Date(start.getFullYear(), start.getMonth(), 1);
  toast("Demo week loaded (last week). Sample entries are marked as samples.");
  switchTab("week");
}

function clearDemo() {
  for (const [k, e] of Object.entries(db.entries)) if (e.sample) delete db.entries[k];
  saveDb();
  toast("Demo entries removed.");
  loadEntryIntoForm(currentDate());
}

/* ---------- wiring ---------- */

function wire() {
  $("getStartedBtn").addEventListener("click", () => { showScreen("onboarding"); window.scrollTo(0, 0); });

  $("startBtn").addEventListener("click", async () => {
    const err = $("setupError");
    const p1 = $("newPass").value, p2 = $("newPass2").value;
    let msg = "";
    if (!$("agreePromise").checked || !$("agreeAge").checked || !$("agreeLights").checked) msg = "Please read and tick all three boxes.";
    else if (p1.length < 4) msg = "The passcode needs at least 4 characters.";
    else if (p1 !== p2) msg = "The two passcodes don't match.";
    if (msg) { err.textContent = msg; show(err); return; }
    const salt = crypto.getRandomValues(new Uint32Array(4)).join("-");
    db.salt = salt;
    db.passHash = await hashCode(salt, p1);
    db.setupDone = true;
    saveDb();
    enterApp();
  });

  const unlock = async () => {
    const ok = (await hashCode(db.salt, $("unlockPass").value)) === db.passHash;
    show($("unlockError"), !ok);
    if (ok) { $("unlockPass").value = ""; enterApp(); }
  };
  $("unlockBtn").addEventListener("click", unlock);
  $("unlockPass").addEventListener("keydown", (e) => { if (e.key === "Enter") unlock(); });

  document.querySelectorAll(".tab").forEach((t) => t.addEventListener("click", () => switchTab(t.dataset.tab)));

  $("prepBtn").addEventListener("click", async () => {
    $("prepBtn").disabled = true;
    try { await ensureReader(); toast("On-device AI is ready."); }
    catch (e) { console.error(e); toast(`Couldn't start on-device AI: ${String(e.message || e).slice(0, 120)}`, 6000); }
    finally { $("prepBtn").disabled = false; }
  });

  $("entryDate").addEventListener("change", () => loadEntryIntoForm(currentDate()));
  $("readBtn").addEventListener("click", readDay);
  $("saveOnlyBtn").addEventListener("click", () => {
    const text = $("entryText").value.trim();
    if (!text) { toast("Write a few lines first."); return; }
    saveText(currentDate(), text);
    renderResult(null);
    showManual("Saved on this device. Pick the weather yourself, or press Read my day later.");
  });

  $("prevMonth").addEventListener("click", () => { calMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() - 1, 1); renderCalendar(); });
  $("nextMonth").addEventListener("click", () => { calMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 1); renderCalendar(); });
  $("prevWeek").addEventListener("click", () => { weekStart = addDays(weekStart, -7); renderWeek(); });
  $("nextWeek").addEventListener("click", () => { weekStart = addDays(weekStart, 7); renderWeek(); });

  $("forecastOnBtn").addEventListener("click", () => { db.forecastOn = true; saveDb(); renderWeek(); });
  $("forecastOffBtn").addEventListener("click", () => { db.forecastOn = false; saveDb(); renderWeek(); });
  $("sendDigestBtn").addEventListener("click", sendDigest);

  $("demoBtn").addEventListener("click", loadDemo);
  $("clearDemoBtn").addEventListener("click", clearDemo);
  $("lockBtn").addEventListener("click", () => showScreen("lock"));
  $("startOverBtn").addEventListener("click", () => {
    if (!confirm("Start over? This deletes every entry, forecast and your passcode on this device. This cannot be undone.")) return;
    localStorage.removeItem(KEY);
    db = { entries: {}, forecasts: {} };
    showScreen("landing");
  });

  $("wipeBtn").addEventListener("click", () => {
    if (!confirm("Delete every entry, forecast and your passcode from this browser? This cannot be undone.")) return;
    localStorage.removeItem(KEY);
    db = { entries: {}, forecasts: {} };
    showScreen("landing");
  });
}

function enterApp() {
  showScreen("app");
  loadEntryIntoForm(ymd(today()));
  updatePrepCard();
  switchTab("today");
}

/* ---------- start ---------- */

wire();
$("entryDate").value = ymd(today());
showScreen(db.setupDone ? "lock" : "landing");
checkDevice().then(updatePrepCard);
initFirebase().catch((e) => {
  firebaseError = String(e?.message || e);
  console.error("Firebase init failed", e);
  $("aiStatus").textContent = "Couldn't load Firebase";
});
