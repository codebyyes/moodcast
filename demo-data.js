// One sample week from a fictional office worker (Monday to Sunday).
// Results are pre-filled as samples; press "Read again" on any day to let the on-device AI read it live.
export const DEMO_WEEK = [
  {
    text: "Weekly meeting today. Kevin, my manager, tore apart my slides in front of the whole team. I just nodded and said nothing. Couldn't eat lunch after that. Lay awake replaying it until almost 2am.",
    weather: "thunderstorm", weatherPhrase: "Thunderstorm over the morning meeting",
    dayColor: "yellow", mentionsHurtingSelf: false, triggers: ["work", "sleep", "food"],
    note: "Being criticized in front of everyone is a heavy storm to sit through. Staying quiet doesn't mean it didn't hurt.",
    digestLine: "Criticized by manager in front of the team; stayed silent; skipped lunch; slept badly"
  },
  {
    text: "Dragged myself through the day. Stayed late to redo the slides and skipped the gym again. Everything feels heavy and gray. I keep thinking I'm just not good enough for this job.",
    weather: "rain", weatherPhrase: "Steady gray rain all day",
    dayColor: "yellow", mentionsHurtingSelf: false, triggers: ["work", "sleep", "self-worth"],
    note: "You kept going on very little energy. One hard week of slides is not a verdict on your worth.",
    digestLine: "Exhausted; worked late and skipped exercise; doubted own ability at work"
  },
  {
    text: "Called my sister on the way home and we laughed about the dumbest childhood stuff. Cooked a real dinner for the first time this week. Felt like myself for a few hours.",
    weather: "sunny", weatherPhrase: "Clear skies in the evening",
    dayColor: "green", mentionsHurtingSelf: false, triggers: ["relationships"],
    note: "Laughter with someone who knows you, and a real meal. That is what feeling like yourself looks like.",
    digestLine: "Warm call with a family member; cooked a proper meal; felt like themselves"
  },
  {
    text: "The deadline got moved up to Monday with no warning. My heart was racing all afternoon. Snapped at a coworker over nothing and felt awful about it. Couldn't fall asleep until 3am.",
    weather: "thunderstorm", weatherPhrase: "Sudden afternoon thunderstorm",
    dayColor: "yellow", mentionsHurtingSelf: false, triggers: ["work", "sleep", "relationships"],
    note: "A surprise deadline can shake anyone. Noticing that you snapped shows how much you care about the people around you.",
    digestLine: "Sudden deadline change; anxious all afternoon; short-tempered with a coworker; slept very late"
  },
  {
    text: "Running on empty. Forgot two things in one meeting. Cancelled dinner with friends because I didn't want to bring everyone down with my complaining. Just want to disappear under a blanket.",
    weather: "fog", weatherPhrase: "Thick fog, low visibility",
    dayColor: "yellow", mentionsHurtingSelf: false, triggers: ["work", "energy", "relationships"],
    note: "When you're this drained, everything feels foggy. Your friends might want to see you even on a gray day.",
    digestLine: "Drained and forgetful; cancelled plans with friends to avoid being a burden"
  },
  {
    text: "Slept ten hours. Took a long walk in the park, then hot pot with Mia and Jun after all. They made me laugh so hard. Didn't check work email once.",
    weather: "sunny", weatherPhrase: "Bright and clear all day",
    dayColor: "green", mentionsHurtingSelf: false, triggers: ["rest", "relationships"],
    note: "Rest, fresh air and good friends cleared the whole sky. Worth remembering what helped.",
    digestLine: "Slept long; walk outdoors; dinner with friends; fully off work"
  },
  {
    text: "Nice slow morning, but by evening the Monday dread started creeping in. Thinking about that meeting already makes my stomach tight.",
    weather: "rain", weatherPhrase: "Partly cloudy, rain by evening",
    dayColor: "yellow", mentionsHurtingSelf: false, triggers: ["work"],
    note: "The calm morning was real too. The evening dread is about tomorrow, not about you.",
    digestLine: "Calm morning; anxiety about the Monday meeting by evening"
  }
];
