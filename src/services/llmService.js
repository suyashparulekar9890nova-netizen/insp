// LLM Service: Powers 100% Spontaneous, Dynamic Voice Agent Responses via xAI Grok, Gemini, OpenAI, Groq, or Custom API Keys
import { storage } from './storage.js';

const API_CONFIG_KEY = 'inspirus_llm_api_config';

export class LLMService {
  /**
   * Intelligently detects provider and fixes model name based on API key format
   */
  static normalizeConfig(config) {
    if (!config || !config.apiKey) {
      return {
        provider: 'xai',
        apiKey: '',
        model: 'grok-2-latest',
        customEndpoint: ''
      };
    }

    const key = config.apiKey.trim();
    let provider = config.provider || 'xai';
    let model = config.model || '';

    // Smart Key Auto-Detection based on vendor prefixes:
    if (key.startsWith('grok_') || key.startsWith('xai-')) {
      provider = 'xai';
      if (!model || model.includes('gemini') || model.includes('llama') || model.includes('gpt')) {
        model = 'grok-2-latest';
      }
    } else if (key.startsWith('gsk_')) {
      provider = 'groq';
      if (!model || model.includes('gemini') || model.includes('grok') || model.includes('llama') || (model.includes('gpt') && !model.includes('oss'))) {
        model = 'qwen/qwen3.8-27b';
      }
    } else if (key.startsWith('AIza')) {
      provider = 'gemini';
      if (!model || model === 'gemini-2.5-flash' || model.includes('llama') || model.includes('gpt') || model.includes('grok')) {
        model = 'gemini-1.5-flash';
      }
    } else if (key.startsWith('sk-')) {
      provider = 'openai';
      if (!model || model.includes('gemini') || model.includes('llama') || model.includes('grok')) {
        model = 'gpt-4o-mini';
      }
    }

    // Fix xAI / Grok model names
    if (provider === 'xai') {
      if (!model || model.includes('gemini') || model.includes('llama') || model.includes('gpt')) {
        model = 'grok-2-latest';
      }
    }

    // Fix deprecated/invalid Gemini model names
    if (provider === 'gemini') {
      if (!model || model === 'gemini-2.5-flash' || model === 'gemini-pro' || model === 'gemini-1.0-pro' || model.includes('llama') || model.includes('gpt') || model.includes('grok')) {
        model = 'gemini-1.5-flash';
      }
    }

    // Fix Groq model names
    if (provider === 'groq') {
      if (!model || model.includes('gemini') || model.includes('grok') || model.includes('llama')) {
        model = 'qwen/qwen3.8-27b';
      }
    }

    return {
      ...config,
      provider,
      model,
      apiKey: key,
      customEndpoint: config.customEndpoint || ''
    };
  }

  /**
   * Retrieves the current API key configuration from localStorage or Vite environment (.env)
   */
  static getConfig() {
    try {
      const stored = JSON.parse(localStorage.getItem(API_CONFIG_KEY));
      // Purge stale placeholder/dummy keys
      if (stored && stored.apiKey && !stored.apiKey.includes('b8c965f08650b2888e9290b19d519e5f')) {
        const normalized = this.normalizeConfig(stored);
        if (JSON.stringify(normalized) !== JSON.stringify(stored)) {
          localStorage.setItem(API_CONFIG_KEY, JSON.stringify(normalized));
        }
        return normalized;
      }
    } catch {
      // fallback
    }

    // Check environment variables from .env file (prioritizing Groq Cloud)
    const envGroq = typeof import.meta !== 'undefined' && import.meta.env ? (import.meta.env.VITE_GROQ_API_KEY || import.meta.env.GROQ_API_KEY) : '';
    const envGemini = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.VITE_GEMINI_API_KEY : '';
    const envOpenAI = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.VITE_OPENAI_API_KEY : '';
    const envGrok = typeof import.meta !== 'undefined' && import.meta.env ? (import.meta.env.VITE_GROK_API_KEY || import.meta.env.VITE_XAI_API_KEY) : '';

    if (envGroq) {
      return this.normalizeConfig({ provider: 'groq', apiKey: envGroq, model: 'qwen/qwen3.8-27b' });
    }
    if (envGemini) {
      return this.normalizeConfig({ provider: 'gemini', apiKey: envGemini, model: 'gemini-1.5-flash' });
    }
    if (envOpenAI) {
      return this.normalizeConfig({ provider: 'openai', apiKey: envOpenAI, model: 'gpt-4o-mini' });
    }
    if (envGrok && !envGrok.includes('b8c965f08650b2888e9290b19d519e5f')) {
      return this.normalizeConfig({ provider: 'xai', apiKey: envGrok, model: 'grok-2-latest' });
    }

    return {
      provider: 'groq',
      apiKey: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GROQ_API_KEY) || '',
      model: 'qwen/qwen3.8-27b',
      customEndpoint: ''
    };
  }

  /**
   * Saves API configuration
   */
  static saveConfig(config) {
    const normalized = this.normalizeConfig(config);
    localStorage.setItem(API_CONFIG_KEY, JSON.stringify(normalized));
    window.dispatchEvent(new CustomEvent('llm-config-updated', { detail: normalized }));
    return normalized;
  }

  /**
   * Checks if an API key is currently active
   */
  static hasActiveApiKey() {
    const config = this.getConfig();
    return !!(config && config.apiKey && config.apiKey.trim().length > 5);
  }

  /**
   * Tests an API key connection
   */
  static async testConnection(config) {
    const normalized = this.normalizeConfig(config);
    const { provider, apiKey, model, customEndpoint } = normalized;

    if (!apiKey) throw new Error('API Key cannot be blank.');

    if (provider === 'gemini') {
      const selectedModel = model || 'gemini-1.5-flash';
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${apiKey.trim()}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: 'Respond with: Ready.' }] }]
        })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || `Gemini API returned status ${res.status}`);
      }

      const data = await res.json();
      const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      return { success: true, message: `Connected to Gemini (${selectedModel}) successfully! Response: ${reply.trim()}` };
    }

    if (provider === 'xai' || provider === 'openai' || provider === 'groq' || provider === 'custom') {
      let endpoint = 'https://api.openai.com/v1/chat/completions';
      let selectedModel = model || 'gpt-4o-mini';

      if (provider === 'xai') {
        endpoint = customEndpoint || 'https://api.x.ai/v1/chat/completions';
        selectedModel = model || 'grok-2-latest';
      } else if (provider === 'groq') {
        endpoint = 'https://api.groq.com/openai/v1/chat/completions';
        selectedModel = model || 'qwen/qwen3.8-27b';
      } else if (provider === 'custom') {
        endpoint = customEndpoint || 'https://api.openai.com/v1/chat/completions';
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey.trim()}`
        },
        body: JSON.stringify({
          model: selectedModel,
          messages: [{ role: 'user', content: 'Respond with: Ready.' }],
          max_tokens: 30
        })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const errMsg = err.error?.message || err.error || `${provider.toUpperCase()} returned status ${res.status}`;
        throw new Error(errMsg);
      }

      const data = await res.json();
      const reply = data.choices?.[0]?.message?.content || data.choices?.[0]?.message?.reasoning || 'Connected';
      return { success: true, message: `Connected to ${provider.toUpperCase()} (${selectedModel}) successfully! Response: ${reply.trim()}` };
    }

    throw new Error('Unsupported provider.');
  }

  /**
   * Generates a 100% spontaneous, unscripted response using the configured LLM API (Grok, Gemini, OpenAI, etc.)
   */
  static async generateSpontaneousResponse({ agent, userText, conversationHistory, customerEmotion, language }) {
    const rawConfig = this.getConfig();

    if (!rawConfig || !rawConfig.apiKey) {
      return null;
    }

    const config = this.normalizeConfig(rawConfig);
    const startTime = Date.now();

    // 1. Retrieve Active Workspace and Practice Context
    const activeWorkspace = storage.getActiveWorkspace();
    const ownerCtx = agent?.ownerContext || {};
    const agentName = agent?.name?.split('—')[0]?.trim() || ownerCtx.agentName || 'Nova';
    const basePersonality = ownerCtx.basePersonality || agent?.tone || 'Empathetic & Calming Guardian';
    const emergencyNumber = activeWorkspace?.humanHandoffNumber || '+1 (800) 555-0192';

    // 2. Identify Agent Domain
    const domainCorpus = [
      ownerCtx.businessDescription,
      ownerCtx.whyNeeded,
      ownerCtx.tasksToAutomate,
      agent?.role,
      agent?.systemPrompt,
      agent?.name
    ].filter(Boolean).join(' ').toLowerCase();

    const isLegal = domainCorpus.includes('attorney') || domainCorpus.includes('lawyer') || domainCorpus.includes('defense') || domainCorpus.includes('dui') || domainCorpus.includes('court') || domainCorpus.includes('bail') || domainCorpus.includes('jail') || domainCorpus.includes('arrest') || domainCorpus.includes('legal');
    const isLogistics = domainCorpus.includes('freight') || domainCorpus.includes('logistics') || domainCorpus.includes('trucking') || domainCorpus.includes('dispatch') || domainCorpus.includes('bol') || domainCorpus.includes('carrier') || domainCorpus.includes('cargo') || domainCorpus.includes('load');
    const isFinance = domainCorpus.includes('wealth') || domainCorpus.includes('advisory') || domainCorpus.includes('financial') || domainCorpus.includes('portfolio') || domainCorpus.includes('invest') || domainCorpus.includes('401k');
    const isDining = domainCorpus.includes('restaurant') || domainCorpus.includes('trattoria') || domainCorpus.includes('dining') || domainCorpus.includes('bistro') || domainCorpus.includes('table reservation');
    const isDental = !isLegal && !isLogistics && !isFinance && !isDining && (domainCorpus.includes('dental') || domainCorpus.includes('teeth') || domainCorpus.includes('dentist') || domainCorpus.includes('tooth') || domainCorpus.includes('cleanings') || (activeWorkspace?.id === 'ws-dentalcare' && !ownerCtx.businessDescription));

    let businessName = ownerCtx.businessName;
    let ownerDesc = ownerCtx.businessDescription;
    let ownerWhy = ownerCtx.whyNeeded;
    let ownerTasks = ownerCtx.tasksToAutomate;
    let specificDomainDirectives = '';

    if (isLegal) {
      businessName = businessName || 'Criminal Defense & Trial Law Practice';
      ownerDesc = ownerDesc || 'Solo criminal defense attorney in Miami handling urgent DUI, bail hearings, jail release, and courtroom representation';
      ownerWhy = ownerWhy || 'Missing urgent calls while in court trials; families of arrested defendants need immediate legal intervention';
      ownerTasks = ownerTasks || 'Calm distressed families, capture defendant name, charges, and jail location, quote flat-fee retainers, and dispatch urgent alerts to the attorney';
      specificDomainDirectives = `LEGAL DEFENSE PRACTICE FACTS:
- Practice: Criminal Defense & Trial Law Practice of Miami
- Jurisdiction: Miami-Dade County, Broward County, Florida state and federal trial courts.
- Urgent Matters: DUI defense, bail & bond hearings, jail release, felony & misdemeanor defense, emergency phone and jail consults.
- Fees & Retainers: Transparent flat-fee representation based on charge level, discussed directly during emergency consult.
- Immediate Action: If caller mentions an arrest or jail, immediately capture: 1) Defendant full name, 2) Jail or precinct location, 3) Charges, 4) Court or bond date. Offer immediate attorney dispatch.`;
    } else if (isLogistics) {
      businessName = businessName || 'SwiftFreight Global Logistics';
      ownerDesc = ownerDesc || 'Global freight forwarding and supply chain logistics management';
      ownerWhy = ownerWhy || 'Shippers and carriers needing real-time dispatch, BOL tracking, and dock appointments';
      ownerTasks = ownerTasks || 'Tracking freight, providing dispatch updates, verifying BOL status, and driver check-in';
      specificDomainDirectives = `LOGISTICS FACTS:
- Load Tracking: Statuses available via tracking ID, load number, or BOL.
- Hubs: Central Chicago Hub, US-East dispatch terminals.
- Services: FTL, LTL, temperature-controlled freight, port drayage.`;
    } else if (isFinance) {
      businessName = businessName || 'Apex Wealth Advisors';
      ownerDesc = ownerDesc || 'Private wealth management and fiduciary retirement planning';
      ownerWhy = ownerWhy || 'High net worth clients and business owners planning wealth preservation and retirement';
      ownerTasks = ownerTasks || 'Scheduling portfolio reviews, retirement consultations, and rollover intake';
      specificDomainDirectives = `FINANCIAL ADVISORY FACTS:
- Services: Fiduciary wealth advisory, retirement plans, estate planning, 401(k) rollovers.
- Focus: Personalized, transparent fee-only advisory.`;
    } else if (isDental) {
      businessName = businessName || activeWorkspace?.name || 'DentalCare Plus Clinics';
      ownerDesc = ownerDesc || 'DentalCare Plus Clinics, providing gentle, modern dental care and emergency toothache relief';
      ownerWhy = ownerWhy || 'Patients needing appointment scheduling, insurance verification, and relief from dental pain';
      ownerTasks = ownerTasks || 'Scheduling cleanings and exams, explaining procedures, insurance benefits, and emergency triage';
      specificDomainDirectives = `DENTAL CLINIC FACTS:
- Location: 450 Grand Avenue, Suite 300 (Complimentary validated patient parking).
- Hours: Mon-Fri 8:00 AM - 6:30 PM, Sat 9:00 AM - 3:00 PM (24/7 on-call triage line: ${emergencyNumber}).
- Insurance: All major PPOs (Delta Dental, MetLife, Cigna, Aetna), Medicare, HSA/FSA, 0% financing.
- Procedures: Routine cleanings, laser whitening, painless root canals, crowns, extractions, implants, toothaches.`;
    } else {
      businessName = businessName || activeWorkspace?.name || 'Inspirus Client Practice';
      ownerDesc = ownerDesc || `${businessName}, dedicated to excellence in client service`;
      ownerWhy = ownerWhy || 'Providing immediate, high-quality assistance to all callers';
      ownerTasks = ownerTasks || 'Answering inquiries, scheduling visits, and resolving client requests';
      specificDomainDirectives = `PRACTICE FACTS:
- Business: ${businessName}
- About: ${ownerDesc}
- Tasks to handle: ${ownerTasks}`;
    }

    const activeLang = language || agent?.language || 'en-US';
    const isHindi = activeLang.startsWith('hi');

    const languageDirective = isHindi ? `6. ABSOLUTE STRICT LANGUAGE LOCK: HINDI (हिंदी).
   - The user has STRICTLY chosen HINDI as the conversation language.
   - EVERY SINGLE WORD OF YOUR RESPONSE MUST BE IN NATURAL, PROFESSIONAL HINDI (written in clear Devanagari script).
   - CRITICAL: EVEN IF THE CALLER TYPES OR SPEAKS IN ENGLISH, YOUR REPLY MUST STILL BE 100% IN HINDI.
   - Example: If the caller asks "Can you help my brother with bail?", you reply in Hindi: "जी हाँ, हम जमानत और जेल से रिहाई में तुरंत कानूनी सहायता प्रदान करते हैं। क्या आप मुझे अपने भाई के केस का विवरण बता सकते हैं?"
   - DO NOT USE ENGLISH WORDS OR ENGLISH SENTENCES. DO NOT SWITCH TO ENGLISH UNDER ANY CIRCUMSTANCES.
   - Keep answers between 1 and 3 spoken sentences maximum (under 35 words).
   - Maintain strict persona as a criminal defense assistant for the Miami law practice.` : `6. ABSOLUTE STRICT LANGUAGE LOCK: ENGLISH.
   - The user has STRICTLY chosen ENGLISH as the conversation language.
   - EVERY SINGLE WORD OF YOUR RESPONSE MUST BE IN NATURAL, CONCISE ENGLISH.
   - CRITICAL: EVEN IF THE CALLER TYPES OR SPEAKS IN HINDI, YOUR REPLY MUST STILL BE 100% IN ENGLISH.
   - Example: If the caller asks "नमस्ते क्या आप जमानत करा सकते हैं?", you reply in English: "Hello! Yes, our criminal defense practice handles emergency bail hearings and jail release. Can you give me the defendant's name and jail location?"
   - DO NOT USE HINDI WORDS OR DEVANAGARI SCRIPT. DO NOT SWITCH TO HINDI UNDER ANY CIRCUMSTANCES.
   - Keep answers between 1 and 3 spoken sentences maximum (under 35 words).`;

    const systemInstruction = `You are ${agentName}, speaking as a natural, highly skilled human voice assistant on a live phone call for ${businessName}.
Base Personality: ${basePersonality}
Current Caller Emotion Detected: "${customerEmotion || 'Neutral'}"

ABOUT THE BUSINESS OWNER & MISSION:
- Business Name: ${businessName}
- About Owner / Practice: ${ownerDesc}
- Why Callers Reach Out: ${ownerWhy}
- Workflows You Handle: ${ownerTasks}

${specificDomainDirectives}

${agent?.systemPrompt ? `DETAILED AGENT SYSTEM DIRECTIVES:\n${agent.systemPrompt}\n` : ''}

CRITICAL PHONE CALL GUIDELINES:
1. STRICT DOMAIN FIDELITY: Speak 100% within the context of ${businessName}. If this is a legal practice, speak ONLY as a criminal defense legal assistant. Never mention dental, logistics, or unrelated services!
2. BREVITY: Keep answers to 1 to 3 spoken sentences maximum (under 35 words). Callers want direct clarity.
3. ZERO MARKDOWN: Never use asterisks, bullet points, bolding, emojis, or code.
4. ADAPTIVE PERSONALITY MIRRORING:
   - If caller is PANICKED / DISTRESSED: Ground them with steady calming assurance. Validate their stress and move immediately to emergency action.
   - If caller is RUSHED: Zero small talk. Deliver direct answers immediately in <12 words.
   - If caller is ANGRY: Acknowledge with genuine empathy; never be defensive.
   - If caller declines: Acknowledge politely and ask what other question or matter they have.
5. APPOINTMENTS & ACTIONS: Directly offer to book consultations or trigger actions according to your tasks.
${languageDirective}`;

    try {
      if (config.provider === 'gemini') {
        const candidateModels = [
          'gemini-1.5-flash',
          'gemini-1.5-pro',
          'gemini-2.0-flash'
        ];

        const contents = [];
        const recentHistory = (conversationHistory || []).slice(-6);
        for (const msg of recentHistory) {
          contents.push({
            role: msg.speaker === 'bot' ? 'model' : 'user',
            parts: [{ text: msg.text }]
          });
        }
        contents.push({
          role: 'user',
          parts: [{ text: userText }]
        });

        let lastErr = null;
        for (const candidate of candidateModels) {
          try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${candidate}:generateContent?key=${config.apiKey.trim()}`;
            const response = await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                systemInstruction: {
                  parts: [{ text: systemInstruction }]
                },
                contents,
                generationConfig: {
                  temperature: 0.35,
                  maxOutputTokens: 120
                }
              })
            });

            if (response.ok) {
              const data = await response.json();
              const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
              const cleanReply = LLMService.sanitizeAndEnforceLanguage(rawText, isHindi, isLegal, businessName, agentName);
              if (cleanReply) {
                const latencyMs = Date.now() - startTime;
                return {
                  reply: cleanReply,
                  latencyMs,
                  provider: `Gemini (${candidate})`,
                  error: null
                };
              }
            } else {
              const err = await response.json().catch(() => ({}));
              lastErr = err.error?.message || `Gemini status ${response.status}`;
              if (lastErr.includes('API_KEY_INVALID') || response.status === 400) {
                break;
              }
            }
          } catch (e) {
            lastErr = e.message;
          }
        }

        console.warn('Gemini API Error:', lastErr);
        return { reply: null, error: lastErr || 'Gemini API call failed', provider: 'gemini' };
      }

      // xAI Grok / OpenAI / Groq / Custom
      if (config.provider === 'xai' || config.provider === 'openai' || config.provider === 'groq' || config.provider === 'custom') {
        let endpoint = 'https://api.openai.com/v1/chat/completions';
        let selectedModel = config.model || 'gpt-4o-mini';

        if (config.provider === 'xai') {
          endpoint = config.customEndpoint || 'https://api.x.ai/v1/chat/completions';
          selectedModel = config.model || 'grok-2-latest';
        } else if (config.provider === 'groq') {
          endpoint = 'https://api.groq.com/openai/v1/chat/completions';
          selectedModel = config.model || 'qwen/qwen3.8-27b';
        } else if (config.provider === 'custom') {
          endpoint = config.customEndpoint || 'https://api.openai.com/v1/chat/completions';
        }

        const messages = [{ role: 'system', content: systemInstruction }];
        const recentHistory = (conversationHistory || []).slice(-6);
        for (const msg of recentHistory) {
          messages.push({
            role: msg.speaker === 'bot' ? 'assistant' : 'user',
            content: msg.text
          });
        }
        messages.push({ role: 'user', content: userText });

        const sendRequest = async (modelToUse) => {
          return await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${config.apiKey.trim()}`
            },
            body: JSON.stringify({
              model: modelToUse,
              messages,
              temperature: 0.35,
              max_tokens: 120
            })
          });
        };

        let response = await sendRequest(selectedModel);

        // Auto-fallback if model not found on user's Groq tier
        if (!response.ok && config.provider === 'groq' && response.status === 404) {
          const fallbackModels = ['qwen/qwen3.8-27b', 'openai/gpt-oss-120b', 'allam-2-7b'].filter(m => m !== selectedModel);
          for (const fbModel of fallbackModels) {
            const retryRes = await sendRequest(fbModel);
            if (retryRes.ok) {
              response = retryRes;
              selectedModel = fbModel;
              break;
            }
          }
        }

        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          const errMsg = err.error?.message || err.error || `${config.provider.toUpperCase()} status ${response.status}`;
          console.error('LLM API Error:', errMsg);
          return { reply: null, error: errMsg, provider: config.provider };
        }

        const data = await response.json();
        const rawText = data.choices?.[0]?.message?.content || data.choices?.[0]?.message?.reasoning || '';
        const cleanReply = LLMService.sanitizeAndEnforceLanguage(rawText, isHindi, isLegal, businessName, agentName);

        const latencyMs = Date.now() - startTime;
        return {
          reply: cleanReply,
          latencyMs,
          provider: `${config.provider.toUpperCase()} (${selectedModel})`,
          error: null
        };
      }
    } catch (err) {
      console.warn('Live LLM Call exception:', err);
      return { reply: null, error: err.message || 'Network error connecting to LLM', provider: config.provider };
    }

    return null;
  }

  static sanitizeAndEnforceLanguage(text, isHindi, isLegal, businessName, agentName) {
    if (!text) return '';
    let clean = text.replace(/[*#_`]/g, '').trim();
    clean = clean.replace(/^(?:assistant|agent|saiesh|maya|carlos|axle|julian|bot|hindi|devanagari)\s*:\s*/i, '').trim();

    if (isHindi) {
      // Must contain Devanagari script!
      if (!/[\u0900-\u097F]/.test(clean)) {
        if (isLegal) {
          return `नमस्ते, मैं ${agentName || 'साएश'} हूँ। हम मियामी में आपातकालीन जमानत और क्रिमिनल डिफेंस में सहायता करते हैं। कृपया मुझे अपने केस या गिरफ्तारी का विवरण बताएँ।`;
        }
        return `नमस्ते, मैं ${agentName || 'असिस्टेंट'} हूँ। ${businessName || 'हमारी संस्था'} की ओर से मैं आपकी सहायता के लिए उपस्थित हूँ। कृपया मुझे अपना प्रश्न बताएँ।`;
      }
    } else {
      // English mode: must NOT contain Devanagari script!
      if (/[\u0900-\u097F]/.test(clean)) {
        if (isLegal) {
          return `Hello, this is ${agentName || 'Saiesh'} with the Criminal Defense practice in Miami. We assist with emergency bail hearings and legal defense. How can I help you right now?`;
        }
        return `Hello, this is ${agentName || 'Assistant'} with ${businessName || 'our office'}. How can I assist you with your inquiry today?`;
      }
    }

    return clean;
  }
}

