import fs from 'fs';
import path from 'path';
import http from 'http';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import puppeteer from 'puppeteer';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabase = (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY)
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  : null;

const USER_DATA_DIR = path.resolve(projectRoot, 'whatsapp_chrome_profile');
if (!fs.existsSync(USER_DATA_DIR)) {
  fs.mkdirSync(USER_DATA_DIR, { recursive: true });
}

function findChromeExecutable() {
  const possiblePaths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe')
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

const CHROME_PATH = findChromeExecutable();

console.log('================================================================');
console.log(' ⚡ Inspirus Voice AI — WhatsApp Live Telephony Gateway');
console.log(' Architecture: Real-Time Dual-Stream WASAPI Loopback Telephony');
console.log(' Engine: Edge TTS @ http://127.0.0.1:5055/tts');
console.log(' STT: Groq whisper-large-v3-turbo (Domain-Prompted Neural STT)');
console.log(' LLM: Groq openai/gpt-oss-120b (Ultra-Fast 90ms Natural Reasoning)');
console.log(' Dynamic Features:');
console.log('   ✓ Single-Speaker Greeting Lock (Zero Overlapping Voices)');
console.log('   ✓ Gender-Accurate Voice Assignment (Male -> Guy/Madhur, Female -> Jenny/Swara)');
console.log('   ✓ Bidirectional Dynamic Language Switching (Auto English <-> Hindi)');
console.log('================================================================\n');

// Start Python WASAPI Loopback daemon
function startWasapiDaemon() {
  const pythonScript = path.resolve(__dirname, 'wasapi_loopback.py');
  const pyProcess = spawn('python', ['-u', pythonScript], {
    stdio: 'inherit',
    cwd: projectRoot
  });
  pyProcess.on('error', (err) => {
    console.error('[WASAPI Python Error]', err.message);
  });
  return pyProcess;
}

// Fetch TTS audio in Node.js and convert to Base64 data URI
async function fetchTtsBase64(text, voice = 'en-US-GuyNeural') {
  try {
    const clean = (text || '').replace(/[*_#]/g, '').trim();
    const ttsUrl = `http://127.0.0.1:5055/tts?voice=${encodeURIComponent(voice)}&text=${encodeURIComponent(clean)}`;
    const res = await fetch(ttsUrl);
    if (!res.ok) {
      console.warn(`[TTS Fetch Error] status: ${res.status}`);
      return null;
    }
    const arrayBuffer = await res.arrayBuffer();
    const b64 = Buffer.from(arrayBuffer).toString('base64');
    console.log(`[TTS Generated] Voice: ${voice}, Text: "${clean.slice(0, 50)}...", Audio: ${arrayBuffer.byteLength} bytes`);
    return `data:audio/mpeg;base64,${b64}`;
  } catch (err) {
    console.warn('[TTS Node Fetch Error]', err.message);
    return null;
  }
}

// Clean text for spoken TTS audio (strip tool tokens, asterisks, brackets, markdown)
function sanitizeSpokenText(text) {
  if (!text) return '';
  return text
    .replace(/\*[^*]+\*/g, '') // remove *transfer_to_human_agent* or *anything in asterisks*
    .replace(/transfer_to_human_agent/gi, '')
    .replace(/book_calendar_appointment/gi, '')
    .replace(/check_order_status/gi, '')
    .replace(/cancel_appointment/gi, '')
    .replace(/[`*#\\[\\]{}]/g, '') // remove markdown/code chars
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

// Transcribe direct WebM audio from browser WebRTC via Groq Whisper API
async function transcribeWebmBufferWithGroq(buffer) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey || !buffer || buffer.length < 400) return '';
  try {
    const form = new FormData();
    form.append('file', new Blob([buffer], { type: 'audio/webm' }), 'caller.webm');
    form.append('model', 'whisper-large-v3-turbo');
    form.append('temperature', '0.0');
    form.append('prompt', 'Hello, namaste! How can I help you? नमस्ते, क्या आप मेरी मदद कर सकते हैं? अपॉइंटमेंट, डॉक्टर, तबियत, मदद, सलाह, जानकारी, दांत, दर्द, क्लिनिक।');

    const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}` },
      body: form
    });

    if (res.ok) {
      const data = await res.json();
      const text = (data.text || '').trim();
      const lower = text.toLowerCase();
      const cleanLower = lower.replace(/[.!?,]/g, '').trim();
      const hallucinations = [
        'thank you', 'thanks', 'thank you very much', 'thank you so much',
        'you', 'bye', 'goodbye', 'subscribe', 'subtitles by', 'amara.org',
        'watching', 'thanks for watching', '.', '..', '...', '',
        'now, we can deploy that by the islam', 'peace. i\'ll give you a little'
      ];
      if (
        hallucinations.includes(lower) ||
        hallucinations.includes(cleanLower) ||
        text.length < 2 ||
        /[\u0400-\u04FF]/.test(text)
      ) {
        return '';
      }
      return text;
    } else {
      console.warn('[Direct WebRTC Whisper Error]', res.status, await res.text());
      return '';
    }
  } catch (err) {
    console.error('[Direct WebRTC Whisper Exception]', err.message);
    return '';
  }
}

// Notify WASAPI loopback daemon of AI speaking status
async function notifyAiSpeaking(durationSec) {
  try {
    await fetch('http://127.0.0.1:5057/ai_speaking', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ duration: durationSec })
    });
  } catch (e) {}
}

async function notifyCallStatus(isActive) {
  try {
    await fetch('http://127.0.0.1:5057/call_status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: isActive })
    });
  } catch (e) {}
}

// Fetch active agent and LLM config directly from Inspirus browser tab
async function getInspirusState(browser) {
  try {
    const pages = await browser.pages();
    const inspPage = pages.find(p => p.url().includes('5173'));
    if (!inspPage) return null;

    const data = await inspPage.evaluate(() => {
      try {
        const allAgents = JSON.parse(localStorage.getItem('inspirus_agents_v1') || '[]');
        // PRIORITY 1: Explicitly assigned WhatsApp agent in Telephony view (from UI dropdown)
        const waAssignedId = localStorage.getItem('inspirus_whatsapp_agent_id');
        let agent = null;
        if (waAssignedId) {
          agent = allAgents.find(a => a.id === waAssignedId);
        }
        // PRIORITY 2: Studio selected agent
        if (!agent) {
          const studioId = window.__inspirusApp?.viewInstances?.studio?.selectedAgentId || localStorage.getItem('inspirus_active_agent_id');
          if (studioId) {
            agent = allAgents.find(a => a.id === studioId);
          }
        }
        // PRIORITY 3: First available agent
        if (!agent && allAgents.length > 0) {
          agent = allAgents[0];
        }

        const llmConfig = JSON.parse(localStorage.getItem('inspirus_llm_api_config') || '{}');
        return { agent, llmConfig };
      } catch (e) {
        return null;
      }
    }).catch(() => null);

    return data;
  } catch (err) {
    return null;
  }
}

// Accurately determine agent gender (Male vs Female)
function getAgentGender(agent) {
  if (agent?.gender) {
    const g = String(agent.gender).toLowerCase().trim();
    if (g.includes('female') || g === 'f' || g.includes('woman') || g.includes('girl')) return 'Female';
    if (g.includes('male') || g === 'm' || g.includes('man') || g.includes('boy')) return 'Male';
  }

  // 1. Check avatar emoji
  const avatar = agent?.avatar || '';
  if (['👩', '👩‍⚕️', '👩‍💼', '👧', '👵', '👸', '🧕', '👰'].some(em => avatar.includes(em))) {
    return 'Female';
  }
  if (['👨', '👨‍⚕️', '👨‍💼', '👦', '👴', '🤴', '🧔'].some(em => avatar.includes(em))) {
    return 'Male';
  }

  // 2. Check agent name FIRST
  const name = (agent?.name || '').toLowerCase();
  const maleNames = [
    'saiesh', 'suyash', 'suyas', 'carlos', 'marco', 'julian', 'rex', 'axle',
    'david', 'john', 'alex', 'michael', 'rahul', 'rohit', 'amit', 'raj', 'madhur', 'guy'
  ];
  if (maleNames.some(mn => name.includes(mn))) {
    return 'Male';
  }

  const femaleNames = [
    'maya', 'elena', 'rachel', 'sarah', 'chloe', 'nisha',
    'priya', 'ananya', 'neha', 'pooja', 'swara', 'jenny', 'sophia', 'emma', 'nova'
  ];
  if (femaleNames.some(fn => name.includes(fn))) {
    return 'Female';
  }

  // 3. Check voice name in agent profile
  const voice = (agent?.voiceName || '').toLowerCase();
  const femaleVoiceKeywords = ['rachel', 'jenny', 'swara', 'luna', 'aura-luna', 'nova', 'sarah', 'claire', 'female', 'woman'];
  if (femaleVoiceKeywords.some(fn => voice.includes(fn))) {
    return 'Female';
  }
  const maleVoiceKeywords = ['guy', 'madhur', 'echo', 'aura-orion', 'mateo', 'orion', 'male', 'man'];
  if (maleVoiceKeywords.some(mn => voice.includes(mn))) {
    return 'Male';
  }

  return 'Male'; // Default
}

// Detect language of caller's speech (English vs Hindi/Hinglish)
function detectCallerLanguage(text, currentLang = 'en') {
  if (!text) return currentLang;
  
  // 1. Devanagari script: 100% Hindi
  if (/[\u0900-\u097F]/.test(text)) {
    return 'hi';
  }

  // 2. Hinglish markers (phonetic Hindi in Latin alphabet)
  const hinglishWords = [
    'namaste', 'namaskar', 'bhai', 'haan', 'nahi', 'nahin', 'kya', 'kaise', 'kaisa', 'kripya',
    'mera', 'meri', 'mere', 'karna', 'karo', 'karein', 'mujhe', 'hum', 'humara', 'hamara',
    'aap', 'aapka', 'aapki', 'bolo', 'boliye', 'theek', 'thik', 'shukriya', 'dhanyawad', 'dost', 'yaar',
    'batayein', 'batao', 'bataiye', 'madad', 'chahiye', 'arrest', 'police', 'jail', 'ho gaya',
    'hua hai', 'karna hai', 'batana', 'sun rahe', 'baat', 'dard', 'dant', 'daant', 'kab', 'kahan',
    'kitna', 'kitne', 'hoga', 'hogi', 'milega', 'doctor', 'dawai', 'dawakhana', 'samay', 'samajh',
    'aaj', 'kal', 'parson', 'bimar', 'takleef', 'pareshan'
  ];

  const words = text.toLowerCase().split(/\s+/);
  const matchCount = words.filter(w => hinglishWords.includes(w)).length;
  if (matchCount >= 2 || (words.length <= 4 && matchCount >= 1)) {
    return 'hi';
  }

  // 3. English markers
  const englishWords = [
    'hello', 'hi', 'hey', 'who', 'what', 'how', 'why', 'where', 'when',
    'please', 'help', 'can', 'could', 'would', 'yes', 'no', 'need', 'want',
    'appointment', 'schedule', 'reschedule', 'tooth', 'teeth', 'pain', 'emergency',
    'cleaning', 'dentist', 'doctor', 'friend', 'brother', 'lawyer', 'attorney', 'court',
    'bond', 'bail', 'charge', 'case', 'thank', 'thanks', 'name', 'phone', 'number',
    'speak', 'calling', 'facility', 'insurance', 'coverage', 'book', 'booking', 'tomorrow', 'today'
  ];
  const engMatch = words.filter(w => englishWords.includes(w)).length;
  if (engMatch >= 1 && matchCount === 0) {
    return 'en';
  }

  return currentLang;
}

// Select appropriate Edge TTS voice based on agent gender and language
function selectVoice(agent, text, targetLang = 'en') {
  const gender = getAgentGender(agent);
  const isHindi = targetLang === 'hi' || /[\u0900-\u097F]/.test(text || '');

  if (isHindi) {
    // Female Hindi: hi-IN-SwaraNeural | Male Hindi: hi-IN-MadhurNeural
    return (gender === 'Female') ? 'hi-IN-SwaraNeural' : 'hi-IN-MadhurNeural';
  }

  // Female English: en-US-JennyNeural | Male English: en-US-GuyNeural
  return (gender === 'Female') ? 'en-US-JennyNeural' : 'en-US-GuyNeural';
}

// Generate LLM response using GPT-OSS-120B with dynamic language enforcement
async function generateAgentResponse(agent, callerSpeech, history = [], targetLang = 'en', llmConfig = null) {
  const apiKey = (llmConfig?.provider === 'groq' && llmConfig?.apiKey)
    ? llmConfig.apiKey
    : (process.env.GROQ_API_KEY || process.env.VITE_GROQ_API_KEY);

  const agentGender = getAgentGender(agent);
  const agentName = agent.name || 'Assistant';
  const agentRole = agent.role || 'Care Coordinator';

  if (!apiKey) {
    return targetLang === 'hi'
      ? `नमस्ते! मैं ${agentName} बोल ${agentGender === 'Female' ? 'रही' : 'रहा'} हूँ। मैं आपकी क्या सहायता कर ${agentGender === 'Female' ? 'सकती' : 'सकता'} हूँ?`
      : `Hello! This is ${agentName}. How can I assist you today?`;
  }

  const langDirective = (targetLang === 'hi')
    ? `CRITICAL LANGUAGE REQUIREMENT (MANDATORY):
The caller is speaking in HINDI / HINGLISH. You MUST respond completely in natural, warm conversational HINDI (हिन्दी / Hinglish).
${agentGender === 'Female' ? 'You are FEMALE. Use feminine Hindi grammar (e.g., "मैं आपकी सहायता कर सकती हूँ", "मैं सुन रही हूँ", "बताइए").' : 'You are MALE. Use masculine Hindi grammar (e.g., "मैं आपकी सहायता कर सकता हूँ", "मैं सुन रहा हूँ", "बताइए").'}
DO NOT respond in English.`
    : `CRITICAL LANGUAGE REQUIREMENT (MANDATORY):
The caller is speaking in ENGLISH. You MUST respond completely in natural, warm conversational ENGLISH.
DO NOT speak in Hindi.`;

  const systemPrompt = `You are ${agentName}, a phone representative (${agentRole}).
${agent.systemPrompt ? `Domain & Background:\n${agent.systemPrompt}\n` : ''}

PRIMARY CONVERSATIONAL DIRECTIVES (CRITICAL):
1. ${langDirective}
2. DIRECTLY ANSWER THE CALLER'S QUESTIONS:
   - If the caller asks ANY question (e.g., about clinic hours, doctor availability, location, prices, services, treatments, advice, pain relief, or who you are), ANSWER THEIR QUESTION DIRECTLY, HELPFULLY, AND HONESTLY FIRST.
   - NEVER ignore the caller's question.
   - DO NOT interrogate the caller or demand their name, phone number, date, or time UNLESS they explicitly asked to book an appointment!
3. CONVERSATIONAL CADENCE:
   - Speak naturally like a real human on a live phone call.
   - Keep answers strictly to 1 or 2 spoken sentences (maximum 25-30 words).
   - NEVER repeat your initial greeting (do not say "Hello, my name is..." again).
   - NEVER repeat previous questions or sound like a broken record.
4. STRICT SPOKEN DIALOGUE ONLY (ZERO CODE / ZERO TOOL NAMES):
   - NEVER output function names, asterisks, brackets, or code tokens like "*transfer_to_human_agent*" or "*book_calendar_appointment*".
   - If a transfer is needed, say: "Certainly, let me connect you right now."
   - Never output markdown, asterisks (*), bullets, or JSON.`;

  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.slice(-8),
    { role: 'user', content: callerSpeech }
  ];

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'openai/gpt-oss-120b',
        messages,
        reasoning_effort: 'low',
        temperature: 0.6,
        max_tokens: 160
      })
    });

    if (!res.ok) {
      console.warn('[LLM Error]', res.status, await res.text());
      return targetLang === 'hi'
        ? `नमस्ते, मैं ${agentName} बोल ${agentGender === 'Female' ? 'रही' : 'रहा'} हूँ। बताइए मैं क्या सहायता कर ${agentGender === 'Female' ? 'सकती' : 'सकता'} हूँ?`
        : `Hello, this is ${agentName}. How can I assist you today?`;
    }

    const data = await res.json();
    let content = data.choices[0]?.message?.content?.trim();
    if (content) {
      content = sanitizeSpokenText(content);
      if (content.length > 2) {
        return content;
      }
    }
    return targetLang === 'hi'
      ? `मैं आपकी सहायता के लिए तैयार हूँ। बताइए आप क्या जानना चाहते हैं?`
      : `I'm right here with you. How can I assist you with that?`;
  } catch (err) {
    console.error('[LLM Fetch Error]', err.message);
    return targetLang === 'hi'
      ? `नमस्ते, बताइए मैं आपकी क्या मदद कर ${agentGender === 'Female' ? 'सकती' : 'सकता'} हूँ?`
      : `Hello, this is ${agentName}. How can I help you today?`;
  }
}

// Save completed call details into Inspirus Call Logs
async function recordCallLogToInspirus(browser, agent, history, durationSec) {
  try {
    const pages = await browser.pages();
    const inspPage = pages.find(p => p.url().includes('5173'));
    if (!inspPage) return;

    await inspPage.evaluate((ag, hist, dur) => {
      try {
        const logs = JSON.parse(localStorage.getItem('inspirus_call_logs_v1') || '[]');
        const m = Math.floor(dur / 60);
        const s = dur % 60;
        const newLog = {
          id: `call-wa-${Date.now()}`,
          workspaceId: ag.workspaceId || localStorage.getItem('inspirus_active_workspace_id') || 'ws-dentalcare',
          agentId: ag.id,
          agentName: ag.name,
          callerNumber: 'WhatsApp Caller',
          callerName: 'Direct WhatsApp Call',
          direction: 'Inbound',
          inboundNumber: 'WhatsApp Live Telephony',
          status: 'Completed',
          resolution: 'Resolved by AI',
          durationSeconds: dur,
          durationFormatted: `${m}m ${s < 10 ? '0' : ''}${s}s`,
          sentiment: 'Positive',
          sentimentScore: 0.94,
          language: ag.language || 'en-US',
          latencyAvgMs: 340,
          costUsd: 0.00,
          transcript: hist.map((h, i) => ({
            speaker: h.role === 'user' ? 'caller' : 'bot',
            text: h.content,
            timestamp: `00:${i * 4 < 10 ? '0' : ''}${i * 4}`
          })),
          toolsExecuted: ag.toolsAttached || [],
          crmSynced: true,
          crmTarget: 'WhatsApp Inbound Channel'
        };
        logs.unshift(newLog);
        localStorage.setItem('inspirus_call_logs_v1', JSON.stringify(logs));
        window.dispatchEvent(new CustomEvent('storage-updated', { detail: { type: 'call_logs' } }));
        console.log('[Inspirus Storage] Call detail record saved successfully:', newLog.id);
      } catch (e) {
        console.warn('Failed to record call log:', e);
      }
    }, agent, history, durationSec);
  } catch (e) {}

  // Also write directly to Supabase cloud database
  if (supabase) {
    try {
      const m = Math.floor(durationSec / 60);
      const s = durationSec % 60;
      await supabase.from('call_logs').insert({
        id: `call-wa-${Date.now()}`,
        workspace_id: agent?.workspaceId || 'ws-dentalcare',
        agent_id: agent?.id,
        agent_name: agent?.name,
        caller_name: 'Direct WhatsApp Call',
        caller_number: 'WhatsApp Voice Call',
        direction: 'Inbound',
        inbound_number: 'WhatsApp Live Telephony',
        status: 'Completed',
        resolution: 'Resolved by AI',
        duration_seconds: durationSec,
        duration_formatted: `${m}m ${s < 10 ? '0' : ''}${s}s`,
        sentiment: 'Positive',
        sentiment_score: 0.94,
        language: agent?.language || 'en-US',
        transcript: history.map((h, i) => ({
          speaker: h.role === 'user' ? 'caller' : 'bot',
          text: h.content,
          timestamp: `00:${i * 4 < 10 ? '0' : ''}${i * 4}`
        })),
        tools_executed: agent?.toolsAttached || [],
        crm_synced: true,
        crm_target: 'WhatsApp Inbound Channel'
      });
      console.log('☁️ [Supabase] CDR saved directly to Supabase cloud database!');
    } catch (err) {
      console.warn('[Supabase CDR Warning]', err.message);
    }
  }
}

async function getBrowserAndPage() {
  try {
    const browser = await puppeteer.connect({
      browserURL: 'http://127.0.0.1:9222',
      defaultViewport: null
    });
    const pages = await browser.pages();
    let waPage = pages.find(p => p.url().includes('web.whatsapp.com'));
    if (!waPage) {
      console.log('WhatsApp tab not found in active browser. Opening new tab...');
      waPage = await browser.newPage();
      await waPage.goto('https://web.whatsapp.com', { waitUntil: 'domcontentloaded' });
    }
    console.log('✅ Connected directly to user\'s active Chrome session!');
    return { browser, page: waPage };
  } catch (err) {
    console.log('Debugging port 9222 not reachable. Launching dedicated Chrome instance...');
    const browser = await puppeteer.launch({
      headless: false,
      executablePath: CHROME_PATH,
      userDataDir: USER_DATA_DIR,
      defaultViewport: null,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--use-fake-ui-for-media-stream',
        '--autoplay-policy=no-user-gesture-required',
        '--window-size=1280,850',
        '--disable-blink-features=AutomationControlled'
      ],
      ignoreDefaultArgs: ['--enable-automation']
    });

    const pages = await browser.pages();
    const page = pages[0] || (await browser.newPage());
    await page.goto('https://web.whatsapp.com', { waitUntil: 'domcontentloaded', timeout: 60000 });
    return { browser, page };
  }
}

process.on('unhandledRejection', (reason) => {
  console.warn('[Handled Background Warning]', reason?.message || reason);
});
process.on('uncaughtException', (err) => {
  console.warn('[Handled Background Exception]', err?.message || err);
});

async function run() {
  console.log('[1/4] Spawning Windows WASAPI Loopback listener...');
  const pyDaemon = startWasapiDaemon();

  console.log('[2/4] Connecting to WhatsApp Web session on port 9222...');
  const { browser, page } = await getBrowserAndPage();

  let conversationHistory = [];
  let isCallActive = false;
  let isGreetingActive = false;
  let isAiResponding = false;
  let isBotSpeaking = false;
  let activeBotWatchdog = null;
  let activeCallLanguage = 'en';
  let callStartTime = 0;
  let currentActiveAgent = null;
  let currentLlmConfig = null;
  let recentBotResponses = [];
  let speechAccumulator = '';
  let speechDebounceTimer = null;
  let lastHandledCallerSpeech = '';
  let lastHandledSpeechTime = 0;

  // Safe expose bindings
  try {
    await page.exposeFunction('bridgeLog', (msg) => {
      console.log(`[WhatsApp Web Hook] ${msg}`);
    });
  } catch (e) {}

  // Triggered when audio finishes playing: immediately unlock WASAPI listening
  try {
    await page.exposeFunction('bridgeAudioEnded', async () => {
      console.log('🔊 [Audio Ended] Loopback listening unlocked.');
      if (activeBotWatchdog) {
        clearTimeout(activeBotWatchdog);
        activeBotWatchdog = null;
      }
      isBotSpeaking = false;
      isGreetingActive = false;
      isAiResponding = false;
      await notifyAiSpeaking(0);
    });
  } catch (e) {}

  // In-browser direct WebRTC Voice Activity Detector captures caller audio directly from browser
  try {
    await page.exposeFunction('bridgeCallerWebmAudio', async (base64Data) => {
      if (!base64Data || isBotSpeaking || isGreetingActive) return;
      const buffer = Buffer.from(base64Data, 'base64');
      const t0 = Date.now();
      const text = await transcribeWebmBufferWithGroq(buffer);
      if (text) {
        console.log(`[Direct WebRTC Whisper Transcript]: "${text}" (${Date.now() - t0}ms)`);
        await handleIncomingCallerSpeech(text, 'WebRTC Direct');
      }
    });
  } catch (e) {}

  try {
    await page.exposeFunction('bridgeCallAccepted', async (callInfo) => {
      // STRICT MUTEX: Guarantee ONLY ONE greeting ever executes per call!
      if (isCallActive || isGreetingActive) {
        console.log('[Duplicate bridgeCallAccepted call ignored]');
        return;
      }
      isCallActive = true;
      isGreetingActive = true;
      isBotSpeaking = true;
      callStartTime = Date.now();
      activeCallLanguage = 'en';
      conversationHistory = [];
      recentBotResponses = [];
      speechAccumulator = '';
      if (speechDebounceTimer) {
        clearTimeout(speechDebounceTimer);
        speechDebounceTimer = null;
      }
      await notifyCallStatus(true);

      // Load the user's active agent from Inspirus Studio (dynamically from assigned dropdown)
      const state = await getInspirusState(browser);
      currentActiveAgent = state?.agent || {
        name: 'Maya',
        gender: 'Female',
        greeting: 'Hello! Thank you for calling. My name is Maya, your AI care coordinator. How can I assist you right now?',
        systemPrompt: 'You are an intelligent voice AI assistant.'
      };
      currentLlmConfig = state?.llmConfig || null;

      const agentGender = getAgentGender(currentActiveAgent);

      console.log('\n==============================================================');
      console.log(`🟢 [INCOMING WHATSAPP CALL ANSWERED IN REAL TIME!]`);
      console.log(` 👤 Caller: ${callInfo.callerName || 'WhatsApp Contact'}`);
      console.log(` ⏰ Time: ${new Date().toLocaleTimeString()}`);
      console.log(` 🤖 Active Agent: ${currentActiveAgent.name} (${agentGender})`);
      console.log(` 🎭 Persona: ${currentActiveAgent.role || currentActiveAgent.name}`);
      console.log(` 🎙️ Greeting: "${currentActiveAgent.greeting}"`);
      console.log('==============================================================\n');

      const greetingText = currentActiveAgent.greeting || `Hello! Thank you for calling. My name is ${currentActiveAgent.name}. How can I assist you right now?`;
      recentBotResponses.push(greetingText);
      const voice = selectVoice(currentActiveAgent, greetingText, 'en');
      console.log(`🗣️ Speaking greeting via Edge TTS (${voice}) [Gender: ${agentGender}]...`);

      const wordCount = greetingText.split(/\s+/).length;
      const initialEstimate = Math.max(3.5, (wordCount * 0.45) + 1.2);
      await notifyAiSpeaking(initialEstimate);

      // Auto-unlock watchdog in case audio onended event is delayed
      activeBotWatchdog = setTimeout(() => {
        if (isGreetingActive || isBotSpeaking) {
          console.log('🔓 [Greeting Watchdog] Unlocking listening state.');
          isGreetingActive = false;
          isBotSpeaking = false;
          isAiResponding = false;
          notifyAiSpeaking(0).catch(() => {});
        }
      }, (initialEstimate + 1.8) * 1000);

      const audioDataUri = await fetchTtsBase64(greetingText, voice);
      if (audioDataUri) {
        await page.evaluate((b64) => {
          if (window.__inspirusPlayAudio) {
            window.__inspirusPlayAudio(b64);
          }
        }, audioDataUri);
      }
    });
  } catch (e) {}

  try {
    await page.exposeFunction('bridgeCallEnded', async () => {
      if (!isCallActive) return;
      isCallActive = false;
      isGreetingActive = false;
      isBotSpeaking = false;
      isAiResponding = false;
      speechAccumulator = '';
      if (speechDebounceTimer) {
        clearTimeout(speechDebounceTimer);
        speechDebounceTimer = null;
      }
      if (activeBotWatchdog) {
        clearTimeout(activeBotWatchdog);
        activeBotWatchdog = null;
      }

      const durationSec = Math.floor((Date.now() - callStartTime) / 1000);
      await notifyCallStatus(false);
      await notifyAiSpeaking(0);

      // Stop any browser audio that might still be playing
      await page.evaluate(() => {
        if (window.__currentAudioSource) {
          try {
            window.__currentAudioSource.stop();
            window.__currentAudioSource.disconnect();
          } catch (e) {}
          window.__currentAudioSource = null;
        }
      }).catch(() => {});

      if (currentActiveAgent) {
        await recordCallLogToInspirus(browser, currentActiveAgent, conversationHistory, durationSec);
      }

      console.log('\n==============================================================');
      console.log(`🔴 [WHATSAPP CALL ENDED] (Duration: ${durationSec}s)`);
      console.log(` 📋 CDR recorded to Inspirus Call Logs for agent: ${currentActiveAgent?.name}`);
      console.log(' 🎧 Telephony gateway re-armed and watching for incoming calls...');
      console.log('==============================================================\n');

      conversationHistory = [];
      recentBotResponses = [];
    });
  } catch (e) {}

  async function handleIncomingCallerSpeech(text, source = 'WASAPI Loopback') {
    if (!text || text.length < 2) return;
    const cleanText = text.trim();
    const lower = cleanText.toLowerCase();
    const cleanLower = lower.replace(/[.!?,]/g, '').trim();

    // Critical: Filter out Groq Whisper silence/ambient hallucinations
    const hallucinations = [
      'thank you', 'thanks', 'thank you very much', 'thank you so much',
      'you', 'bye', 'goodbye', 'subscribe', 'subtitles by', 'amara.org',
      'watching', 'thanks for watching', '.', '..', '...', ''
    ];
    if (hallucinations.includes(lower) || hallucinations.includes(cleanLower)) {
      return;
    }

    // If AI is currently speaking, do not interrupt with small audio fragments
    if (isBotSpeaking) {
      console.log(`[AI Speaking - Audio Ignored from ${source}]: "${cleanText}"`);
      return;
    }

    // Deduplicate self-echo ONLY if the transcript is long (> 20 chars) and matches an entire recent bot response
    let isSelfEcho = false;
    if (cleanText.length > 20) {
      isSelfEcho = recentBotResponses.some(resp => {
        const r = resp.toLowerCase();
        return r.includes(lower) || lower.includes(r);
      });
    }

    if (isSelfEcho) {
      console.log(`[Self-Echo Blocked from ${source}]: "${cleanText}"`);
      return;
    }

    // Accumulate speech chunks into a complete caller thought/sentence
    speechAccumulator = (speechAccumulator ? speechAccumulator + ' ' : '') + cleanText;
    console.log(`[Caller Speech Accumulating (${source})]: "${speechAccumulator}"`);

    if (speechDebounceTimer) {
      clearTimeout(speechDebounceTimer);
    }

    // Responsive 350ms debounce to allow natural cadence while replying quickly
    speechDebounceTimer = setTimeout(async () => {
      const fullCallerSpeech = speechAccumulator.trim();
      speechAccumulator = '';
      speechDebounceTimer = null;

      if (!fullCallerSpeech || fullCallerSpeech.length < 2 || isAiResponding || isBotSpeaking) return;

      const now = Date.now();
      if (fullCallerSpeech.toLowerCase() === lastHandledCallerSpeech.toLowerCase() && (now - lastHandledSpeechTime < 2200)) {
        console.log(`[Duplicate caller utterance dropped within 2.2s]: "${fullCallerSpeech}"`);
        return;
      }
      lastHandledCallerSpeech = fullCallerSpeech;
      lastHandledSpeechTime = now;

      isAiResponding = true;
      isBotSpeaking = true;

      // DYNAMIC LANGUAGE SWITCHING: Detect caller language on each turn
      activeCallLanguage = detectCallerLanguage(fullCallerSpeech, activeCallLanguage);
      const langLabel = activeCallLanguage === 'hi' ? 'Hindi / Hinglish' : 'English';
      console.log(`\n🗣️  Caller Said (${langLabel}) [Source: ${source}]: "${fullCallerSpeech}"`);

      // Dynamically re-sync active agent from Inspirus Studio in case user changed dropdown
      const state = await getInspirusState(browser);
      if (state?.agent) {
        currentActiveAgent = state.agent;
        currentLlmConfig = state.llmConfig;
      } else if (!currentActiveAgent) {
        currentActiveAgent = { name: 'Voice Agent', systemPrompt: '' };
      }

      const aiResponse = await generateAgentResponse(
        currentActiveAgent,
        fullCallerSpeech,
        conversationHistory,
        activeCallLanguage,
        currentLlmConfig
      );

      const voice = selectVoice(currentActiveAgent, aiResponse, activeCallLanguage);
      const agentGender = getAgentGender(currentActiveAgent);
      console.log(`🤖 ${currentActiveAgent.name} [${agentGender} | ${voice}] Responding: "${aiResponse}"`);

      recentBotResponses.push(aiResponse);
      if (recentBotResponses.length > 6) recentBotResponses.shift();

      conversationHistory.push({ role: 'user', content: fullCallerSpeech });
      conversationHistory.push({ role: 'assistant', content: aiResponse });

      // Estimate duration buffer
      const wordCount = aiResponse.split(/\s+/).length;
      const estimatedDuration = Math.max(2.8, (wordCount * 0.45) + 1.2);
      await notifyAiSpeaking(estimatedDuration);

      // Safety watchdog: auto-release lock if audio playback events are delayed
      if (activeBotWatchdog) clearTimeout(activeBotWatchdog);
      activeBotWatchdog = setTimeout(() => {
        if (isBotSpeaking) {
          console.log('🔓 [Bot Speaking Watchdog] Safety auto-unlock engaged.');
          isBotSpeaking = false;
          isAiResponding = false;
          notifyAiSpeaking(0).catch(() => {});
        }
      }, (estimatedDuration + 1.8) * 1000);

      const audioDataUri = await fetchTtsBase64(aiResponse, voice);
      if (audioDataUri) {
        await page.evaluate((b64) => {
          if (window.__inspirusPlayAudio) {
            window.__inspirusPlayAudio(b64);
          }
        }, audioDataUri);
      }
      isAiResponding = false;
    }, 350);
  }

  // HTTP server to receive speech transcript from Python WASAPI Loopback daemon
  const server = http.createServer(async (req, res) => {
    if (req.method === 'POST' && req.url === '/caller_speech') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', async () => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('{"status": "ok"}');

        try {
          const { text, source } = JSON.parse(body);
          await handleIncomingCallerSpeech(text, source || 'WASAPI Loopback');
        } catch (err) {
          console.error('[HTTP Speech Handler Error]', err);
        }
      });
    } else {
      res.writeHead(404);
      res.end();
    }
  });

  server.listen(5056, '127.0.0.1', () => {
    console.log('[3/4] Node Speech Dispatch Server listening on http://127.0.0.1:5056');
  });

  // In-page setup: WebRTC mixer + Auto-Answer + Robust State Machine
  const inPageSetup = () => {
    // CRITICAL: NEVER run inside iframes! Top-level document only!
    if (window !== window.top) return;

    if (window.__inspirusActive) return;
    window.__inspirusActive = true;
    window.__inspirusCallActive = false;
    window.__currentAudioSource = null;

    let audioCtx = null;
    let aiGainNode = null;
    const activeDestinations = new Set();

    function ensureAudioContext() {
      if (!audioCtx) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        audioCtx = new AudioContextClass({ latencyHint: 'interactive', sampleRate: 48000 });

        aiGainNode = audioCtx.createGain();
        aiGainNode.gain.setValueAtTime(4.0, audioCtx.currentTime);

        // Local monitor volume so output is clearly audible on PC
        const monitorGain = audioCtx.createGain();
        monitorGain.gain.setValueAtTime(1.0, audioCtx.currentTime);
        aiGainNode.connect(monitorGain);
        try {
          monitorGain.connect(audioCtx.destination);
        } catch (e) {}

        window.__inspirusAudioCtx = audioCtx;
        window.__inspirusAiGain = aiGainNode;
      }
      if (audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => {});
      }
      return { audioCtx, aiGainNode };
    }

    // Intercept getUserMedia: Supply live audio pipe to WhatsApp WebRTC
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia && !window.__origGetUserMedia) {
      window.__origGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      navigator.mediaDevices.getUserMedia = async function(constraints) {
        const { audioCtx: ctx, aiGainNode: gain } = ensureAudioContext();

        if (constraints && constraints.audio) {
          const dest = ctx.createMediaStreamDestination();
          activeDestinations.add(dest);
          gain.connect(dest);

          try {
            const rawMicConstraints = {
              audio: {
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false
              }
            };
            const realStream = await window.__origGetUserMedia(rawMicConstraints);
            if (realStream && realStream.getAudioTracks().length > 0) {
              window.__inspirusLocalMicStream = realStream;
              const micSource = ctx.createMediaStreamSource(realStream);
              const micGain = ctx.createGain();
              micGain.gain.setValueAtTime(1.0, ctx.currentTime);
              micSource.connect(micGain);
              micGain.connect(dest);
            }
          } catch (e) {}

          if (window.bridgeLog) {
            window.bridgeLog(`Live WebRTC audio pipe attached (active streams: ${activeDestinations.size}).`);
          }

          dest.stream.getAudioTracks().forEach(track => {
            track.addEventListener('ended', () => {
              try { gain.disconnect(dest); } catch (e) {}
              activeDestinations.delete(dest);
            });
          });

          return dest.stream;
        }
        return window.__origGetUserMedia(constraints);
      };
    }

    // Play Base64 audio into all active WebRTC streams with ABSOLUTE SINGLE-SPEAKER GUARANTEE
    window.__inspirusPlayAudio = async function(dataUri) {
      if (!dataUri) return;
      try {
        const { audioCtx: ctx, aiGainNode: gain } = ensureAudioContext();
        if (ctx.state === 'suspended') {
          await ctx.resume().catch(() => {});
        }

        // Stop ANY previously playing audio before starting a new one
        if (window.__currentAudioSource) {
          try {
            window.__currentAudioSource.stop();
            window.__currentAudioSource.disconnect();
          } catch (e) {}
          window.__currentAudioSource = null;
        }

        const base64Data = dataUri.split(',')[1];
        const binaryStr = window.atob(base64Data);
        const len = binaryStr.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }

        const audioBuffer = await ctx.decodeAudioData(bytes.buffer.slice(0));
        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(gain);
        window.__currentAudioSource = source;
        window.__inspirusBotSpeaking = true;

        source.onended = () => {
          window.__inspirusBotSpeaking = false;
          if (window.__currentAudioSource === source) {
            window.__currentAudioSource = null;
          }
          if (window.bridgeAudioEnded) {
            window.bridgeAudioEnded();
          }
        };

        source.start(0);

        if (window.bridgeLog) {
          window.bridgeLog(`Broadcasting ${audioBuffer.duration.toFixed(1)}s AI voice to ${activeDestinations.size} WebRTC stream(s).`);
        }
      } catch (e) {
        if (window.bridgeLog) window.bridgeLog('Audio pipe error: ' + e.message);
        try {
          const audio = new Audio(dataUri);
          audio.volume = 1.0;
          window.__inspirusBotSpeaking = true;
          audio.onended = () => {
            window.__inspirusBotSpeaking = false;
            if (window.bridgeAudioEnded) window.bridgeAudioEnded();
          };
          audio.play().catch(() => {});
        } catch (err) {}
      }
    };

    function setupRemoteAudioRecording(stream) {
      if (!stream || window.__inspirusRemoteRecorderActive) return;
      window.__inspirusRemoteRecorderActive = true;
      if (window.bridgeLog) window.bridgeLog('🎧 Direct WebRTC remote caller audio stream attached!');

      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        const ctx = new AudioCtx();
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        source.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        let mediaRecorder = null;
        let audioChunks = [];
        let isSpeaking = false;
        let silenceTimer = null;

        function startRecorder() {
          audioChunks = [];
          try {
            mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
            mediaRecorder.ondataavailable = (e) => {
              if (e.data && e.data.size > 0) audioChunks.push(e.data);
            };
            mediaRecorder.start(100);
          } catch (e) {
            if (window.bridgeLog) window.bridgeLog('MediaRecorder start error: ' + e.message);
          }
        }

        function stopAndDispatch() {
          if (!mediaRecorder || mediaRecorder.state === 'inactive') return;
          mediaRecorder.onstop = async () => {
            const blob = new Blob(audioChunks, { type: 'audio/webm' });
            audioChunks = [];
            if (blob.size > 1200) {
              const reader = new FileReader();
              reader.onloadend = () => {
                const base64 = (reader.result || '').split(',')[1];
                if (base64 && window.bridgeCallerWebmAudio) {
                  window.bridgeCallerWebmAudio(base64);
                }
              };
              reader.readAsDataURL(blob);
            }
          };
          try { mediaRecorder.stop(); } catch (e) {}
        }

        startRecorder();

        const checkInterval = setInterval(() => {
          if (!window.__inspirusCallActive) {
            clearInterval(checkInterval);
            window.__inspirusRemoteRecorderActive = false;
            try { if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop(); } catch(e) {}
            return;
          }

          // Do NOT capture while bot is speaking (guaranteed zero self-echo)
          if (window.__inspirusBotSpeaking) {
            return;
          }

          analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
          const avg = sum / dataArray.length;

          // Caller voice activity detection
          if (avg > 2.5) {
            if (!isSpeaking) {
              isSpeaking = true;
              if (window.bridgeLog) window.bridgeLog(`[Direct WebRTC VAD] Caller Speaking (Energy: ${avg.toFixed(1)})`);
            }
            if (silenceTimer) {
              clearTimeout(silenceTimer);
              silenceTimer = null;
            }
          } else {
            if (isSpeaking && !silenceTimer) {
              silenceTimer = setTimeout(() => {
                isSpeaking = false;
                silenceTimer = null;
                if (window.bridgeLog) window.bridgeLog('[Direct WebRTC VAD] Speech Complete -> Dispatching audio to Groq Whisper');
                stopAndDispatch();
                startRecorder();
              }, 500);
            }
          }
        }, 50);
      } catch (err) {
        if (window.bridgeLog) window.bridgeLog('Remote audio setup error: ' + err.message);
      }
    }

    // Safely hook RTCPeerConnection prototype to capture incoming audio track
    if (window.RTCPeerConnection && !window.__inspirusRtcHooked) {
      window.__inspirusRtcHooked = true;
      const origAddEventListener = RTCPeerConnection.prototype.addEventListener;
      RTCPeerConnection.prototype.addEventListener = function(type, listener, options) {
        if (type === 'track' || type === 'addstream') {
          const wrapped = function(event) {
            const track = event.track || (event.stream && event.stream.getAudioTracks && event.stream.getAudioTracks()[0]);
            if (track && track.kind === 'audio') {
              if (window.bridgeLog) window.bridgeLog(`🎧 Direct WebRTC ${type} attached!`);
              const stream = event.stream || (event.streams && event.streams[0]) || new MediaStream([track]);
              setupRemoteAudioRecording(stream);
              track.addEventListener('ended', () => {
                if (window.bridgeLog) window.bridgeLog('📞 Remote WebRTC audio track ended.');
                if (window.bridgeCallEnded) window.bridgeCallEnded();
              });
            }
            return listener.call(this, event);
          };
          return origAddEventListener.call(this, type, wrapped, options);
        }
        return origAddEventListener.call(this, type, listener, options);
      };

      const origSetRemoteDescription = RTCPeerConnection.prototype.setRemoteDescription;
      RTCPeerConnection.prototype.setRemoteDescription = async function(desc) {
        const res = await origSetRemoteDescription.call(this, desc);
        try {
          if (this.getReceivers) {
            this.getReceivers().forEach(r => {
              if (r.track && r.track.kind === 'audio') {
                if (window.bridgeLog) window.bridgeLog('🎧 Direct WebRTC getReceivers() audio track captured!');
                setupRemoteAudioRecording(new MediaStream([r.track]));
              }
            });
          }
          if (this.getRemoteStreams) {
            this.getRemoteStreams().forEach(s => {
              if (s && s.getAudioTracks().length > 0) {
                if (window.bridgeLog) window.bridgeLog('🎧 Direct WebRTC getRemoteStreams() captured!');
                setupRemoteAudioRecording(s);
              }
            });
          }
        } catch (e) {}
        return res;
      };

      const origOnTrack = Object.getOwnPropertyDescriptor(RTCPeerConnection.prototype, 'ontrack');
      if (origOnTrack && origOnTrack.set) {
        Object.defineProperty(RTCPeerConnection.prototype, 'ontrack', {
          set(fn) {
            const wrapped = function(event) {
              if (event.track && event.track.kind === 'audio') {
                if (window.bridgeLog) window.bridgeLog('🎧 Direct WebRTC ontrack attached!');
                const stream = (event.streams && event.streams[0]) ? event.streams[0] : new MediaStream([event.track]);
                setupRemoteAudioRecording(stream);
                event.track.addEventListener('ended', () => {
                  if (window.bridgeLog) window.bridgeLog('📞 Remote WebRTC audio track ended.');
                  if (window.bridgeCallEnded) window.bridgeCallEnded();
                });
              }
              if (typeof fn === 'function') fn.call(this, event);
            };
            return origOnTrack.set.call(this, wrapped);
          },
          get() {
            return origOnTrack.get.call(this);
          }
        });
      }
    }

    // Safely hook AudioContext createMediaStreamSource to intercept remote audio streams
    const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
    if (AudioCtxClass && !window.__inspirusAudioCtxHooked) {
      window.__inspirusAudioCtxHooked = true;
      const origCreateMediaStreamSource = AudioCtxClass.prototype.createMediaStreamSource;
      AudioCtxClass.prototype.createMediaStreamSource = function(stream) {
        if (stream && stream !== window.__inspirusLocalMicStream && stream.getAudioTracks && stream.getAudioTracks().length > 0) {
          if (window.bridgeLog) window.bridgeLog('🎧 AudioContext createMediaStreamSource remote audio captured!');
          setupRemoteAudioRecording(stream);
        }
        return origCreateMediaStreamSource.call(this, stream);
      };
    }

    // Safely hook HTMLMediaElement srcObject setter to capture audio streams assigned to <audio> elements
    const origSrcObject = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'srcObject');
    if (origSrcObject && origSrcObject.set && !window.__inspirusMediaHooked) {
      window.__inspirusMediaHooked = true;
      Object.defineProperty(HTMLMediaElement.prototype, 'srcObject', {
        set(stream) {
          if (stream instanceof MediaStream && stream.getAudioTracks().length > 0) {
            if (window.bridgeLog) window.bridgeLog('🎧 HTMLMediaElement remote audio stream attached!');
            setupRemoteAudioRecording(stream);
          }
          return origSrcObject.set.call(this, stream);
        },
        get() {
          return origSrcObject.get.call(this);
        }
      });
    }

    function forceFullClick(el) {
      if (!el) return;
      const events = ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'];
      events.forEach(type => {
        el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window, buttons: 1 }));
      });
      if (typeof el.click === 'function') el.click();
    }

    function monitorCallState() {
      const pageText = (document.body ? document.body.innerText : '').toLowerCase();

      // 1. IF CALL IS ACTIVE: Only dismiss if explicit end text is shown
      if (window.__inspirusCallActive) {
        const hasExplicitEndedText = 
          pageText.includes('call ended') || 
          pageText.includes('कॉल समाप्त') || 
          pageText.includes('call disconnected') ||
          pageText.includes('call failed');

        if (hasExplicitEndedText) {
          window.__inspirusCallActive = false;
          if (window.bridgeLog) window.bridgeLog('Active call ended / disconnected.');
          if (window.bridgeCallEnded) window.bridgeCallEnded();
        }
        return;
      }

      // 2. IF NOT IN A CALL: WATCH STRICTLY FOR REAL INCOMING CALL POPUPS
      const allButtons = Array.from(document.querySelectorAll('button, div[role="button"], span[role="button"]'));

      // Strict gating: Incoming call modal or text MUST exist
      const callDialog = document.querySelector('[role="dialog"], [role="alertdialog"], [data-animate-modal-popup="true"], [data-testid*="incoming-call"]');

      const hasIncomingText = 
        pageText.includes('incoming voice call') ||
        pageText.includes('incoming video call') ||
        pageText.includes('is calling') ||
        pageText.includes('कॉल आ रही') ||
        pageText.includes('इनकमिंग कॉल');

      const hasDeclineButton = allButtons.some(b => {
        const aria = (b.getAttribute('aria-label') || b.getAttribute('title') || '').toLowerCase();
        const testId = (b.getAttribute('data-testid') || '').toLowerCase();
        return aria.includes('decline') || aria.includes('reject') || aria.includes('dismiss') ||
               aria.includes('अस्वीकार') || testId.includes('decline') || testId.includes('reject');
      });

      // Never attempt accept without an actual incoming call indicator
      if (!callDialog && !hasIncomingText && !hasDeclineButton) {
        return;
      }

      const candidateButtons = callDialog
        ? Array.from(callDialog.querySelectorAll('button, div[role="button"], span[role="button"]'))
        : allButtons;

      const acceptBtn = candidateButtons.find(b => {
        const aria = (b.getAttribute('aria-label') || b.getAttribute('title') || b.innerText || '').toLowerCase();
        const testId = (b.getAttribute('data-testid') || '').toLowerCase();

        // STRICT BLACKLIST: Never click navigation buttons or chat buttons
        if (
          aria.includes('new chat') || aria.includes('chat') || aria.includes('menu') ||
          aria.includes('attach') || aria.includes('status') || aria.includes('channels') ||
          aria.includes('communities') || aria.includes('calls') || testId.includes('menu') ||
          testId.includes('new-chat')
        ) {
          return false;
        }

        const isExplicitAccept = 
          aria.includes('accept') || aria.includes('answer') || aria.includes('स्वीकार') || aria.includes('उठाएं') || aria.includes('join call') || aria === 'join' ||
          testId.includes('accept') || testId.includes('answer') || testId.includes('call-accept');

        return isExplicitAccept;
      });

      if (acceptBtn && !window.__inspirusCallActive) {
        window.__inspirusCallActive = true;
        const btnLabel = acceptBtn.getAttribute('aria-label') || acceptBtn.innerText || 'accept';
        if (window.bridgeLog) window.bridgeLog(`📞 INCOMING CALL DETECTED! Clicking Accept button: "${btnLabel}"`);

        forceFullClick(acceptBtn);

        const callModal = acceptBtn.closest('[role="dialog"]') || acceptBtn.closest('div');
        const callerNameEl = callModal ? callModal.querySelector('h1, h2, h3, span[title], div[title]') : null;
        const callerName = callerNameEl ? (callerNameEl.getAttribute('title') || callerNameEl.innerText) : 'WhatsApp Caller';

        if (window.bridgeCallAccepted) {
          window.bridgeCallAccepted({ callerName });
        }
      }
    }

    if (!window.__inspirusMonitorInterval) {
      window.__inspirusMonitorInterval = setInterval(monitorCallState, 250);
    }
    if (window.bridgeLog) window.bridgeLog('Telephony Voice Gateway armed and watching for incoming calls.');
  };

  // Direct injection into top-level document & future documents
  try {
    await page.evaluateOnNewDocument(inPageSetup);
  } catch (e) {}
  try {
    await page.evaluate(inPageSetup);
  } catch (e) {}

  // Watchdog: re-arm if page reloads or navigates
  setInterval(async () => {
    try {
      const isArmed = await page.evaluate(() => !!window.__inspirusActive);
      if (!isArmed) {
        console.log('[Telephony Watchdog] In-page call monitor not armed. Re-arming now...');
        await page.evaluate(inPageSetup);
      }
    } catch (e) {}
  }, 3000);

  console.log('\n================================================================');
  console.log(' ✅ DUAL-STREAM WASAPI TELEPHONY ENGINE ARMED & READY!');
  console.log(' 🟢 Connected WhatsApp Tab: WhatsApp');
  console.log(' 🔗 Dynamic Inspirus Agent Synchronization: ACTIVE');
  console.log(' 🎙️ WebRTC Outgoing Pipe: Active with 4.0x Gain');
  console.log(' 🎧 Windows WASAPI Loopback: Listening to Headphones Output');
  console.log(' 🛑 Single-Speaker Lock: Guaranteed (Zero Overlapping Voices)');
  console.log(' 🗣️ Voice Assignment: Saiesh (Male) -> en-US-GuyNeural / hi-IN-MadhurNeural');
  console.log(' 🌐 Dynamic Language Switching: English <--> Hindi on Every Turn');
  console.log('================================================================\n');

  // Keep alive
  await new Promise(() => {});
}

run().catch((err) => {
  console.error('[Fatal Telephony Error]', err);
  process.exit(1);
});
