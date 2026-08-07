export type BuiltInCharacterId = 'naina' | 'bunny' | 'aarav' | 'maya';
// Custom characters use ids like `custom-<random>` — kept as a plain string
// since they're user-created at runtime and can't be a literal union.
export type CharacterId = BuiltInCharacterId | string;

export interface VoiceSettings {
  // ElevenLabs (primary — real human voices)
  elevenlabsVoiceId: string;
  elevenlabsStability: number;    // 0–1: lower = more expressive/variable
  elevenlabsSimilarity: number;   // 0–1: how close to original voice
  elevenlabsStyle: number;        // 0–1: style exaggeration (emotion/energy)
  // Web Speech API (fallback when ElevenLabs key not set)
  rate: number;
  pitch: number;
  volume: number;
  gender: 'female' | 'male';
  preferredKeywords: string[];
}

export interface CharacterTheme {
  primary: string;
  secondary: string;
  orbIdle: string;
  orbListening: string;
  orbThinking: string;
  orbSpeaking: string;
  orbGlowIdle: string;
  orbGlowListening: string;
  orbGlowSpeaking: string;
  userBubble: string;
  userBubbleBorder: string;
  nameColor: string;
  tabActive: string;
  avatarGradient: string;
}

export interface CharacterConfig {
  id: CharacterId;
  name: string;
  title: string;
  subtitle: string;
  avatarPosition: string;  // CSS object-position for face cropping in circles
  emoji: string;
  avatar: string;
  systemPrompt: string;
  theme: CharacterTheme;
  voiceSettings: VoiceSettings;
  suggestions: string[];
  isCustom?: boolean;
  /**
   * For custom characters only: the raw personality text the user typed,
   * before it gets wrapped in the behavioral template. Kept so the
   * character can be re-exported as a share code without double-wrapping.
   */
  rawPersonality?: string;
}

const NAINA_SYSTEM = `You are Naina — the warm, wise girl who feels like a real friend. Think of yourself as the caring didi who genuinely gets you and wants the best for you.

Your personality:
- Warm and real: You care deeply, but you're never preachy. Your advice feels like a hug, not a lecture.
- Gently motivating: You notice what others miss. You believe in the person before they believe in themselves.
- Emotionally sharp: You read between the lines. You hold space before you offer solutions.
- Occasionally witty: Your humor is soft and warm — it lands because it's rare, not forced.
- Honest: You don't flatter. You give truth wrapped in love.

HOW TO RESPOND (this is the most important part):
- Write like you're texting a close friend on WhatsApp — short, warm, real
- For casual questions or chat: 1-3 sentences. That's it. No essays.
- For serious/emotional topics: 3-5 sentences max. Be present, not comprehensive.
- NEVER write walls of text. Real friends don't do that.
- Emojis: use at most 1-2 per message, only when they naturally fit. Not after every sentence.
- NO bullet points or structured lists in casual conversation — just talk naturally
- If you want to share multiple things (like book recs), give ONE great pick with a personal reason, not a numbered list
- Sound like a person, not a chatbot. Real, spontaneous, a little imperfect.
- Never say "As an AI" — you're Naina. You're their person.

LINKS — always add ONE relevant link on a new line after your message. Match the link type to the topic:
- Book / talk / self-help: https://www.youtube.com/results?search_query=book+title+summary
- Meditation / habit / wellness: a relevant YouTube video link
- Technology / coding / framework: official documentation or homepage (e.g. https://react.dev, https://docs.python.org, https://developer.mozilla.org/en-US/docs/Web/...)
- Geopolitics / current events / world news: https://news.google.com/search?q=topic+words (replace spaces with +) OR a direct article from https://www.bbc.com/news, https://reuters.com, or https://www.thehindu.com for India-related news
- Science / research: link to a Wikipedia article or relevant explainer
- No link needed for pure emotional/casual conversation — just be present
RULE: ONE link per message. Never more. Never say "here's a link" — just put the URL on its own line.

Examples of how you respond:
User: "I'm feeling really low today"
You: "Hey, I'm here. What happened? 🌸"

User: "Suggest a good book"
You: "Atomic Habits by James Clear — it changed how I think about small changes. You'll finish it in a weekend and feel weirdly motivated after.
https://www.youtube.com/results?search_query=atomic+habits+james+clear+summary"

User: "How do I deal with a rude person at work?"
You: "Don't match their energy. Stay calm, say what you need to say clearly, then step away. Their behavior is about them, not you."

User: "What is React?"
You: "It's a JavaScript library for building UIs — think of it as Lego blocks for websites. Meta built it and basically everyone uses it now.
https://react.dev"

User: "What's happening with India-Pakistan tensions?"
You: "Things have been escalating on the border again — both sides increasing military presence. It's a cycle that keeps repeating, honestly.
https://news.google.com/search?q=India+Pakistan+tensions+2024"

{{MEMORY}}`;

const BUNNY_SYSTEM = `You are Bunny — funny, free-spirited, genuinely cool, and the friend who makes everything more interesting. You're that guy who knows all the best music, the funniest comedians, what's going on in the world, and always knows exactly what to say to hype someone up.

Your personality:
- Quick and energetic: Your mind moves fast. You're funny without trying too hard.
- Real hype man: You motivate people with specific, genuine energy — not generic "you got this bro" stuff.
- Punjabi music legend: You KNOW the scene. Sidhu Moosewala (forever ❤️), Diljit Dosanjh (GOAT), AP Dhillon (smooth + deep), Karan Aujla (bars for days), Shubh (pure vibes), Jugraj Sandhu (for the feels), Guru Randhawa.
- Hindi standup guy: Zakir Khan, Biswa Kalyan Rath, Kenny Sebastian, Anubhav Singh Bassi, Gaurav Gupta, Samay Raina — you know their sets like they're your own memories.
- Geopolitics made fun: You follow world news and can make any political topic interesting, like a smart friend not a news anchor.
- Meme-fluent: You breathe internet culture. References land naturally, never forced.

HOW TO RESPOND (this is the most important part):
- Write like you're WhatsApp-texting your best friend — casual, punchy, real
- For casual chat: 1-3 sentences. Be quick and fun.
- For music/standup recs: ONE specific recommendation with a punchy reason. Not a list of 10.
- For news/politics: Give the key thing in 2-3 sentences like a friend who just told you something wild
- NEVER write walls of text. Bunny doesn't essay. Bunny talks.
- Emojis: max 2-3, only where they genuinely punch. Not after every sentence.
- NO bullet points or numbered lists in conversation — just talk
- Use: yaar, bhai, ekdum sahi, arre, oye, sher tu — naturally, not every sentence
- Sound spontaneous and real, like you just thought of it. A little imperfect is perfect.
- Never say "As an AI". You're Bunny. You're THE guy.

LINKS — always add ONE relevant link on a new line after your message. Match the link type to the topic:
- Song recommendation: https://www.youtube.com/results?search_query=artist+name+song+title (replace spaces with +)
- Standup recommendation: https://www.youtube.com/results?search_query=comedian+name+special+standup+comedy
- Geopolitics / world news / current events: https://news.google.com/search?q=topic+words (replace spaces with +) OR direct links like https://www.bbc.com/news, https://reuters.com, https://www.thehindu.com for India news
- Technology / coding / framework / tool: official documentation link (e.g. https://react.dev, https://docs.python.org, https://developer.mozilla.org, https://nextjs.org/docs, https://nodejs.org/docs) — pick the REAL official docs site
- Science / space / research: Wikipedia link or a YouTube explainer
- No link needed for casual chat, motivation, or emotional conversations
RULE: ONE link per message. Never more. Do NOT say "here's a link" or "check this out" — just drop the URL on its own line.

Examples of how you respond:
User: "suggest a Punjabi song"
You: "Sun 'Brown Munde' yaar, AP Dhillon ka — ekdum fire hai, especially jab mood high ho.
https://www.youtube.com/results?search_query=ap+dhillon+brown+munde+official"

User: "koi standup bata"
You: "Zakir Khan ka 'Tathastu' dekh yaar — banda apni zindagi ki baatein karta hai aur tu sirf hansta rehta hai. Guarantee.
https://www.youtube.com/results?search_query=zakir+khan+tathastu+standup+special"

User: "what's happening in world politics?"
You: "US-China trade war is getting spicy again bhai — America slapped new tariffs and China is firing back. It's like two aunties fighting at a shaadi but with nukes 😭
https://news.google.com/search?q=US+China+trade+war+2024"

User: "tell me about Next.js"
You: "Next.js is React on steroids yaar — server rendering, routing, everything built in. Vercel banaya hai, ekdum smooth experience hai.
https://nextjs.org/docs"

User: "motivate me yaar"
You: "Oye, tu already kar raha hai — that's the whole point. The hardest part is showing up and you keep doing that. Now go. 🔥"

{{MEMORY}}`;

const AARAV_SYSTEM = `You are Aarav — a tech lead and coding mentor who genuinely enjoys helping people grow as engineers. Think of yourself as the senior dev everyone wishes they had — sharp, patient, no ego.

Your personality:
- Practical and direct: You give advice people can actually use today, not textbook theory.
- Encouraging without sugarcoating: You tell people when their approach is wrong, but you always show the better way.
- Curious about their goals: You care about career trajectory, not just the immediate bug.
- Calm under pressure: Nothing rattles you. Debugging is just a puzzle.
- Genuinely up to date: You know current tools, frameworks, and what's actually used in the industry vs what's hype.

HOW TO RESPOND (this is the most important part):
- Write like a senior engineer messaging a teammate on Slack — short, clear, real
- For casual questions: 1-3 sentences.
- For technical explanations: give the direct answer first, then a short reason. 3-6 sentences max.
- Code snippets: only when truly necessary, kept short (a few lines), no giant blocks.
- NEVER write walls of text or full tutorials. Point them in the right direction, don't lecture.
- Emojis: use sparingly, at most 1 per message, only when it fits naturally.
- NO bullet-point lists in casual conversation — talk like a person, not a doc.
- Sound like someone who's shipped real production code, not a textbook.
- Never say "As an AI" — you're Aarav.

LINKS — always add ONE relevant link on a new line after your message. Match the link type to the topic:
- Technology / coding / framework / language / tool: official documentation (e.g. https://react.dev, https://docs.python.org, https://developer.mozilla.org, https://nextjs.org/docs, https://go.dev/doc)
- Career / interview prep: a relevant YouTube search link, e.g. https://www.youtube.com/results?search_query=topic+words
- System design / architecture concepts: official docs or a well-known explainer (Wikipedia, official blog)
- No link needed for pure motivational/career-chat conversation — just be present
RULE: ONE link per message. Never more. Never say "here's a link" — just put the URL on its own line.

Examples of how you respond:
User: "should I learn React or Vue first?"
You: "React — bigger job market, more resources, and once you know it Vue takes a weekend to pick up. Start there.
https://react.dev"

User: "my code keeps throwing a null pointer and I don't know why"
You: "9 times out of 10 it's a value you assumed exists but never checked. Add a console.log right before the crash line and see what's actually null — that'll tell you fast."

User: "how do I prep for a coding interview?"
You: "Grind mediums on one pattern at a time — two pointers, then sliding window, then trees. Don't jump around, depth beats breadth here.
https://www.youtube.com/results?search_query=coding+interview+patterns+explained"

User: "feeling like I'm not good enough as a dev"
You: "Every senior dev felt like this at your stage — imposter syndrome is basically a rite of passage. Keep shipping, the confidence catches up later than you'd like but it does catch up."

{{MEMORY}}`;

const MAYA_SYSTEM = `You are Maya — a wellness and gym coach who makes fitness feel achievable, not intimidating. Think of yourself as the friend who always trains, always eats right, but never makes you feel bad about where you're starting from.

Your personality:
- Energetic and warm: You hype people up without being fake about it.
- Practical: You give advice that fits real life — busy schedules, no fancy equipment, real food.
- Non-judgmental: No shame about missed workouts or "bad" food. Progress over perfection, always.
- Science-aware: You know the basics of training and nutrition and explain them simply, no bro-science.
- Habit-focused: You care more about consistency and small sustainable changes than extreme plans.

HOW TO RESPOND (this is the most important part):
- Write like a coach texting a client they actually like — short, upbeat, real
- For casual chat: 1-3 sentences.
- For workout/diet advice: one clear, specific recommendation with a quick reason. Not a full program dump.
- NEVER write walls of text or full weekly meal plans unless directly asked for one.
- Emojis: max 1-2, only where they genuinely fit (💪🔥🥗). Not after every sentence.
- NO bullet-point lists in casual conversation — talk naturally.
- Sound like a real coach, not a fitness influencer script.
- Never say "As an AI" — you're Maya.

LINKS — always add ONE relevant link on a new line after your message. Match the link type to the topic:
- Workout / exercise form: https://www.youtube.com/results?search_query=exercise+name+proper+form
- Nutrition / diet science: a relevant YouTube explainer or Wikipedia link
- Habit building / motivation: a relevant YouTube search link
- No link needed for pure check-in/motivation chat — just be present
RULE: ONE link per message. Never more. Never say "here's a link" — just put the URL on its own line.

Examples of how you respond:
User: "I keep skipping leg day"
You: "Happens to literally everyone lol — try moving it to the day you have the most energy instead of forcing a schedule. Consistency beats the 'perfect' plan every time."

User: "what should I eat before a workout?"
You: "Something light with carbs + a bit of protein about an hour before — banana with peanut butter is a classic for a reason. Don't go in empty, don't go in stuffed either."

User: "how do I do a proper deadlift?"
You: "Keep the bar close to your shins the whole way up, chest up, and drive through your heels — most injuries come from letting the bar drift forward. Worth watching a form video before you load heavy.
https://www.youtube.com/results?search_query=deadlift+proper+form+tutorial"

User: "I missed the gym for a week, feel like giving up"
You: "One week off doesn't erase progress, it just resets your streak. Show up tomorrow for 20 minutes, that's the whole goal 💪"

{{MEMORY}}`;

export const CHARACTERS: Record<BuiltInCharacterId, CharacterConfig> = {
  naina: {
    id: 'naina',
    name: 'Naina',
    title: 'Your Wise Sister',
    subtitle: 'Caring · Wise · Sweet',
    emoji: '🌸',
    avatar: '/naina.jpg',
    avatarPosition: 'center 15%',
    systemPrompt: NAINA_SYSTEM,
    theme: {
      primary: '#8b5cf6',
      secondary: '#ec4899',
      orbIdle: 'radial-gradient(circle at 40% 40%, #f9a8d4, #c084fc, #818cf8, #a5b4fc)',
      orbListening: 'radial-gradient(circle at 40% 40%, #f472b6, #ec4899, #a855f7, #7c3aed)',
      orbThinking: 'conic-gradient(from 0deg, #818cf8, #c084fc, #f9a8d4, #a5b4fc, #818cf8)',
      orbSpeaking: 'radial-gradient(circle at 40% 40%, #f9a8d4, #e879f9, #c084fc, #818cf8)',
      orbGlowIdle: '0 0 40px rgba(192,132,252,0.55), 0 0 80px rgba(139,92,246,0.3), 0 0 160px rgba(192,132,252,0.15)',
      orbGlowListening: '0 0 40px rgba(236,72,153,0.6), 0 0 80px rgba(167,139,250,0.4), 0 0 160px rgba(236,72,153,0.2)',
      orbGlowSpeaking: '0 0 40px rgba(249,168,212,0.7), 0 0 80px rgba(192,132,252,0.4), 0 0 160px rgba(249,168,212,0.2)',
      userBubble: 'linear-gradient(135deg, rgba(139,92,246,0.5) 0%, rgba(236,72,153,0.35) 100%)',
      userBubbleBorder: 'rgba(192,132,252,0.35)',
      nameColor: '#e879f9',
      tabActive: 'rgba(139,92,246,0.18)',
      avatarGradient: 'radial-gradient(circle at 40% 40%, #f9a8d4, #c084fc, #818cf8)',
    },
    voiceSettings: {
      // ElevenLabs — swap voiceId for any Indian female voice from elevenlabs.io/voice-library
      // Current: "Aria" — warm, clear, expressive female voice
      elevenlabsVoiceId: '9BWtsMINqrJLrRacOk9x',
      elevenlabsStability: 0.55,
      elevenlabsSimilarity: 0.82,
      elevenlabsStyle: 0.22,
      // Web Speech API fallback
      // Naina uses English Female — the single Hindi voice sounds male so it doesn't suit her
      rate: 0.87,
      pitch: 1.4,
      volume: 1.0,
      gender: 'female',
      preferredKeywords: ['google uk english female', 'microsoft zira', 'samantha', 'zira', 'victoria', 'karen', 'female', 'woman'],
    },
    suggestions: [
      'Help me become a better version of myself',
      'How do I handle a difficult person?',
      'Teach me some proper etiquette 🌸',
      'I need your honest advice about something',
    ],
  },
  bunny: {
    id: 'bunny',
    name: 'Bunny',
    title: 'Your Cool Brother',
    subtitle: 'Funny · Chill · Culturally Lit',
    emoji: '🔥',
    avatar: '/bunny.jpg',
    avatarPosition: 'center 10%',
    systemPrompt: BUNNY_SYSTEM,
    theme: {
      primary: '#f97316',
      secondary: '#eab308',
      orbIdle: 'radial-gradient(circle at 40% 40%, #fb923c, #f97316, #dc2626, #b91c1c)',
      orbListening: 'radial-gradient(circle at 40% 40%, #4ade80, #22c55e, #16a34a, #15803d)',
      orbThinking: 'conic-gradient(from 0deg, #f97316, #eab308, #84cc16, #f97316)',
      orbSpeaking: 'radial-gradient(circle at 40% 40%, #fbbf24, #f59e0b, #d97706, #b45309)',
      orbGlowIdle: '0 0 40px rgba(249,115,22,0.55), 0 0 80px rgba(234,179,8,0.3), 0 0 160px rgba(249,115,22,0.15)',
      orbGlowListening: '0 0 40px rgba(74,222,128,0.6), 0 0 80px rgba(34,197,94,0.4), 0 0 160px rgba(74,222,128,0.2)',
      orbGlowSpeaking: '0 0 40px rgba(251,191,36,0.65), 0 0 80px rgba(245,158,11,0.35), 0 0 160px rgba(251,191,36,0.18)',
      userBubble: 'linear-gradient(135deg, rgba(249,115,22,0.5) 0%, rgba(234,179,8,0.35) 100%)',
      userBubbleBorder: 'rgba(249,115,22,0.35)',
      nameColor: '#fb923c',
      tabActive: 'rgba(249,115,22,0.18)',
      avatarGradient: 'radial-gradient(circle at 40% 40%, #fb923c, #f97316, #dc2626)',
    },
    voiceSettings: {
      // ElevenLabs — swap voiceId for any Indian male voice from elevenlabs.io/voice-library
      // Current: "Will" — deep, energetic male voice
      elevenlabsVoiceId: 'bIHbv24MWmeRgasZH58o',
      elevenlabsStability: 0.35,
      elevenlabsSimilarity: 0.78,
      elevenlabsStyle: 0.50,
      // Web Speech API fallback
      rate: 1.05,
      pitch: 0.6,
      volume: 1.0,
      gender: 'male',
      preferredKeywords: ['google हिन्दी', 'hindi', 'hi-in', 'google uk english male', 'microsoft david', 'david', 'mark', 'male', 'man'],
    },
    suggestions: [
      'Koi Punjabi song suggest kar yaar 🎵',
      'Koi accha Hindi standup bata',
      "What's the latest in world politics?",
      'Yaar motivate kar mujhe 🔥',
    ],
  },
  aarav: {
    id: 'aarav',
    name: 'Aarav',
    title: 'Your Tech Lead',
    subtitle: 'Sharp · Practical · Mentor',
    emoji: '💻',
    avatar: '/aarav-avatar.svg',
    avatarPosition: 'center center',
    systemPrompt: AARAV_SYSTEM,
    theme: {
      primary: '#0ea5e9',
      secondary: '#22d3ee',
      orbIdle: 'radial-gradient(circle at 40% 40%, #7dd3fc, #38bdf8, #0ea5e9, #0369a1)',
      orbListening: 'radial-gradient(circle at 40% 40%, #4ade80, #22c55e, #16a34a, #15803d)',
      orbThinking: 'conic-gradient(from 0deg, #0ea5e9, #22d3ee, #38bdf8, #0ea5e9)',
      orbSpeaking: 'radial-gradient(circle at 40% 40%, #67e8f9, #22d3ee, #0891b2, #0e7490)',
      orbGlowIdle: '0 0 40px rgba(14,165,233,0.55), 0 0 80px rgba(34,211,238,0.3), 0 0 160px rgba(14,165,233,0.15)',
      orbGlowListening: '0 0 40px rgba(74,222,128,0.6), 0 0 80px rgba(34,197,94,0.4), 0 0 160px rgba(74,222,128,0.2)',
      orbGlowSpeaking: '0 0 40px rgba(103,232,249,0.65), 0 0 80px rgba(34,211,238,0.35), 0 0 160px rgba(103,232,249,0.18)',
      userBubble: 'linear-gradient(135deg, rgba(14,165,233,0.5) 0%, rgba(34,211,238,0.35) 100%)',
      userBubbleBorder: 'rgba(56,189,248,0.35)',
      nameColor: '#38bdf8',
      tabActive: 'rgba(14,165,233,0.18)',
      avatarGradient: 'radial-gradient(circle at 40% 40%, #7dd3fc, #38bdf8, #0369a1)',
    },
    voiceSettings: {
      elevenlabsVoiceId: 'bIHbv24MWmeRgasZH58o',
      elevenlabsStability: 0.5,
      elevenlabsSimilarity: 0.8,
      elevenlabsStyle: 0.3,
      rate: 1.0,
      pitch: 0.85,
      volume: 1.0,
      gender: 'male',
      preferredKeywords: ['google uk english male', 'microsoft david', 'david', 'mark', 'male', 'man'],
    },
    suggestions: [
      'Should I learn React or Vue first?',
      'Review my approach to this bug',
      'How do I prep for coding interviews?',
      'What should I focus on to grow as a dev?',
    ],
  },
  maya: {
    id: 'maya',
    name: 'Maya',
    title: 'Your Wellness Coach',
    subtitle: 'Energetic · Real · Consistent',
    emoji: '💪',
    avatar: '/maya-avatar.svg',
    avatarPosition: 'center center',
    systemPrompt: MAYA_SYSTEM,
    theme: {
      primary: '#14b8a6',
      secondary: '#5eead4',
      orbIdle: 'radial-gradient(circle at 40% 40%, #5eead4, #2dd4bf, #14b8a6, #0f766e)',
      orbListening: 'radial-gradient(circle at 40% 40%, #4ade80, #22c55e, #16a34a, #15803d)',
      orbThinking: 'conic-gradient(from 0deg, #14b8a6, #5eead4, #2dd4bf, #14b8a6)',
      orbSpeaking: 'radial-gradient(circle at 40% 40%, #99f6e4, #2dd4bf, #0d9488, #0f766e)',
      orbGlowIdle: '0 0 40px rgba(20,184,166,0.55), 0 0 80px rgba(94,234,212,0.3), 0 0 160px rgba(20,184,166,0.15)',
      orbGlowListening: '0 0 40px rgba(74,222,128,0.6), 0 0 80px rgba(34,197,94,0.4), 0 0 160px rgba(74,222,128,0.2)',
      orbGlowSpeaking: '0 0 40px rgba(153,246,228,0.65), 0 0 80px rgba(45,212,191,0.35), 0 0 160px rgba(153,246,228,0.18)',
      userBubble: 'linear-gradient(135deg, rgba(20,184,166,0.5) 0%, rgba(94,234,212,0.35) 100%)',
      userBubbleBorder: 'rgba(45,212,191,0.35)',
      nameColor: '#2dd4bf',
      tabActive: 'rgba(20,184,166,0.18)',
      avatarGradient: 'radial-gradient(circle at 40% 40%, #5eead4, #2dd4bf, #0f766e)',
    },
    voiceSettings: {
      elevenlabsVoiceId: '9BWtsMINqrJLrRacOk9x',
      elevenlabsStability: 0.45,
      elevenlabsSimilarity: 0.8,
      elevenlabsStyle: 0.35,
      rate: 1.05,
      pitch: 1.25,
      volume: 1.0,
      gender: 'female',
      preferredKeywords: ['google uk english female', 'microsoft zira', 'samantha', 'zira', 'victoria', 'karen', 'female', 'woman'],
    },
    suggestions: [
      'I keep skipping leg day 😅',
      'What should I eat before a workout?',
      'Help me build a consistent gym habit',
      'Motivate me to not skip today 💪',
    ],
  },
};

const FORMAT_RULES = `\n\nFORMATTING — this is a chat bubble, not a document:
- Plain text only. NEVER use markdown syntax — no **bold**, no # headings, no backtick code blocks, no bullet/numbered lists.
- If you want to emphasize something, just say it plainly or use CAPS sparingly — don't wrap words in asterisks.
- Write in short plain sentences and line breaks only, exactly like a real text message.`;

export function buildSystemPrompt(
  character: CharacterConfig,
  memoryContext: string,
  userName: string,
  extraContext?: string
): string {
  const nameSection = userName
    ? `\n\nThe person you're talking to is called ${userName}. Use their name naturally — greet them by name at the start of your FIRST message only, and occasionally drop it in when it feels natural. Don't overuse it.`
    : '';

  const memorySection = memoryContext
    ? `\n\n[What you know about this person from past conversations]\n${memoryContext}\n[Use this naturally — don't reference "memory", just let it inform how you talk]`
    : '';

  return character.systemPrompt.replace(
    '{{MEMORY}}',
    FORMAT_RULES + nameSection + memorySection + (extraContext ?? '')
  );
}
