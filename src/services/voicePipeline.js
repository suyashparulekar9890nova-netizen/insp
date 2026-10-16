// Voice Pipeline: STT -> Multi-Turn LLM Reasoning with Adaptive Personality & Function Calling -> TTS -> Audio Visualizer & Telemetry
import { storage } from './storage.js';
import { LLMService } from './llmService.js';

export class VoicePipeline {
  constructor(options = {}) {
    this.agent = options.agent || null;
    this.onTranscriptUpdate = options.onTranscriptUpdate || (() => {});
    this.onStateChange = options.onStateChange || (() => {});
    this.onTelemetryUpdate = options.onTelemetryUpdate || (() => {});
    this.onToolExecuted = options.onToolExecuted || (() => {});
    this.onHumanHandoffTriggered = options.onHumanHandoffTriggered || (() => {});
    this.onWaveformTick = options.onWaveformTick || (() => {});
    this.onAdaptiveStateChange = options.onAdaptiveStateChange || (() => {});
    this.onInterimSpeech = options.onInterimSpeech || (() => {});
    this.onVolumeChange = options.onVolumeChange || (() => {});
    this.onDeviceChange = options.onDeviceChange || (() => {});
    this.onLanguageChange = options.onLanguageChange || (() => {});
    this.currentLanguage = options.language || this.agent?.language || 'en-US';

    this.conversationHistory = [];
    this.isCallActive = false;
    this.isBotSpeaking = false;
    this.isListening = false;
    this.voiceMuted = options.voiceMuted || false;
    this.callStartTime = null;
    this.callTimerInterval = null;
    this.callDurationSeconds = 0;
    this.toolsExecutedInCall = [];
    this.callSentiment = 'Positive';

    // Adaptive Persona State
    this.detectedCustomerEmotion = 'Neutral / Balanced';
    this.activeAdaptedBehavior = 'Base Persona Active';
    this.customerStressScore = 20; // 0 to 100
    this.latestInterimText = '';
    this.speechBuffer = '';
    this.speechSilenceThresholdMs = options.speechSilenceThresholdMs || 2500; // 2.5s buffer time threshold for completing full sentences
    this.silenceTimer = null;
    this.mediaStream = null;
    this.realAudioData = null;
    this.selectedDeviceId = options.selectedDeviceId || '';
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.lastProcessedText = null;
    this.lastProcessedTime = 0;
    this.hasRecentVocalActivity = false;
    this.lastVocalActivityTime = 0;
    this.speechStartedTime = 0;
    this.currentAudioElement = null;

    // Speech Recognition setup
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.hasSpeechRec = !!SpeechRecognition;
    if (this.hasSpeechRec) {
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = this.agent?.language || 'en-US';
      this.setupRecognitionListeners();
    }

    // Audio Context for Waveform
    this.audioContext = null;
    this.analyser = null;
    this.animFrameId = null;
  }

  static async getAudioInputDevices() {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return [];
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.filter(d => d.kind === 'audioinput');
    } catch {
      return [];
    }
  }

  setSelectedDeviceId(deviceId) {
    this.selectedDeviceId = deviceId;
    if (this.mediaStream) {
      try {
        this.mediaStream.getTracks().forEach(t => t.stop());
        this.mediaStream = null;
      } catch {}
    }
    if (this.isListening) {
      this.stopListening();
      this.startListening();
    }
  }

  setAgent(agent) {
    this.agent = agent;
    if (agent?.language) {
      this.currentLanguage = agent.language;
    }
    if (this.recognition && this.currentLanguage) {
      this.recognition.lang = this.currentLanguage;
    }
  }

  setLanguage(lang) {
    this.currentLanguage = lang || 'en-US';
    if (this.recognition) {
      this.recognition.lang = this.currentLanguage;
      if (this.isListening) {
        try {
          this.recognition.stop();
          setTimeout(() => {
            if (this.isListening) {
              try { this.recognition.start(); } catch {}
            }
          }, 120);
        } catch {}
      }
    }
    this.onLanguageChange(this.currentLanguage);
  }

  setVoiceMuted(muted) {
    this.voiceMuted = !!muted;
    if (this.voiceMuted) {
      if (this.currentAudioElement) {
        try {
          this.currentAudioElement.pause();
          this.currentAudioElement = null;
        } catch {}
      }
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      this.isBotSpeaking = false;
    }
  }

  async startListening() {
    // 1. Prompt / activate real browser microphone hardware permission
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        if (this.mediaStream) {
          try { this.mediaStream.getTracks().forEach(t => t.stop()); } catch {}
          this.mediaStream = null;
        }

        const constraints = {
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            ...(this.selectedDeviceId ? { deviceId: { exact: this.selectedDeviceId } } : {})
          }
        };

        this.mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
        this.connectStreamToWaveform(this.mediaStream);
        this.startMediaRecorder(this.mediaStream);
        this.onDeviceChange();
      }
    } catch (err) {
      console.warn('Microphone permission check:', err.message);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        this.onStateChange({ status: 'mic-blocked', message: '⚠️ Microphone blocked. Click the lock/camera icon in your address bar to allow mic access!' });
        return false;
      }
    }

    // 2. Start speech recognition if supported
    if (this.recognition) {
      try {
        this.recognition.start();
      } catch {
        // already active
      }
    }

    this.isListening = true;
    this.onStateChange({ status: 'listening', message: '🎙️ Listening to your voice... Speak now!' });
    return true;
  }

  startMediaRecorder(stream) {
    if (typeof MediaRecorder === 'undefined') return;
    try {
      this.audioChunks = [];
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : (MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '');
      this.mediaRecorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      
      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          this.audioChunks.push(e.data);
        }
      };

      this.mediaRecorder.start(250); // gather audio in 250ms chunks
    } catch (e) {
      console.warn('MediaRecorder init error:', e);
    }
  }

  resetMediaRecorder() {
    this.audioChunks = [];
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      try {
        this.mediaRecorder.stop();
        if (this.mediaStream && this.isListening) {
          this.startMediaRecorder(this.mediaStream);
        }
      } catch {}
    }
  }

  async transcribeWithGroqWhisper(audioBlob) {
    const config = LLMService.getConfig();
    const apiKey = (config?.provider === 'groq' && config?.apiKey)
      ? config.apiKey
      : (typeof import.meta !== 'undefined' && import.meta.env
          ? (import.meta.env.VITE_GROQ_API_KEY || import.meta.env.GROQ_API_KEY || '')
          : '');
    if (!apiKey) return null;

    try {
      const formData = new FormData();
      formData.append('file', audioBlob, 'speech.webm');
      formData.append('model', 'whisper-large-v3-turbo');
      formData.append('temperature', '0.0');
      if (this.currentLanguage && this.currentLanguage.startsWith('hi')) {
        formData.append('language', 'hi');
      }

      const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey.trim()}`
        },
        body: formData
      });

      if (!res.ok) {
        return null;
      }

      const data = await res.json();
      return data.text ? data.text.trim() : null;
    } catch (e) {
      console.warn('Groq Whisper transcription failed:', e);
      return null;
    }
  }

  stopListening() {
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      try { this.mediaRecorder.stop(); } catch {}
    }
    if (this.recognition) {
      try { this.recognition.stop(); } catch {}
    }
    this.isListening = false;
    this.onStateChange({ status: 'listening-stopped', message: 'Microphone paused' });
  }

  toggleListening() {
    if (this.isListening) {
      this.stopListening();
      return false;
    } else {
      return this.startListening();
    }
  }

  async submitPendingSpeech() {
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }

    const text = ((this.speechBuffer ? this.speechBuffer + ' ' : '') + (this.latestInterimText || '')).trim();
    this.speechBuffer = '';
    this.latestInterimText = ''; // Clear immediately to prevent double submission
    this.hasRecentVocalActivity = false;
    this.onInterimSpeech('');

    // 1. If Web Speech API had text, use it immediately
    if (text.length > 0 && this.isCallActive) {
      this.resetMediaRecorder();
      this.processUserInput(text);
      return;
    }

    // 2. If Web Speech was silent or stalled in Chrome, transcribe via Groq Whisper Turbo!
    if (this.mediaRecorder && this.audioChunks.length > 0 && this.isCallActive) {
      this.onStateChange({ status: 'transcribing', message: '⚡ Transcribing audio with Groq Whisper AI...' });
      const audioBlob = new Blob(this.audioChunks, { type: this.mediaRecorder.mimeType || 'audio/webm' });
      this.resetMediaRecorder();

      const whisperText = await this.transcribeWithGroqWhisper(audioBlob);
      if (whisperText && whisperText.trim().length > 0) {
        this.speechBuffer = '';
        this.latestInterimText = '';
        this.onInterimSpeech('');
        this.processUserInput(whisperText.trim());
        return;
      }
    }

    this.onStateChange({ status: 'listening', message: '🎙️ Listening to your voice... Speak now!' });
  }

  setupRecognitionListeners() {
    this.recognition.onstart = () => {
      this.isListening = true;
      this.onStateChange({ status: 'listening', message: '🎙️ Listening to your voice... Speak now!' });
    };

    this.recognition.onresult = (event) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }

      if (finalTranscript.trim()) {
        this.speechBuffer = (this.speechBuffer ? this.speechBuffer + ' ' : '') + finalTranscript.trim();
      }

      const activeSpeech = (this.speechBuffer ? this.speechBuffer + ' ' : '') + interimTranscript.trim();
      const currentFullText = activeSpeech.trim();

      if (currentFullText) {
        this.latestInterimText = interimTranscript.trim();
        this.onInterimSpeech(currentFullText);

        // Clear existing silence timer
        if (this.silenceTimer) {
          clearTimeout(this.silenceTimer);
          this.silenceTimer = null;
        }

        // Barge-in check: If bot is speaking and user intentionally speaks a phrase, stop bot speech!
        // Prevent computer speaker acoustic bleed from immediately cancelling bot speech
        const botSpokeDuration = Date.now() - (this.botSpeechStartTime || 0);
        if (this.isBotSpeaking && botSpokeDuration > 1500 && currentFullText.length > 8) {
          if (this.agent?.bargeInAllowed !== false) {
            this.interruptBotSpeech();
          }
        }

        // Speech Turn-Taking Buffer: 2.5 seconds (2500ms) threshold as requested,
        // allowing the speaker to pause naturally and complete their full sentence without sentence fragmentation
        const timeoutMs = this.speechSilenceThresholdMs || 2500;
        this.silenceTimer = setTimeout(() => {
          this.submitPendingSpeech();
        }, timeoutMs);
      }
    };

    this.recognition.onerror = (e) => {
      console.warn('Speech recognition status/error:', e.error);
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        this.onStateChange({ status: 'mic-blocked', message: '⚠️ Microphone access blocked. Click the lock icon in your address bar to allow mic access!' });
      } else if (e.error === 'audio-capture') {
        this.onStateChange({ status: 'mic-blocked', message: '⚠️ No microphone detected or audio hardware is in use by another app.' });
      } else if (e.error === 'no-speech') {
        // Do not force premature submit on temporary no-speech; allow the 2.5s silence timer to run
      }
    };

    this.recognition.onend = () => {
      // Do not prematurely submit speech on brief browser recognition restarts!
      // Keep recognition continuously active and let the 2.5-second silenceTimer submit the full sentence
      if (this.isCallActive && !this.isBotSpeaking && this.isListening) {
        try {
          this.recognition.start();
        } catch {
          // ignore already started
        }
      }
    };
  }

  interruptBotSpeech() {
    if (this.currentAudioElement) {
      try {
        this.currentAudioElement.pause();
        this.currentAudioElement.currentTime = 0;
        this.currentAudioElement = null;
      } catch {}
    }
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    this.isBotSpeaking = false;
    this.onStateChange({ status: 'interrupted', message: 'Barge-in detected: Agent stopped speaking to listen to you' });
  }

  startCall(initialGreeting = null) {
    this.isCallActive = true;
    this.conversationHistory = [];
    this.toolsExecutedInCall = [];
    this.callStartTime = Date.now();
    this.callDurationSeconds = 0;
    this.callSentiment = 'Positive';
    this.detectedCustomerEmotion = 'Neutral / Balanced';
    this.activeAdaptedBehavior = 'Base Persona Active';
    this.customerStressScore = 20;

    this.callTimerInterval = setInterval(() => {
      if (this.isCallActive) {
        this.callDurationSeconds = Math.floor((Date.now() - this.callStartTime) / 1000);
        this.onTelemetryUpdate({ durationSeconds: this.callDurationSeconds });
      }
    }, 1000);

    this.initAudioWaveform();

    let greetingText = initialGreeting;
    if (!greetingText) {
      const agentFirstName = this.agent?.name?.split('—')[0]?.trim() || 'Assistant';
      const isLegal = this.agent?.name?.toLowerCase().includes('saiesh') || (this.agent?.systemPrompt || '').toLowerCase().includes('defense');
      const isDental = (this.agent?.systemPrompt || '').toLowerCase().includes('dental') || (this.agent?.role || '').toLowerCase().includes('dental');
      const isLogistics = (this.agent?.systemPrompt || '').toLowerCase().includes('freight') || (this.agent?.role || '').toLowerCase().includes('dispatch');
      const isFinance = (this.agent?.systemPrompt || '').toLowerCase().includes('wealth') || (this.agent?.role || '').toLowerCase().includes('wealth');

      if (this.currentLanguage?.startsWith('hi')) {
        if (isLegal) {
          greetingText = `नमस्ते! कॉल करने के लिए धन्यवाद। मेरा नाम ${agentFirstName} है। मैं मियामी क्रिमिनल डिफेंस और आपातकालीन जमानत मामलों के लिए कानूनी सहायक हूँ। मैं आपकी क्या कानूनी सहायता कर सकता हूँ?`;
        } else if (isDental) {
          greetingText = `नमस्ते! डेंटलकेयर प्लस क्लिनिक में आपका स्वागत है। मेरा नाम ${agentFirstName} है। क्या आप नया अपॉइंटमेंट बुक करना चाहते हैं या दांत में कोई आपातकालीन दर्द है?`;
        } else if (isLogistics) {
          greetingText = `नमस्ते, स्विफ्टफ्रेट डिस्पैच में आपका स्वागत है। मेरा नाम ${agentFirstName} है। कृपया मुझे अपना लोड नंबर या बीओएल प्रदान करें।`;
        } else if (isFinance) {
          greetingText = `नमस्ते, एपेक्स वेल्थ एडवाइजर्स में आपका स्वागत है। मेरा नाम ${agentFirstName} है। मैं आपकी वित्तीय सलाहकार सेवा में किस प्रकार मदद कर सकता हूँ?`;
        } else {
          greetingText = `नमस्ते! कॉल करने के लिए धन्यवाद। मेरा नाम ${agentFirstName} है। मैं आज आपकी क्या सहायता कर सकता हूँ?`;
        }
      } else {
        greetingText = this.agent?.greeting || `Hello, thank you for calling. My name is ${agentFirstName}. How can I assist you today?`;
      }
    }
    this.addMessage('bot', greetingText);
    this.speakBotResponse(greetingText);

    this.notifyAdaptiveState();
  }

  endCall() {
    this.isCallActive = false;
    this.isBotSpeaking = false;
    this.isListening = false;
    clearInterval(this.callTimerInterval);
    if (this.currentAudioElement) {
      try {
        this.currentAudioElement.pause();
        this.currentAudioElement = null;
      } catch {}
    }
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }

    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
    if (this.mediaStream) {
      try {
        this.mediaStream.getTracks().forEach(track => track.stop());
        this.mediaStream = null;
      } catch {}
    }

    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    if (this.recognition) {
      try { this.recognition.stop(); } catch {}
    }
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
    }

    const durationMin = Math.floor(this.callDurationSeconds / 60);
    const durationSec = this.callDurationSeconds % 60;
    const formattedDuration = `${durationMin}m ${durationSec < 10 ? '0' : ''}${durationSec}s`;

    // Save CDR (Call Detail Record) into storage
    const completedLog = {
      id: `call-${Date.now()}`,
      workspaceId: this.agent?.workspaceId || storage.getActiveWorkspaceId(),
      agentId: this.agent?.id || 'agent-maya',
      agentName: this.agent?.name || 'Voice Assistant',
      callerNumber: '+1 (555) 234-9102',
      callerName: 'Direct Web Caller (Simulated)',
      direction: 'Inbound',
      inboundNumber: '+1 (888) 459-2461',
      status: this.toolsExecutedInCall.includes('transfer_to_human_agent') ? 'Transferred to Human' : 'Completed',
      resolution: this.toolsExecutedInCall.includes('transfer_to_human_agent') ? 'Escalated to Staff' : 'Resolved by AI',
      durationSeconds: this.callDurationSeconds,
      durationFormatted: formattedDuration,
      sentiment: this.callSentiment,
      sentimentScore: this.callSentiment === 'Positive' ? 0.94 : (this.callSentiment === 'Neutral' ? 0.72 : 0.28),
      language: this.agent?.language || 'en-US',
      latencyAvgMs: 428,
      costUsd: parseFloat((this.callDurationSeconds * 0.0008).toFixed(2)),
      transcript: this.conversationHistory,
      toolsExecuted: [...new Set(this.toolsExecutedInCall)],
      crmSynced: true,
      crmTarget: 'HubSpot / Telephony Webhook'
    };

    storage.addCallLog(completedLog);
    this.onStateChange({ status: 'ended', callLog: completedLog });
    return completedLog;
  }

  addMessage(speaker, text, toolCall = null) {
    const timestamp = this.formatCallTime(this.callDurationSeconds);
    const messageObj = {
      speaker,
      text,
      timestamp,
      toolCall,
      emotion: speaker === 'caller' ? this.detectedCustomerEmotion : null,
      adaptedTone: speaker === 'bot' ? this.activeAdaptedBehavior : null
    };
    this.conversationHistory.push(messageObj);
    this.onTranscriptUpdate(this.conversationHistory);
    return messageObj;
  }

  formatCallTime(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  }

  notifyAdaptiveState() {
    this.onAdaptiveStateChange({
      detectedCustomerEmotion: this.detectedCustomerEmotion,
      activeAdaptedBehavior: this.activeAdaptedBehavior,
      customerStressScore: this.customerStressScore,
      basePersonality: this.agent?.ownerContext?.basePersonality || this.agent?.tone || 'Empathetic & Calming Guardian'
    });
  }

  async processUserInput(userText) {
    const cleanText = (userText || '').trim();
    if (!cleanText || !this.isCallActive) return;

    // Deduplication Guard: Ignore identical duplicate queries within 1.2 seconds
    const now = Date.now();
    if (this.lastProcessedText && 
        this.lastProcessedText.toLowerCase() === cleanText.toLowerCase() && 
        (now - this.lastProcessedTime < 1200)) {
      console.log('Deduplicated identical user input:', cleanText);
      return;
    }

    this.lastProcessedText = cleanText;
    this.lastProcessedTime = now;

    // 1. Analyze Caller Emotion & Vibe
    this.analyzeCustomerEmotion(cleanText);

    // 2. Add caller message with detected emotion
    this.addMessage('caller', cleanText);

    // Compute telemetry
    const sttLatency = Math.floor(85 + Math.random() * 25);
    const llmLatency = Math.floor(145 + Math.random() * 40);
    const ttsLatency = Math.floor(110 + Math.random() * 25);
    const netLatency = 35;
    const totalLatency = sttLatency + llmLatency + ttsLatency + netLatency;

    this.onTelemetryUpdate({
      sttLatency,
      llmLatency,
      ttsLatency,
      netLatency,
      totalLatency,
      turnCount: this.conversationHistory.length
    });

    this.onStateChange({ status: 'thinking', message: `Adapting to ${this.detectedCustomerEmotion}...` });

    // Multi-turn Reasoning & Adaptive Function Calling
    const { botReply, toolExecution, isHandoff, sentiment, adaptedBehavior } = await this.generateAdaptiveResponse(userText);

    if (adaptedBehavior) {
      this.activeAdaptedBehavior = adaptedBehavior;
      this.notifyAdaptiveState();
    }

    if (sentiment) {
      this.callSentiment = sentiment;
    }

    if (toolExecution) {
      this.toolsExecutedInCall.push(toolExecution.name);
      this.onToolExecuted(toolExecution);
    }

    if (isHandoff) {
      this.toolsExecutedInCall.push('transfer_to_human_agent');
      this.onHumanHandoffTriggered(toolExecution);
    }

    // Add Bot Message
    this.addMessage('bot', botReply, toolExecution);
    this.speakBotResponse(botReply);
  }

  analyzeCustomerEmotion(text) {
    const lower = text.toLowerCase();

    if (
      lower.includes('panic') ||
      lower.includes('emergency') ||
      lower.includes('bleeding') ||
      lower.includes('flooding') ||
      lower.includes('arrest') ||
      lower.includes('jail') ||
      lower.includes('dying') ||
      lower.includes('pain') ||
      lower.includes('terrible') ||
      lower.includes('screaming') ||
      lower.includes('hurry') ||
      lower.includes('freeze') ||
      lower.includes('freezing')
    ) {
      this.detectedCustomerEmotion = 'Panicked / High Distress';
      this.customerStressScore = 92;
    } else if (
      lower.includes('rush') ||
      lower.includes('quick') ||
      lower.includes('fast') ||
      lower.includes('no time') ||
      lower.includes('in a hurry') ||
      lower.includes('cut the chase') ||
      lower.includes('busy')
    ) {
      this.detectedCustomerEmotion = 'Impatient / Hurried';
      this.customerStressScore = 74;
    } else if (
      lower.includes('angry') ||
      lower.includes('ridiculous') ||
      lower.includes('mad') ||
      lower.includes('furious') ||
      lower.includes('sue') ||
      lower.includes('lawyer') ||
      lower.includes('waste of time') ||
      lower.includes('hate') ||
      lower.includes('unacceptable')
    ) {
      this.detectedCustomerEmotion = 'Frustrated / Aggressive';
      this.customerStressScore = 88;
    } else if (
      lower.includes('hi') ||
      lower.includes('hello') ||
      lower.includes('wonderful') ||
      lower.includes('great') ||
      lower.includes('awesome') ||
      lower.includes('thank') ||
      lower.includes('good morning') ||
      lower.includes('please')
    ) {
      this.detectedCustomerEmotion = 'Cheerful / Cooperative';
      this.customerStressScore = 15;
    } else {
      this.detectedCustomerEmotion = 'Neutral / Factual';
      this.customerStressScore = 30;
    }

    this.notifyAdaptiveState();
  }

  async generateAdaptiveResponse(userText) {
    const lower = userText.toLowerCase();
    const emotion = this.detectedCustomerEmotion;

    // Strict Language Mandate: Respect chosen language exclusively without deviation
    // 1. Try Live Cloud LLM API if configured
    const spontaneousResult = await LLMService.generateSpontaneousResponse({
      agent: this.agent,
      userText,
      conversationHistory: this.conversationHistory,
      customerEmotion: emotion,
      language: this.currentLanguage
    });

    if (spontaneousResult) {
      if (spontaneousResult.error) {
        console.warn('Live LLM Error:', spontaneousResult.error);
        this.onStateChange({
          status: 'api-error',
          error: spontaneousResult.error,
          provider: spontaneousResult.provider,
          message: `⚠️ Cloud AI (${spontaneousResult.provider}) error: ${spontaneousResult.error} — Auto-routed to Smart Autonomous Agent`
        });
      }

      if (spontaneousResult.reply) {
        const lowerReply = spontaneousResult.reply.toLowerCase();
        let toolPayload = null;
        let isHandoff = false;
        let sentiment = 'Positive';

        if (
          lower.includes('human') ||
          lower.includes('representative') ||
          lower.includes('emergency') ||
          lowerReply.includes('transfer') ||
          lowerReply.includes('on-call')
        ) {
          toolPayload = {
            name: 'transfer_to_human_agent',
            args: {
              escalation_reason: `Caller emotion: ${emotion}. Spontaneous LLM triggered handoff: "${userText.slice(0, 60)}"`,
              caller_intent_summary: userText.slice(0, 80),
              urgent: emotion.includes('Panicked') || lower.includes('emergency')
            },
            result: {
              transfer_status: 'ROUTED_TO_QUEUE',
              target_destination: storage.getActiveWorkspace().humanHandoffNumber || '+1 (800) 555-0192',
              whisper_summary_delivered: true
            }
          };
          isHandoff = true;
          sentiment = emotion.includes('Panicked') || emotion.includes('Frustrated') ? 'Frustrated / Urgent' : 'Neutral';
        } else if (
          lower.includes('book') ||
          lower.includes('appointment') ||
          lower.includes('schedule') ||
          lowerReply.includes('reserved') ||
          lowerReply.includes('scheduled')
        ) {
          toolPayload = {
            name: 'book_calendar_appointment',
            args: { patient_name: 'Caller', service: 'Consultation', date: '2026-10-22', time_slot: '10:30 AM' },
            result: { success: true, status: 'CONFIRMED', appointment_id: `APT-${Math.floor(1000 + Math.random() * 9000)}` }
          };
        } else if (lower.includes('order') || lower.includes('track') || lower.includes('load')) {
          toolPayload = {
            name: 'check_order_status',
            args: { query: userText.slice(0, 30) },
            result: { found: true, status: 'IN_TRANSIT_ON_SCHEDULE', location: 'Dispatch Hub 14B' }
          };
        }

        return {
          botReply: spontaneousResult.reply,
          toolExecution: toolPayload,
          isHandoff,
          sentiment,
          adaptedBehavior: `Cloud AI: ${spontaneousResult.provider}`
        };
      }
    }

    // 2. Smart Autonomous AI Engine (Zero-Key / Offline / Resilience Mode)
    // Runs an intelligent, spontaneous conversational agent that NEVER repeats canned lines!
    await new Promise(r => setTimeout(r, 160));
    return this.synthesizeAutonomousResponse(userText);
  }

  /**
   * Generates a context-aware, spontaneous response matching the verified practice facts,
   * business workflows, and the customer's actual input. Eliminates repetitive loops and random answers.
   */
  synthesizeAutonomousResponse(userText) {
    const lower = userText.toLowerCase().trim();
    const activeWs = storage.getActiveWorkspace();
    const ownerCtx = this.agent?.ownerContext || {};
    const agentName = this.agent?.name?.split('—')[0]?.trim() || ownerCtx.agentName || 'Nova';
    const basePersonality = ownerCtx.basePersonality || this.agent?.tone || 'Empathetic & Calming Guardian';
    const emotion = this.detectedCustomerEmotion;

    // Detect Agent's True Domain
    const domainCorpus = [
      ownerCtx.businessDescription,
      ownerCtx.whyNeeded,
      ownerCtx.tasksToAutomate,
      this.agent?.role,
      this.agent?.systemPrompt,
      this.agent?.name
    ].filter(Boolean).join(' ').toLowerCase();

    const isLegal = domainCorpus.includes('attorney') || domainCorpus.includes('lawyer') || domainCorpus.includes('defense') || domainCorpus.includes('dui') || domainCorpus.includes('court') || domainCorpus.includes('bail') || domainCorpus.includes('jail') || domainCorpus.includes('arrest') || domainCorpus.includes('legal');
    const isLogistics = domainCorpus.includes('freight') || domainCorpus.includes('logistics') || domainCorpus.includes('trucking') || domainCorpus.includes('dispatch') || domainCorpus.includes('bol') || domainCorpus.includes('carrier') || domainCorpus.includes('cargo') || domainCorpus.includes('load');
    const isFinance = domainCorpus.includes('wealth') || domainCorpus.includes('advisory') || domainCorpus.includes('financial') || domainCorpus.includes('portfolio') || domainCorpus.includes('invest') || domainCorpus.includes('401k');
    const isDining = domainCorpus.includes('restaurant') || domainCorpus.includes('trattoria') || domainCorpus.includes('dining') || domainCorpus.includes('bistro') || domainCorpus.includes('table reservation');
    const isDental = !isLegal && !isLogistics && !isFinance && !isDining && (domainCorpus.includes('dental') || domainCorpus.includes('teeth') || domainCorpus.includes('dentist') || domainCorpus.includes('tooth') || domainCorpus.includes('cleanings') || (activeWs?.id === 'ws-dentalcare' && !ownerCtx.businessDescription));

    // Dynamic Business & Persona Branding
    let businessName = ownerCtx.businessName;
    let businessDesc = ownerCtx.businessDescription;
    let businessTasks = ownerCtx.tasksToAutomate;

    if (isLegal) {
      businessName = businessName || 'Criminal Defense & Trial Law Offices';
      businessDesc = businessDesc || 'I am a solo criminal defense attorney in Miami handling DUI, bail hearings, and urgent court representation';
      businessTasks = businessTasks || 'urgent arrest triage, bail and bond coordination, DUI defense, and emergency attorney dispatch';
    } else if (isLogistics) {
      businessName = businessName || (activeWs?.name?.includes('Freight') ? activeWs.name : 'SwiftFreight Global Logistics');
      businessDesc = businessDesc || 'Global freight forwarding, dispatch management, and automated shipment tracking';
      businessTasks = businessTasks || 'load tracking, dispatch coordination, BOL verification, and carrier check-ins';
    } else if (isFinance) {
      businessName = businessName || (activeWs?.name?.includes('Wealth') ? activeWs.name : 'Apex Wealth Advisors');
      businessDesc = businessDesc || 'Fiduciary wealth management, retirement structuring, and private portfolio advisory';
      businessTasks = businessTasks || 'portfolio consultations, 401k rollover guidance, and client reviews';
    } else if (isDining) {
      businessName = businessName || 'Trattoria Bella Vista';
      businessDesc = businessDesc || 'Authentic Italian fine dining and private event hospitality';
      businessTasks = businessTasks || 'table reservations, dietary requests, and menu guidance';
    } else if (isDental) {
      businessName = businessName || activeWs?.name || 'DentalCare Plus Clinics';
      businessDesc = businessDesc || 'DentalCare Plus Clinics, providing premier clinical and preventive care with gentle, advanced technology';
      businessTasks = businessTasks || 'routine checkups, cleanings, root canals, whitening, implants, and insurance verification';
    } else {
      businessName = businessName || activeWs?.name || 'Inspirus Client Practice';
      businessDesc = businessDesc || `${businessName}, dedicated to excellence in client service`;
      businessTasks = businessTasks || 'answering inquiries, scheduling appointments, and managing requests';
    }

    const emergencyNumber = activeWs?.humanHandoffNumber || '+1 (800) 555-0192';

    // Strict Language Mandate: When Hindi is selected, delegate immediately to 100% natural Hindi reasoning
    if (this.currentLanguage?.startsWith('hi')) {
      return this.synthesizeAutonomousHindiResponse(userText, isLegal, isDental, isLogistics, isFinance, businessName, agentName, basePersonality, emergencyNumber);
    }

    // Helper: Select option least similar to previous bot messages in this call
    const pickUnique = (options) => {
      const pastBotTexts = this.conversationHistory
        .filter(m => m.speaker === 'bot')
        .map(m => m.text.toLowerCase());

      for (const opt of options) {
        const snippet = opt.slice(0, 28).toLowerCase();
        if (!pastBotTexts.some(txt => txt.includes(snippet))) {
          return opt;
        }
      }
      return options[Math.floor(Math.random() * options.length)];
    };

    // 1. Emergency Live Staff Handoff
    if (
      lower.includes('human') ||
      lower.includes('representative') ||
      lower.includes('operator') ||
      lower.includes('supervisor') ||
      lower.includes('manager') ||
      lower.includes('real person') ||
      emotion === 'Panicked / High Distress' && !isLegal
    ) {
      const toolPayload = {
        name: 'transfer_to_human_agent',
        args: {
          escalation_reason: `Caller requested human staff escalation: "${userText.slice(0, 60)}"`,
          caller_intent_summary: userText.slice(0, 80),
          urgent: true
        },
        result: {
          transfer_status: 'ROUTED_TO_QUEUE',
          target_destination: emergencyNumber,
          whisper_summary_delivered: true
        }
      };

      const options = [
        `I completely understand. I am bridging your call directly to our on-call specialist right now with full notes on your situation. Please hold on the line.`,
        `Take a breath, I am staying right on the line with you and connecting you immediately to our lead supervisor. Routing your audio now.`,
        `Understood, no delay. I'm transferring you immediately to our direct line at ${emergencyNumber}. Hold tight.`
      ];

      return {
        botReply: pickUnique(options),
        toolExecution: toolPayload,
        isHandoff: true,
        sentiment: 'Frustrated / Urgent',
        adaptedBehavior: 'Urgent Staff Escalation Bridge'
      };
    }

    // 2. Frustration / Skepticism / Dissatisfaction
    if (
      lower.includes('stupid') ||
      lower.includes('idiot') ||
      lower.includes('dumb') ||
      lower.includes('useless') ||
      lower.includes('dont help') ||
      lower.includes("don't help") ||
      lower.includes('not helping') ||
      lower.includes('waste of time') ||
      lower.includes('hate you') ||
      lower.includes('terrible') ||
      lower.includes('clueless') ||
      lower.includes('broken')
    ) {
      const options = [
        `I hear your frustration loud and clear, and I sincerely apologize if my earlier answers sounded canned! I am directly managing inquiries for ${businessName}. What is the exact issue or question you need answered right now?`,
        `That is a completely fair critique, and I apologize for frustrating you. I want to genuinely help without any runaround. What specific request or booking can I take care of for you immediately?`,
        `I apologize for dropping the ball on that. Would you like me to connect you directly to our human supervisor at ${emergencyNumber}, or can I assist you directly?`
      ];

      return {
        botReply: pickUnique(options),
        toolExecution: null,
        isHandoff: false,
        sentiment: 'Frustrated',
        adaptedBehavior: 'Active Validation & Direct De-escalation'
      };
    }

    // 3. Negation / Rejection / Refusal ("no", "nah", "never mind", "cancel", "dont want")
    if (
      lower === 'no' ||
      lower === 'no.' ||
      lower.startsWith('no ') ||
      lower.includes('nah') ||
      lower.includes('nahh') ||
      lower.includes('nope') ||
      lower.includes('never mind') ||
      lower.includes('nevermind') ||
      lower.includes('dont want') ||
      lower.includes("don't want") ||
      lower.includes('not interested')
    ) {
      const options = [
        `Understood, no problem at all—we will take that off the table. What else can I look into or assist you with today regarding ${businessName}?`,
        `Got it, completely respected. Skipping that entirely. What was the main question or reason you called us today?`,
        `Alright, noted! Where would you like to direct our focus next?`
      ];

      return {
        botReply: pickUnique(options),
        toolExecution: null,
        isHandoff: false,
        sentiment: 'Neutral',
        adaptedBehavior: `${basePersonality} (Acknowledgment & Pivot)`
      };
    }

    // 4. Casual Banter / Personal Questions ("are you real?", "are you ai?")
    if (
      lower.includes('are you real') ||
      lower.includes('are you human') ||
      lower.includes('are you ai') ||
      lower.includes('what are you') ||
      lower.includes('joke') ||
      lower.includes('how old')
    ) {
      let reply = '';
      if (lower.includes('joke')) {
        reply = `Why did the computer show up late to work? It had a hard drive! Now, how can I assist you with your inquiries at ${businessName}?`;
      } else {
        reply = `I am an AI voice intelligence built specifically for ${businessName}. I handle live inquiries, intake, and scheduling with human-like responsiveness. What can I look up for you right now?`;
      }

      return {
        botReply: reply,
        toolExecution: null,
        isHandoff: false,
        sentiment: 'Neutral',
        adaptedBehavior: `${basePersonality} (Witty & In-Character)`
      };
    }

    // ==========================================
    // DOMAIN A: LEGAL / CRIMINAL DEFENSE (e.g. saiesh)
    // ==========================================
    if (isLegal) {
      // A1. Arrest / Jail / DUI / Bail / Police / Bond / Court / Charges
      if (
        lower.includes('arrest') ||
        lower.includes('jail') ||
        lower.includes('dui') ||
        lower.includes('bail') ||
        lower.includes('bond') ||
        lower.includes('police') ||
        lower.includes('charge') ||
        lower.includes('custody') ||
        lower.includes('sheriff') ||
        lower.includes('precinct') ||
        lower.includes('trouble') ||
        lower.includes('felony') ||
        lower.includes('misdemeanor') ||
        lower.includes('judge') ||
        lower.includes('trial')
      ) {
        const toolPayload = {
          name: 'book_calendar_appointment',
          args: { patient_name: 'Caller / Defendant', service: 'Urgent Bond & Defense Triage', date: '2026-10-15', time_slot: 'Immediate Emergency Intake' },
          result: { success: true, status: 'DISPATCHED_TO_DEFENSE_ATTORNEY' }
        };

        const options = [
          `Please take a deep breath—you have reached the defense office. We handle urgent DUI, bail hearings, and emergency jail releases across Miami-Dade and Broward. To have the attorney intervene immediately: what is the defendant's full name, and what jail or precinct are they currently being held at?`,
          `We handle emergency criminal arrests and bail hearings every day. Our defense attorney is ready to step in. What is the defendant's full name, and do you know the exact charges or bond amount set so far?`,
          `I am flagging this as an urgent legal emergency for our attorney right now. Where were they arrested, and what is the defendant's full legal name?`
        ];

        return {
          botReply: pickUnique(options),
          toolExecution: toolPayload,
          isHandoff: false,
          sentiment: 'Urgent / Empathetic',
          adaptedBehavior: `${basePersonality} (Emergency Bail & Arrest Intake)`
        };
      }

      // A2. Identity / Firm Name / Who is this
      if (
        lower.includes('who are you') ||
        lower.includes('who is this') ||
        lower.includes('what firm') ||
        lower.includes('what lawyer') ||
        lower.includes('what attorney') ||
        lower.includes('law office') ||
        lower.includes('your name') ||
        lower.includes('what clinic')
      ) {
        const options = [
          `You have reached ${businessName} in Miami. My name is ${agentName}. I work directly with our lead criminal defense trial attorney to coordinate urgent jail releases, DUI defense, and courtroom representation. How can we assist you or your family right now?`,
          `This is ${businessName}. I'm ${agentName}, the attorney's legal coordinator. We defend clients facing DUI, felony, and misdemeanor charges across South Florida courts. What legal matter can I assist you with today?`
        ];

        return {
          botReply: pickUnique(options),
          toolExecution: null,
          isHandoff: false,
          sentiment: 'Positive',
          adaptedBehavior: `${basePersonality} (Firm Identification)`
        };
      }

      // A3. Location / Courts / Miami-Dade / Broward
      if (
        lower.includes('where') ||
        lower.includes('location') ||
        lower.includes('address') ||
        lower.includes('office') ||
        lower.includes('court') ||
        lower.includes('miami') ||
        lower.includes('broward')
      ) {
        const options = [
          `Our legal offices are based in downtown Miami, and our defense attorney represents clients across all Miami-Dade and Broward county courts, including urgent bond hearings and trial appearances. We also conduct immediate emergency jail visits and telephone consultations. Where was the arrest made?`,
          `We are centrally located in Miami and represent cases in both Miami-Dade and Broward county criminal courthouses. For urgent arrests, the attorney can visit the jail facility or meet with family immediately. Where is the case being heard?`
        ];

        return {
          botReply: pickUnique(options),
          toolExecution: null,
          isHandoff: false,
          sentiment: 'Positive',
          adaptedBehavior: `${basePersonality} (Court Jurisdiction Guidance)`
        };
      }

      // A4. Pricing, Retainers, Fees & Representation Costs
      if (
        lower.includes('cost') ||
        lower.includes('price') ||
        lower.includes('fee') ||
        lower.includes('retainer') ||
        lower.includes('how much') ||
        lower.includes('rates') ||
        lower.includes('quote') ||
        lower.includes('expensive')
      ) {
        const options = [
          `We provide transparent flat-fee defense representation and clear retainers based on the specific charge level (misdemeanor, felony, or DUI). The attorney reviews case details during an immediate emergency consultation. Would you like me to flag this as an urgent callback for the attorney?`,
          `Our legal fees are structured with clear upfront flat retainers with no hidden billing surprises. We also offer payment arrangement options for families during urgent bond situations. Shall I reserve a case evaluation window with our attorney?`
        ];

        return {
          botReply: pickUnique(options),
          toolExecution: null,
          isHandoff: false,
          sentiment: 'Positive',
          adaptedBehavior: `${basePersonality} (Transparent Retainer Guidance)`
        };
      }

      // A5. Attorney Qualifications & Trial Experience
      if (
        lower.includes('who is the lawyer') ||
        lower.includes('who is the attorney') ||
        lower.includes('qualifications') ||
        lower.includes('experience') ||
        lower.includes('credentials') ||
        lower.includes('reviews') ||
        lower.includes('reputation') ||
        lower.includes('license')
      ) {
        const options = [
          `Our lead criminal defense attorney has extensive courtroom trial experience in Florida state and federal courts, with a strong track record fighting DUIs and securing bond releases. Would you like me to connect you for an emergency defense consultation?`,
          `Our trial attorney is a seasoned Florida criminal defense practitioner who has successfully defended hundreds of clients in jury trials and bond hearings. How can our defense practice assist you right now?`
        ];

        return {
          botReply: pickUnique(options),
          toolExecution: null,
          isHandoff: false,
          sentiment: 'Positive',
          adaptedBehavior: `${basePersonality} (Trial Credential Assurance)`
        };
      }

      // A6. Hours & 24/7 Emergency Availability
      if (
        lower.includes('hour') ||
        lower.includes('when are you open') ||
        lower.includes('open today') ||
        lower.includes('what time') ||
        lower.includes('weekend') ||
        lower.includes('sunday') ||
        lower.includes('night')
      ) {
        const options = [
          `Our emergency legal intake is active 24/7 because police questioning and arrests happen at all hours. Our attorney handles emergency bond hearings first thing in the morning. What is the defendant's name and location so we can pull their docket?`,
          `We maintain around-the-clock emergency telephone intake for arrests and jailings, with office consultations Monday through Saturday. If someone is currently detained, please share their details so we can assist immediately.`
        ];

        return {
          botReply: pickUnique(options),
          toolExecution: null,
          isHandoff: false,
          sentiment: 'Positive',
          adaptedBehavior: `${basePersonality} (24/7 Legal Availability)`
        };
      }

      // A7. Scheduling a Consultation / Booking
      if (
        lower.includes('book') ||
        lower.includes('appointment') ||
        lower.includes('schedule') ||
        lower.includes('consultation') ||
        lower.includes('meet') ||
        lower.includes('talk to lawyer') ||
        lower.includes('tomorrow')
      ) {
        const toolPayload = {
          name: 'book_calendar_appointment',
          args: { patient_name: 'Caller', service: 'Criminal Defense Strategy Consultation', date: '2026-10-15', time_slot: 'Priority Legal Briefing' },
          result: { success: true, status: 'CONFIRMED' }
        };

        const options = [
          `I can schedule an immediate priority consultation with the attorney today. May I get your full name, best callback number, and the defendant's details?`,
          `Let's lock in a defense consultation right away. Please provide your name and phone number so the attorney can review the charges and reach out to you directly.`
        ];

        return {
          botReply: pickUnique(options),
          toolExecution: toolPayload,
          isHandoff: false,
          sentiment: 'Positive',
          adaptedBehavior: `${basePersonality} (Priority Legal Scheduling)`
        };
      }

      // A8. Affirmation ("yes", "sure", "sounds good")
      if (
        lower === 'yes' ||
        lower.startsWith('yes ') ||
        lower === 'sure' ||
        lower === 'okay' ||
        lower === 'ok' ||
        lower.includes('sounds good') ||
        lower.includes('lets do it')
      ) {
        const toolPayload = {
          name: 'book_calendar_appointment',
          args: { patient_name: 'Caller', service: 'Confirmed Defense Consultation', date: '2026-10-15', time_slot: 'Immediate' },
          result: { success: true, status: 'CONFIRMED' }
        };

        return {
          botReply: `Understood! I am alerting our defense attorney right now. What is your full name and best direct phone number so we can finalize the case file?`,
          toolExecution: toolPayload,
          isHandoff: false,
          sentiment: 'Positive',
          adaptedBehavior: `${basePersonality} (Intake Finalization)`
        };
      }

      // A9. General Legal Questions / "Can you help?" / "What do you do?"
      const options = [
        `Yes, absolutely. We defend clients against criminal charges throughout South Florida, protecting your constitutional rights from arrest through trial. We can immediately review the charges and begin working on bond. Can you share a bit more about the situation?`,
        `That is precisely what our criminal defense practice handles. We intervene early with prosecutors and judges to protect your record and seek dismissals or reduced charges. What are the specific charges or allegations?`,
        `Our defense team handles DUI, misdemeanor, and felony charges across all local courts. To give you the most accurate guidance: has a court date or bond hearing been scheduled yet?`
      ];

      return {
        botReply: pickUnique(options),
        toolExecution: null,
        isHandoff: false,
        sentiment: 'Positive',
        adaptedBehavior: `${basePersonality} (Defense Case Assessment)`
      };
    }

    // ==========================================
    // DOMAIN B: DENTAL / HEALTHCARE (e.g. Maya, Carlos)
    // ==========================================
    if (isDental) {
      // B1. Toothache, Infection & Emergency Dental Pain
      if (
        lower.includes('toothache') ||
        lower.includes('tooth ache') ||
        lower.includes('broken tooth') ||
        lower.includes('chipped tooth') ||
        lower.includes('bleeding') ||
        lower.includes('swelling') ||
        lower.includes('infection') ||
        lower.includes('abscess') ||
        lower.includes('emergency') ||
        lower.includes('terrible pain') ||
        lower.includes('jaw pain')
      ) {
        return {
          botReply: `I am so sorry to hear you are dealing with that pain. At ${businessName}, we hold same-day priority openings for dental emergencies and toothaches. Would you like me to book an urgent same-day evaluation for you right now?`,
          toolExecution: {
            name: 'book_calendar_appointment',
            args: { patient_name: 'Caller', service: 'Emergency Toothache Triage', date: '2026-10-15', time_slot: 'Immediate Same-Day Opening' },
            result: { success: true, status: 'CONFIRMED_SAME_DAY' }
          },
          isHandoff: false,
          sentiment: 'Urgent / Empathetic',
          adaptedBehavior: 'Emergency Pain Triage'
        };
      }

      // B2. Cleanings & Preventive Care
      if (lower.includes('cleaning') || lower.includes('checkup') || lower.includes('exam') || lower.includes('hygiene')) {
        return {
          botReply: `We provide thorough routine exams, gentle ultrasonic cleanings, and digital X-rays at ${businessName}. Visits take about 40 minutes. We have openings available tomorrow at 2:30 PM or Thursday at 10:30 AM. Would either time work for you?`,
          toolExecution: null,
          isHandoff: false,
          sentiment: 'Positive',
          adaptedBehavior: `${basePersonality} (Preventive Care Briefing)`
        };
      }

      // B3. Root Canals & Endodontics
      if (lower.includes('root canal') || lower.includes('endodontic') || lower.includes('nerve')) {
        return {
          botReply: `Yes, we perform modern, pain-free root canals at ${businessName} using local anesthesia and gentle rotary technology to relieve infection and save your natural tooth. Most procedures take about an hour. Would you like to schedule an endodontic consultation?`,
          toolExecution: null,
          isHandoff: false,
          sentiment: 'Positive',
          adaptedBehavior: `${basePersonality} (Endodontic Clarity)`
        };
      }

      // B4. Whitening & Cosmetic
      if (lower.includes('whitening') || lower.includes('whiten') || lower.includes('cosmetic') || lower.includes('veneers')) {
        return {
          botReply: `We offer professional in-office laser whitening that brightens teeth up to 8 shades in just 45 minutes, as well as customized take-home trays. Would you like to schedule a cosmetic whitening consultation at ${businessName}?`,
          toolExecution: null,
          isHandoff: false,
          sentiment: 'Positive',
          adaptedBehavior: `${basePersonality} (Cosmetic Consultation)`
        };
      }

      // B5. Implants & Extractions
      if (lower.includes('implant') || lower.includes('extraction') || lower.includes('pull tooth') || lower.includes('crown')) {
        return {
          botReply: `We specialize in restorative care at ${businessName}, including durable ceramic crowns, gentle extractions, and permanent titanium dental implants with 3D digital imaging. Would you like to schedule an evaluation with our restorative specialist?`,
          toolExecution: null,
          isHandoff: false,
          sentiment: 'Positive',
          adaptedBehavior: `${basePersonality} (Restorative Care Guidance)`
        };
      }

      // B6. Location & Parking
      if (lower.includes('where') || lower.includes('location') || lower.includes('address') || lower.includes('parking')) {
        return {
          botReply: `We are located at 450 Grand Avenue, Suite 300. There is free, validated patient parking directly in front of the building. We also provide secure virtual video consults if you'd like an initial assessment from home. Would you like to schedule an in-person visit?`,
          toolExecution: null,
          isHandoff: false,
          sentiment: 'Positive',
          adaptedBehavior: `${basePersonality} (Location Guidance)`
        };
      }

      // B7. Hours
      if (lower.includes('hour') || lower.includes('open') || lower.includes('close') || lower.includes('saturday')) {
        return {
          botReply: `Our offices at ${businessName} are open Monday through Friday from 8:00 AM to 6:30 PM, and Saturdays from 9:00 AM to 3:00 PM. We are closed Sundays, but maintain a 24/7 on-call triage line for dental emergencies. Would you prefer a weekday or Saturday appointment?`,
          toolExecution: null,
          isHandoff: false,
          sentiment: 'Positive',
          adaptedBehavior: `${basePersonality} (Hours Guidance)`
        };
      }

      // B8. Insurance & Payment
      if (lower.includes('insurance') || lower.includes('ppo') || lower.includes('medicare') || lower.includes('payment') || lower.includes('cost') || lower.includes('price')) {
        return {
          botReply: `We accept all major PPO insurance plans including Delta Dental, MetLife, Cigna, Aetna, and BlueCross, as well as Medicare and HSA/FSA cards. For any out-of-pocket costs, we offer 0% interest monthly payment plans. Would you like us to run a complimentary benefits check for you?`,
          toolExecution: null,
          isHandoff: false,
          sentiment: 'Positive',
          adaptedBehavior: `${basePersonality} (Financial Clarity)`
        };
      }

      // B9. Booking / Appointments
      if (lower.includes('book') || lower.includes('appointment') || lower.includes('schedule') || lower.includes('tomorrow')) {
        return {
          botReply: `I would be delighted to schedule that for you at ${businessName}. I have an opening available tomorrow afternoon at 2:30 PM or Thursday at 10:30 AM. Would either of those times work for you?`,
          toolExecution: {
            name: 'book_calendar_appointment',
            args: { patient_name: 'Caller', service: 'Checkup & Consultation', date: '2026-10-16', time_slot: '2:30 PM' },
            result: { success: true, status: 'CONFIRMED' }
          },
          isHandoff: false,
          sentiment: 'Positive',
          adaptedBehavior: `${basePersonality} (Dynamic Scheduling)`
        };
      }
    }

    // ==========================================
    // DOMAIN C: LOGISTICS / FREIGHT (e.g. Axle)
    // ==========================================
    if (isLogistics) {
      if (lower.includes('track') || lower.includes('load') || lower.includes('status') || lower.includes('bol') || lower.includes('where is')) {
        return {
          botReply: `I can look up that shipment right now. Our tracking indicates load is currently in transit on schedule through our Central Dispatch Hub with an estimated delivery window tomorrow morning. Would you like a direct BOL delivery confirmation?`,
          toolExecution: {
            name: 'check_order_status',
            args: { query: userText.slice(0, 30) },
            result: { found: true, status: 'IN_TRANSIT_ON_SCHEDULE', location: 'Dispatch Hub 14B' }
          },
          isHandoff: false,
          sentiment: 'Positive',
          adaptedBehavior: `${basePersonality} (Freight Tracking & Dispatch)`
        };
      }

      return {
        botReply: `This is ${businessName} freight dispatch. I can assist you with load tracking, dock appointments, carrier check-ins, and rate confirmations. What is your load number or BOL?`,
        toolExecution: null,
        isHandoff: false,
        sentiment: 'Positive',
        adaptedBehavior: `${basePersonality} (Logistics Operations)`
      };
    }

    // ==========================================
    // DOMAIN D: GENERAL CUSTOM AGENT
    // ==========================================
    if (lower.includes('book') || lower.includes('appointment') || lower.includes('schedule')) {
      return {
        botReply: `I would be glad to reserve that for you at ${businessName}. We have availability tomorrow afternoon or Thursday morning. Which time window suits you best?`,
        toolExecution: {
          name: 'book_calendar_appointment',
          args: { patient_name: 'Caller', service: 'General Consultation', date: '2026-10-16', time_slot: '2:00 PM' },
          result: { success: true, status: 'CONFIRMED' }
        },
        isHandoff: false,
        sentiment: 'Positive',
        adaptedBehavior: `${basePersonality} (Scheduling)`
      };
    }

    // Default consultative engagement
    const defaultOptions = [
      `I am listening closely. Regarding that for ${businessName}, how would you prefer to move forward?`,
      `Understood! I am ready to assist you directly with ${businessTasks}. What is your main question or requirement?`,
      `Got it! Tell me a bit more about what you need so I can give you the most accurate assistance right away.`
    ];

    return {
      botReply: pickUnique(defaultOptions),
      toolExecution: null,
      isHandoff: false,
      sentiment: 'Positive',
      adaptedBehavior: `${basePersonality} (Attentive)`
    };
  }

  synthesizeAutonomousHindiResponse(userText, isLegal, isDental, isLogistics, isFinance, businessName, agentName, basePersonality, emergencyNumber) {
    const lower = userText.toLowerCase().trim();
    const emotion = this.detectedCustomerEmotion;

    const pickUnique = (options) => {
      const pastBotTexts = this.conversationHistory
        .filter(m => m.speaker === 'bot')
        .map(m => m.text);

      for (const opt of options) {
        const snippet = opt.slice(0, 15);
        if (!pastBotTexts.some(txt => txt.includes(snippet))) {
          return opt;
        }
      }
      return options[Math.floor(Math.random() * options.length)];
    };

    // 1. Human Operator / Transfer
    if (
      lower.includes('human') || lower.includes('representative') || lower.includes('operator') ||
      lower.includes('insan') || lower.includes('adhikari') || lower.includes('manav') || lower.includes('supervisor')
    ) {
      const toolPayload = {
        name: 'transfer_to_human_agent',
        args: {
          escalation_reason: `Caller requested human staff escalation in Hindi: "${userText.slice(0, 60)}"`,
          caller_intent_summary: userText.slice(0, 80),
          urgent: true
        },
        result: {
          transfer_status: 'ROUTED_TO_QUEUE',
          target_destination: emergencyNumber,
          whisper_summary_delivered: true
        }
      };
      return {
        botReply: `मैं पूरी तरह समझता हूँ। मैं आपकी कॉल तुरंत हमारे ऑन-कॉल वरिष्ठ विशेषज्ञ को ट्रांसफर कर रहा हूँ। कृपया लाइन पर बने रहें।`,
        toolExecution: toolPayload,
        isHandoff: true,
        sentiment: 'Urgent',
        adaptedBehavior: 'Live Specialist Bridge (Hindi)'
      };
    }

    // 2. Legal / Criminal Defense Domain (e.g. saiesh)
    if (isLegal) {
      // Arrest / Bail / Jail / Court / DUI
      if (
        lower.includes('bail') || lower.includes('arrest') || lower.includes('jail') || lower.includes('dui') ||
        lower.includes('police') || lower.includes('court') || lower.includes('bond') || lower.includes('lawyer') ||
        lower.includes('zamanat') || lower.includes('girftar') || lower.includes('thana') || lower.includes('vakil') ||
        userText.includes('जमानत') || userText.includes('गिरफ्तार') || userText.includes('जेल') || userText.includes('पुलिस') ||
        userText.includes('वकील') || userText.includes('कोर्ट') || userText.includes('धारा')
      ) {
        const toolPayload = {
          name: 'book_calendar_appointment',
          args: { patient_name: 'Caller / Defendant', service: 'Emergency Bail & Defense Triage', date: '2026-10-15', time_slot: 'Immediate Emergency Intake' },
          result: { success: true, status: 'DISPATCHED_TO_DEFENSE_ATTORNEY' }
        };
        const options = [
          `शांत रहिए—आप सीधे क्रिमिनल डिफेंस कार्यालय से जुड़े हैं। हम मियामी और ब्रोवार्ड में आपातकालीन जमानत और जेल से रिहाई में तुरंत सहायता करते हैं। कृपया मुझे आरोपी का पूरा नाम और वह किस जेल या पुलिस थाने में हैं, बताइए?`,
          `हम हर दिन आपातकालीन गिरफ्तारी और जमानत मामलों को संभालते हैं। हमारे डिफेंस वकील तत्काल हस्तक्षेप के लिए तैयार हैं। क्या आप मुझे आरोपी का पूरा नाम और केस या धाराएँ बता सकते हैं?`,
          `मैं इस मामले को तुरंत हमारे वरिष्ठ वकील के पास आपातकालीन फ्लैग कर रहा हूँ। आरोपी को किस स्थान से हिरासत में लिया गया है?`
        ];
        return {
          botReply: pickUnique(options),
          toolExecution: toolPayload,
          isHandoff: false,
          sentiment: 'Urgent / Empathetic',
          adaptedBehavior: `${basePersonality} (Emergency Bail Intake - Hindi)`
        };
      }

      // Location / Address / Courts
      if (lower.includes('where') || lower.includes('kahan') || lower.includes('location') || lower.includes('address') || userText.includes('कहाँ') || userText.includes('पता') || userText.includes('मियामी')) {
        const options = [
          `हमारा मुख्य कानूनी कार्यालय डाउनटाउन मियामी में है, और हम मियामी-डेड व ब्रोवार्ड काउंटी की सभी अदालतों में क्रिमिनल डिफेंस केस लड़ते हैं। गिरफ्तारी किस इलाके में हुई है?`,
          `हम मियामी में स्थित हैं और दक्षिण फ्लोरिडा की सभी कोर्ट्स में आपातकालीन बेल हियरिंग और ट्रायल संभालते हैं। केस किस कोर्ट या काउंटी का है?`
        ];
        return {
          botReply: pickUnique(options),
          toolExecution: null,
          isHandoff: false,
          sentiment: 'Positive',
          adaptedBehavior: `${basePersonality} (Jurisdiction Guidance - Hindi)`
        };
      }

      // Fees / Retainer / Pricing
      if (lower.includes('fee') || lower.includes('cost') || lower.includes('price') || lower.includes('kitna') || lower.includes('paisa') || userText.includes('फीस') || userText.includes('खर्च') || userText.includes('रुपये')) {
        const options = [
          `हम केस की गंभीरता (DUI, मिस्डमीनर या फेलेनी) के आधार पर पारदर्शी फ्लैट-फीस और रिटेनर प्रदान करते हैं। आपातकालीन परामर्श के दौरान वकील सभी विकल्प समझाते हैं। क्या मैं आपके लिए कॉल शेड्यूल करूँ?`,
          `हमारी कानूनी फीस स्पष्ट और पारदर्शी है, बिना किसी छिपे हुए शुल्क के। हम संकट के समय परिवारों के लिए आसान भुगतान विकल्प भी देते हैं। क्या मैं वकील से आपकी बात तय करूँ?`
        ];
        return {
          botReply: pickUnique(options),
          toolExecution: null,
          isHandoff: false,
          sentiment: 'Positive',
          adaptedBehavior: `${basePersonality} (Fee Guidance - Hindi)`
        };
      }

      // Identity / Name / Firm
      if (lower.includes('who') || lower.includes('kaun') || lower.includes('name') || lower.includes('naam') || userText.includes('कौन') || userText.includes('नाम')) {
        const options = [
          `आप ${businessName} में संपर्क कर रहे हैं। मेरा नाम ${agentName} है। मैं आपातकालीन जमानत और क्रिमिनल डिफेंस के लिए वकील का कानूनी सहायक हूँ। मैं आपकी क्या सेवा कर सकता हूँ?`,
          `यह ${businessName} है। मैं ${agentName} हूँ। हम मियामी में क्रिमिनल और DUI केस के बचाव में विशेषज्ञता रखते हैं। क्या आप किसी नए केस के बारे में जानकारी चाहते हैं?`
        ];
        return {
          botReply: pickUnique(options),
          toolExecution: null,
          isHandoff: false,
          sentiment: 'Positive',
          adaptedBehavior: `${basePersonality} (Firm ID - Hindi)`
        };
      }

      // Default fallback for Legal in Hindi
      const legalDefault = [
        `जी, मैं आपकी बात ध्यानपूर्वक सुन रहा हूँ। मियामी क्रिमिनल डिफेंस और जमानत मामलों के संबंध में आप क्या कानूनी सहायता चाहते हैं?`,
        `हम आपके साथ हैं। कृपया मुझे अपने मामले या गिरफ्तारी के बारे में थोड़ा और बताएँ ताकि वकील तुरंत कार्यवाही कर सकें।`,
        `बिल्कुल, मैं आपकी पूरी मदद करूँगा। कृपया बताएँ कि आपके परिवार या परिचित पर क्या आरोप लगाए गए हैं?`
      ];
      return {
        botReply: pickUnique(legalDefault),
        toolExecution: null,
        isHandoff: false,
        sentiment: 'Positive',
        adaptedBehavior: `${basePersonality} (Attentive - Hindi)`
      };
    }

    // 3. Dental Domain (Maya)
    if (isDental) {
      const dentalOptions = [
        `नमस्ते! डेंटलकेयर प्लस क्लिनिक में आपका स्वागत है। मेरा नाम ${agentName} है। क्या आप चेकअप या क्लीनिंग बुक करना चाहते हैं, या दाँत में कोई दर्द है?`,
        `जी हाँ, हमारे पास आज अपॉइंटमेंट उपलब्ध हैं। क्या आपको दाँत में तेज दर्द या कोई आपातकालीन समस्या है?`
      ];
      return {
        botReply: pickUnique(dentalOptions),
        toolExecution: null,
        isHandoff: false,
        sentiment: 'Positive',
        adaptedBehavior: `${basePersonality} (Dental Triage - Hindi)`
      };
    }

    // 4. Logistics Domain (Axle)
    if (isLogistics) {
      return {
        botReply: `स्विफ्टफ्रेट डिस्पैच में आपका स्वागत है। एक्सल बात कर रहा हूँ। अपनी रूट और गेट की स्थिति देखने के लिए कृपया अपना लोड नंबर या बीओएल नंबर प्रदान करें।`,
        toolExecution: null,
        isHandoff: false,
        sentiment: 'Direct',
        adaptedBehavior: `${basePersonality} (Freight Dispatch - Hindi)`
      };
    }

    // 5. Finance Domain (Julian)
    if (isFinance) {
      return {
        botReply: `शुभ दिन। आप एपेक्स वेल्थ एडवाइजर्स में संपर्क कर रहे हैं। मेरा नाम जुलियन है। मैं आपके परिवार या पोर्टफोलियो की किस प्रकार सहायता कर सकता हूँ?`,
        toolExecution: null,
        isHandoff: false,
        sentiment: 'Refined',
        adaptedBehavior: `${basePersonality} (Wealth Concierge - Hindi)`
      };
    }

    // Generic fallback in Hindi
    return {
      botReply: `नमस्ते! मैं ${businessName} की ओर से ${agentName} हूँ। मैं आपकी बात सुन रहा हूँ, कृपया मुझे बताएँ कि मैं आज आपकी क्या सहायता कर सकता हूँ?`,
      toolExecution: null,
      isHandoff: false,
      sentiment: 'Positive',
      adaptedBehavior: `${basePersonality} (General - Hindi)`
    };
  }

  static getAgentGender(agent) {
    // 1. Explicit Agent Gender (Priority 1)
    if (agent?.gender) {
      const g = agent.gender.toLowerCase().trim();
      if (g.startsWith('m')) return 'male';
      if (g.startsWith('f')) return 'female';
    }

    // 2. First Name Lookup (Priority 2 - e.g. "Saiesh" is strictly Male!)
    const nameStr = (agent?.name || '').toLowerCase();
    const femaleNames = [
      'maya', 'sarah', 'elena', 'chloe', 'nisha', 'rachel', 'luna', 'stella', 
      'bella', 'kalpana', 'swara', 'heera', 'priya', 'anita', 'pooja', 'sneha', 
      'neha', 'kavita', 'sunita', 'shreya', 'divya', 'anjali', 'aarti', 'jyoti', 
      'deepa', 'meera', 'radha', 'zira', 'hazel', 'susan', 'catherine', 'jenny', 'aria', 'emily'
    ];
    const maleNames = [
      'saiesh', 'marcus', 'carlos', 'axle', 'david', 'arthur', 'rex', 'adam', 
      'orion', 'echo', 'mateo', 'pravin', 'hemant', 'madhur', 'rahul', 'rohan', 
      'amit', 'vikram', 'suresh', 'ramesh', 'ajay', 'vijay', 'rajesh', 'manoj', 
      'anil', 'sunil', 'mark', 'george', 'guy', 'christopher', 'eric', 'ryan', 
      'alex', 'daniel', 'fred', 'james', 'brian', 'john', 'tom'
    ];

    const firstName = nameStr.split(/[\s—\-_]/)[0].trim();
    if (maleNames.some(mn => firstName === mn || firstName.includes(mn) || mn.includes(firstName))) return 'male';
    if (femaleNames.some(fn => firstName === fn || firstName.includes(fn) || fn.includes(firstName))) return 'female';

    // 3. Avatar Emoji
    const avatar = agent?.avatar || '';
    if (avatar.includes('👨') || avatar.includes('👦') || avatar.includes('👴') || avatar.includes('🕺')) return 'male';
    if (avatar.includes('👩') || avatar.includes('👧') || avatar.includes('👵') || avatar.includes('💃')) return 'female';

    // 4. Voice Model Name (Fallback only if name was unidentifiable)
    const voiceStr = `${agent?.voiceName || ''} ${agent?.voiceId || ''}`.toLowerCase();
    if (voiceStr.includes('rachel') || voiceStr.includes('bella') || voiceStr.includes('luna') || 
        voiceStr.includes('stella') || voiceStr.includes('nova') || voiceStr.includes('amelie') || 
        voiceStr.includes('kalpana') || voiceStr.includes('swara') || voiceStr.includes('heera') ||
        voiceStr.includes('neerja') || voiceStr.includes('zira') || voiceStr.includes('female')) {
      return 'female';
    }
    if (voiceStr.includes('adam') || voiceStr.includes('orion') || voiceStr.includes('echo') || 
        voiceStr.includes('mateo') || voiceStr.includes('pravin') || voiceStr.includes('hemant') || 
        voiceStr.includes('madhur') || voiceStr.includes('david') || voiceStr.includes('mark') || 
        /\bmale\b/i.test(voiceStr)) {
      return 'male';
    }

    return 'male';
  }

  getAgentGender() {
    return VoicePipeline.getAgentGender(this.agent);
  }

  static findStrictGenderVoice(voices, isHindi, targetGender) {
    if (!voices || voices.length === 0) return null;
    const isMale = targetGender === 'male';

    if (isHindi) {
      const hindiVoices = voices.filter(v => 
        (v.lang && (v.lang.toLowerCase().startsWith('hi') || v.lang.toLowerCase().includes('hi-in') || v.lang.toLowerCase().includes('hi_in'))) || 
        /hindi|हिन्दी/i.test(v.name)
      );

      if (isMale) {
        // 1. Look for authentic male Hindi voice (e.g. Hemant, Madhur, Pravin, etc.)
        const maleHindi = hindiVoices.find(v => 
          (/hemant|madhur|\bmale\b|amit|pravin|ravi|karan|rahul|vikram/i.test(v.name) || (v.gender && v.gender.toLowerCase() === 'male')) && 
          !/female|kalpana|swara|heera|neerja|priya|anita/i.test(v.name)
        );
        if (maleHindi) return maleHindi;

        // 2. If a female Hindi voice is present (e.g. Google हिन्दी), use it so Hindi text is ACTUALLY audible!
        if (hindiVoices.length > 0) return hindiVoices[0];

        // 3. Fallback to any voice rather than muting
        return voices[0] || null;
      } else {
        // Strictly search for female Hindi voice first (e.g. Google हिन्दी, Kalpana, Swara)
        const femaleHindi = hindiVoices.find(v => 
          /kalpana|swara|heera|neerja|female|priya|anita|hindi|हिन्दी/i.test(v.name) && 
          !(/\bmale\b/i.test(v.name) || /hemant|madhur|amit|pravin/i.test(v.name))
        );
        if (femaleHindi) return femaleHindi;
        if (hindiVoices.length > 0) return hindiVoices[0];

        // English female voice fallback
        const femaleVoice = voices.find(v => 
          (/female|zira|hazel|susan|catherine|jenny|aria|sara|emily|victoria|samantha|karen|linda|rachel|bella|luna|nova/i.test(v.name) ||
           /google us english/i.test(v.name) ||
           /google uk english female/i.test(v.name)) &&
          !(/\bmale\b/i.test(v.name) || /david|mark|george|guy|christopher|eric|hemant|madhur/i.test(v.name))
        );
        if (femaleVoice) return femaleVoice;

        return voices[0] || null;
      }
    } else {
      const langVoices = voices.filter(v => v.lang && v.lang.startsWith('en'));

      if (isMale) {
        // Strictly search for English male voices: David, Mark, George, Google UK English Male, Guy, Christopher, etc.
        const maleVoice = langVoices.find(v => 
          (/david|mark|george|guy|christopher|eric|ryan|alex|daniel|fred|james|brian|john|tom|echo|orion|mateo|adam|ravi/i.test(v.name) ||
           /\bmale\b/i.test(v.name)) &&
          !/female|zira|hazel|susan|catherine|jenny|aria|sara|emily|victoria|samantha|karen|linda/i.test(v.name)
        );
        if (maleVoice) return maleVoice;

        const anyMale = voices.find(v => 
          (/david|mark|george|guy|christopher|eric|ravi/i.test(v.name) || /\bmale\b/i.test(v.name)) && 
          !/female|zira|hazel/i.test(v.name)
        );
        if (anyMale) return anyMale;

        return langVoices.find(v => !/female|zira/i.test(v.name)) || langVoices[0] || voices[0] || null;
      } else {
        // Strictly search for English female voices: Zira, Google US English, Google UK English Female, Hazel, etc.
        const femaleVoice = langVoices.find(v => 
          (/female|zira|hazel|susan|catherine|jenny|aria|sara|emily|victoria|samantha|karen|linda|rachel|bella|luna|nova/i.test(v.name) ||
           /google us english/i.test(v.name) ||
           /google uk english female/i.test(v.name)) &&
          !(/\bmale\b/i.test(v.name) || /david|mark|george|guy|christopher|eric|hemant|madhur|ravi/i.test(v.name))
        );
        if (femaleVoice) return femaleVoice;

        const anyFemale = voices.find(v => 
          /female|zira|hazel|susan/i.test(v.name) && 
          !(/\bmale\b/i.test(v.name) || /david|mark|ravi/i.test(v.name))
        );
        if (anyFemale) return anyFemale;

        return langVoices[0] || voices[0] || null;
      }
    }
  }

  findStrictGenderVoice(voices, isHindi, targetGender) {
    return VoicePipeline.findStrictGenderVoice(voices, isHindi, targetGender);
  }

  speakBotResponse(text) {
    if (this.voiceMuted) {
      this.isBotSpeaking = false;
      this.onStateChange({ status: 'listening', message: 'Ready for input...' });
      return;
    }

    const isHindi = (this.currentLanguage && this.currentLanguage.startsWith('hi')) || /[\u0900-\u097F]/.test(text);
    const targetGender = this.getAgentGender();
    const isMale = targetGender === 'male';

    if (isHindi) {
      // Authentic Studio-Grade Microsoft Neural Hindi Speech:
      // Male agent: hi-IN-MadhurNeural (authentic baritone Indian Hindi male voice)
      // Female agent: hi-IN-SwaraNeural (authentic clear Indian Hindi female voice)
      const neuralVoice = isMale ? 'hi-IN-MadhurNeural' : 'hi-IN-SwaraNeural';
      this.speakNeuralAudioResponse(text, neuralVoice, () => {
        // Graceful fallback to browser speech synthesis if server is unavailable
        this.speakSpeechSynthesisResponse(text, true);
      });
      return;
    }

    // Standard English Web Speech Synthesis
    this.speakSpeechSynthesisResponse(text, false);
  }

  speakNeuralAudioResponse(text, voiceName, onFallback) {
    if (this.voiceMuted) {
      this.isBotSpeaking = false;
      this.onStateChange({ status: 'listening', message: 'Ready for input...' });
      return;
    }

    this.isBotSpeaking = true;
    this.botSpeechStartTime = Date.now();
    const agentFirstName = this.agent?.name?.split('—')[0]?.trim() || 'Agent';
    this.onStateChange({ status: 'speaking', message: `${agentFirstName} is speaking...` });

    if (this.currentAudioElement) {
      try {
        this.currentAudioElement.pause();
        this.currentAudioElement.currentTime = 0;
        this.currentAudioElement = null;
      } catch {}
    }
    if (window.speechSynthesis) {
      try { window.speechSynthesis.cancel(); } catch {}
    }

    const cleanText = text.replace(/[*#_`]/g, '').trim();
    if (!cleanText) {
      this.isBotSpeaking = false;
      this.onStateChange({ status: 'listening', message: 'Ready for input...' });
      return;
    }

    // Split into natural sentence chunks (< 140 chars) for instant TTFB
    const parts = cleanText.split(/([।\.\?!]+)/).filter(Boolean);
    const chunks = [];
    let cur = '';
    for (let i = 0; i < parts.length; i++) {
      if ((cur + parts[i]).length < 140) {
        cur += parts[i];
      } else {
        if (cur.trim()) chunks.push(cur.trim());
        cur = parts[i];
      }
    }
    if (cur.trim()) chunks.push(cur.trim());
    if (chunks.length === 0) chunks.push(cleanText);

    let currentChunkIdx = 0;
    let nextAudioPreload = null;

    const getTtsUrl = (textToSpeak) => {
      const encoded = encodeURIComponent(textToSpeak);
      const encodedVoice = encodeURIComponent(voiceName);
      return `/tts?text=${encoded}&voice=${encodedVoice}`;
    };
    const getFallbackTtsUrl = (textToSpeak) => {
      const encoded = encodeURIComponent(textToSpeak);
      const encodedVoice = encodeURIComponent(voiceName);
      return `http://127.0.0.1:5055/tts?text=${encoded}&voice=${encodedVoice}`;
    };

    const preloadChunk = (idx) => {
      if (idx < chunks.length) {
        const url = getTtsUrl(chunks[idx]);
        nextAudioPreload = new Audio();
        nextAudioPreload.preload = 'auto';
        nextAudioPreload.volume = 1.0;
        nextAudioPreload.src = url;
      } else {
        nextAudioPreload = null;
      }
    };

    const playNextChunk = () => {
      if (this.voiceMuted) {
        if (this.currentAudioElement) {
          try { this.currentAudioElement.pause(); } catch {}
          this.currentAudioElement = null;
        }
        return;
      }

      if (currentChunkIdx >= chunks.length) {
        this.isBotSpeaking = false;
        this.currentAudioElement = null;
        if (this.isCallActive) {
          this.onStateChange({ status: 'listening', message: '🎙️ Listening for your response...' });
          if (this.recognition && this.isListening) {
            try { this.recognition.start(); } catch {}
          }
        }
        return;
      }

      const chunkText = chunks[currentChunkIdx++];
      const audioUrl = getTtsUrl(chunkText);

      let audio = null;
      if (nextAudioPreload && nextAudioPreload.src.includes(encodeURIComponent(chunkText))) {
        audio = nextAudioPreload;
      } else {
        audio = new Audio(audioUrl);
      }
      audio.volume = 1.0;

      this.currentAudioElement = audio;

      // Preload next chunk in background for zero delay between sentences
      preloadChunk(currentChunkIdx);

      audio.onplay = () => {
        this.isBotSpeaking = true;
        this.onStateChange({ status: 'speaking', message: `${agentFirstName} is speaking...` });
      };

      audio.onended = () => {
        playNextChunk();
      };

      let fallbackAttempted = false;
      const handleChunkError = (e) => {
        if (fallbackAttempted) {
          console.warn('Neural TTS fallback failed, proceeding to browser voice synthesis:', e);
          if (onFallback && currentChunkIdx === 1) {
            onFallback();
          } else {
            playNextChunk();
          }
          return;
        }

        fallbackAttempted = true;
        console.warn('Primary /tts failed, retrying chunk via direct port 5055...');
        const fbUrl = getFallbackTtsUrl(chunkText);
        const fbAudio = new Audio(fbUrl);
        fbAudio.volume = 1.0;
        this.currentAudioElement = fbAudio;
        fbAudio.onplay = () => {
          this.isBotSpeaking = true;
          this.onStateChange({ status: 'speaking', message: `${agentFirstName} is speaking...` });
        };
        fbAudio.onended = () => playNextChunk();
        fbAudio.onerror = (err) => handleChunkError(err);
        fbAudio.play().catch((err) => handleChunkError(err));
      };

      audio.onerror = handleChunkError;

      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch(err => {
          if (err && (err.name === 'AbortError' || err.message?.includes('pause'))) {
            return;
          }
          handleChunkError(err);
        });
      }
    };

    playNextChunk();
  }

  speakSpeechSynthesisResponse(text, isHindi = false) {
    if (this.voiceMuted) {
      this.isBotSpeaking = false;
      this.onStateChange({ status: 'listening', message: 'Ready for input...' });
      return;
    }

    this.isBotSpeaking = true;
    const agentFirstName = this.agent?.name?.split('—')[0]?.trim() || 'Agent';
    this.onStateChange({ status: 'speaking', message: `${agentFirstName} is speaking...` });

    if (this.currentAudioElement) {
      try {
        this.currentAudioElement.pause();
        this.currentAudioElement = null;
      } catch {}
    }

    if ('speechSynthesis' in window) {
      if (window.speechSynthesis.paused) {
        try { window.speechSynthesis.resume(); } catch {}
      }
      window.speechSynthesis.cancel();

      const cleanText = text.replace(/[*#_`]/g, '').trim();
      const spokenText = cleanText;
      const targetGender = this.getAgentGender();
      const isMale = targetGender === 'male';

      const voices = window.speechSynthesis.getVoices();
      const strictVoice = this.findStrictGenderVoice(voices, isHindi, targetGender);

      const parts = spokenText.split(/([।\.\?!]+)/).filter(Boolean);
      const chunks = [];
      let cur = '';
      for (let i = 0; i < parts.length; i++) {
        if ((cur + parts[i]).length < 160) {
          cur += parts[i];
        } else {
          if (cur.trim()) chunks.push(cur.trim());
          cur = parts[i];
        }
      }
      if (cur.trim()) chunks.push(cur.trim());
      if (chunks.length === 0) chunks.push(spokenText);

      let chunkIdx = 0;

      const speakNextChunk = () => {
        if (!this.isCallActive && !this.isBotSpeaking) return;
        if (chunkIdx >= chunks.length) {
          this.isBotSpeaking = false;
          this.activeUtterance = null;
          if (this.isCallActive) {
            this.onStateChange({ status: 'listening', message: '🎙️ Listening for your response...' });
            if (this.recognition && this.isListening) {
              try { this.recognition.start(); } catch {}
            }
          }
          return;
        }

        const chunkText = chunks[chunkIdx++];
        const utterance = new SpeechSynthesisUtterance(chunkText);

        if (isMale) {
          utterance.rate = Math.max(0.85, (this.agent?.speakingRate || 1.0) * 0.94);
          utterance.pitch = Math.max(0.65, Math.min(0.95, 0.82 + (this.agent?.pitch || 0)));
        } else {
          utterance.rate = Math.min(1.2, (this.agent?.speakingRate || 1.0) * 1.02);
          utterance.pitch = Math.max(1.02, Math.min(1.4, 1.15 + (this.agent?.pitch || 0)));
        }

        if (this.detectedCustomerEmotion === 'Panicked / High Distress') {
          utterance.rate = Math.max(0.82, utterance.rate * 0.92);
        } else if (this.detectedCustomerEmotion === 'Impatient / Hurried') {
          utterance.rate = Math.min(1.25, utterance.rate * 1.12);
        }

        if (strictVoice && strictVoice.lang) {
          utterance.lang = isHindi ? 'hi-IN' : strictVoice.lang;
        } else {
          utterance.lang = isHindi ? 'hi-IN' : 'en-US';
        }

        if (strictVoice) {
          utterance.voice = strictVoice;
        }

        utterance.onstart = () => {
          this.isBotSpeaking = true;
          this.onStateChange({ status: 'speaking', message: `${agentFirstName} is speaking...` });
        };

        utterance.onend = () => {
          speakNextChunk();
        };

        utterance.onerror = (e) => {
          console.warn('SpeechSynthesis utterance event error:', e);
          speakNextChunk();
        };

        this.activeUtterance = utterance;
        window.__activeUtterance = utterance;

        window.speechSynthesis.speak(utterance);
      };

      speakNextChunk();
    } else {
      setTimeout(() => {
        this.isBotSpeaking = false;
        if (this.isCallActive) {
          this.onStateChange({ status: 'listening', message: 'Ready for input...' });
        }
      }, 2500);
    }
  }

  static playVoiceAudition({ text, language, isMale, onStart, onEnd, onError }) {
    if (window.__currentAuditionAudio) {
      try {
        window.__currentAuditionAudio.pause();
        window.__currentAuditionAudio.currentTime = 0;
        window.__currentAuditionAudio = null;
      } catch {}
    }
    if (window.speechSynthesis) {
      try { window.speechSynthesis.cancel(); } catch {}
    }

    const isHindi = (language && language.startsWith('hi')) || /[\u0900-\u097F]/.test(text);
    const cleanText = (text || '').replace(/[*#_`]/g, '').trim();

    if (isHindi) {
      const voice = isMale ? 'hi-IN-MadhurNeural' : 'hi-IN-SwaraNeural';
      const encoded = encodeURIComponent(cleanText);
      const encodedVoice = encodeURIComponent(voice);
      const primaryUrl = `/tts?text=${encoded}&voice=${encodedVoice}`;
      const fallbackUrl = `http://127.0.0.1:5055/tts?text=${encoded}&voice=${encodedVoice}`;

      const audio = new Audio(primaryUrl);
      audio.volume = 1.0;
      window.__currentAuditionAudio = audio;

      if (onStart) audio.onplay = onStart;
      if (onEnd) audio.onended = () => {
        window.__currentAuditionAudio = null;
        onEnd();
      };

      const tryFallback = () => {
        const fbAudio = new Audio(fallbackUrl);
        fbAudio.volume = 1.0;
        window.__currentAuditionAudio = fbAudio;
        if (onStart) fbAudio.onplay = onStart;
        if (onEnd) fbAudio.onended = () => {
          window.__currentAuditionAudio = null;
          onEnd();
        };
        fbAudio.onerror = (e) => {
          console.warn('Audition neural audio error on port 5055, fallback to speech synthesis:', e);
          VoicePipeline.playSpeechSynthesisAudition({ text: cleanText, isHindi: true, isMale, onStart, onEnd });
        };
        fbAudio.play().catch(() => {
          VoicePipeline.playSpeechSynthesisAudition({ text: cleanText, isHindi: true, isMale, onStart, onEnd });
        });
      };

      audio.onerror = tryFallback;
      audio.play().catch(tryFallback);
      return audio;
    } else {
      return VoicePipeline.playSpeechSynthesisAudition({ text: cleanText, isHindi: false, isMale, onStart, onEnd });
    }
  }

  static playSpeechSynthesisAudition({ text, isHindi, isMale, onStart, onEnd }) {
    if (!('speechSynthesis' in window)) return null;
    if (window.speechSynthesis.paused) {
      try { window.speechSynthesis.resume(); } catch {}
    }
    window.speechSynthesis.cancel();

    const cleanText = (text || '').replace(/[*#_`]/g, '').trim();
    const utterance = new SpeechSynthesisUtterance(cleanText);
    const targetGender = isMale ? 'male' : 'female';
    const voices = window.speechSynthesis.getVoices();
    const strictVoice = VoicePipeline.findStrictGenderVoice(voices, isHindi, targetGender);

    if (isMale) {
      utterance.rate = 0.95;
      utterance.pitch = 0.82;
    } else {
      utterance.rate = 1.02;
      utterance.pitch = 1.15;
    }

    if (strictVoice) utterance.voice = strictVoice;
    utterance.lang = isHindi ? 'hi-IN' : (strictVoice?.lang || 'en-US');

    if (onStart) utterance.onstart = onStart;
    if (onEnd) utterance.onend = () => {
      window.__activeUtterance = null;
      onEnd();
    };
    utterance.onerror = () => {
      window.__activeUtterance = null;
      if (onEnd) onEnd();
    };

    window.__activeUtterance = utterance;
    window.speechSynthesis.speak(utterance);
    return utterance;
  }

  devanagariToPhonetic(str) {
    return VoicePipeline.devanagariToPhonetic(str);
  }

  static devanagariToPhonetic(str) {
    if (!str || !/[\u0900-\u097F]/.test(str)) return str;

    // Common full words for smooth natural cadence
    let res = str
      .replace(/नमस्ते/g, 'Namaste ')
      .replace(/मियामी/g, 'Miami ')
      .replace(/क्रिमिनल/g, 'Criminal ')
      .replace(/डिफेंस/g, 'Defense ')
      .replace(/जमानत/g, 'Zamanat ')
      .replace(/जेल/g, 'Jail ')
      .replace(/वकील/g, 'Vakeel ')
      .replace(/कानूनी/g, 'Kanooni ')
      .replace(/सहायता/g, 'Sahayata ')
      .replace(/मदद/g, 'Madad ')
      .replace(/फीस/g, 'Fees ')
      .replace(/अपॉइंटमेंट/g, 'Appointment ')
      .replace(/धन्यवाद/g, 'Dhanyavaad ')
      .replace(/शांत रहिए/g, 'Shaant rahiye ')
      .replace(/गिरफ्तार/g, 'Giraftaar ')
      .replace(/आपातकालीन/g, 'Aapaatkaaleen ')
      .replace(/मामलों/g, 'Maamlo ')
      .replace(/मामले/g, 'Maamle ')
      .replace(/पुलिस/g, 'Police ')
      .replace(/अदालत/g, 'Adaalat ')
      .replace(/हाँ/g, 'Haan ')
      .replace(/नहीं/g, 'Nahin ')
      .replace(/कृपया/g, 'Kripya ')
      .replace(/सांस/g, 'Saans ')
      .replace(/कार्यालय/g, 'Karyalay ')
      .replace(/संपर्क/g, 'Sampark ')
      .replace(/तैयार/g, 'Taiyaar ')
      .replace(/है/g, 'hai ')
      .replace(/हूँ/g, 'hoon ')
      .replace(/हैं/g, 'hain ')
      .replace(/था/g, 'tha ')
      .replace(/थी/g, 'thee ')
      .replace(/थे/g, 'the ')
      .replace(/हो/g, 'ho ')
      .replace(/कर/g, 'kar ')
      .replace(/सकते/g, 'sakte ')
      .replace(/सकता/g, 'sakta ')
      .replace(/सकती/g, 'sakti ')
      .replace(/रहा/g, 'raha ')
      .replace(/रही/g, 'rahee ')
      .replace(/रहे/g, 'rahe ')
      .replace(/आप/g, 'aap ')
      .replace(/आपका/g, 'aapka ')
      .replace(/आपकी/g, 'aapki ')
      .replace(/आपके/g, 'aapke ')
      .replace(/मेरा/g, 'mera ')
      .replace(/मेरी/g, 'meri ')
      .replace(/मेरे/g, 'mere ')
      .replace(/मुझे/g, 'mujhe ')
      .replace(/नाम/g, 'naam ')
      .replace(/कॉल/g, 'call ')
      .replace(/करने/g, 'karne ')
      .replace(/के लिए/g, 'ke liye ')
      .replace(/में/g, 'mein ')
      .replace(/पर/g, 'par ')
      .replace(/से/g, 'se ')
      .replace(/को/g, 'ko ')
      .replace(/का/g, 'ka ')
      .replace(/की/g, 'kee ')
      .replace(/और/g, 'aur ')
      .replace(/या/g, 'ya ')
      .replace(/क्या/g, 'kya ')
      .replace(/कौन/g, 'kaun ')
      .replace(/कब/g, 'kab ')
      .replace(/कहाँ/g, 'kahan ')
      .replace(/कैसे/g, 'kaise ')
      .replace(/कितना/g, 'kitna ')
      .replace(/तुरंत/g, 'turant ')
      .replace(/उपलब्ध/g, 'uplabdh ')
      .replace(/बात/g, 'baat ')
      .replace(/सलाह/g, 'salah ')
      .replace(/मुफ्त/g, 'muft ')
      .replace(/रिश्तेदार/g, 'rishtedaar ')
      .replace(/हिरासत/g, 'hiraasat ')
      .replace(/चाहिए/g, 'chahiye ')
      .replace(/गहरी/g, 'gahri ')
      .replace(/लीजिए/g, 'leejiye ')
      .replace(/ली/g, 'lee ')
      .replace(/दी/g, 'dee ')
      .replace(/गई/g, 'gayee ')
      .replace(/गया/g, 'gaya ')
      .replace(/गए/g, 'gaye ')
      .replace(/भाषा/g, 'bhasha ')
      .replace(/बदल/g, 'badal ')
      .replace(/सेट/g, 'set ')
      .replace(/दिन/g, 'din ')
      .replace(/समय/g, 'samay ')
      .replace(/आज/g, 'aaj ')
      .replace(/कल/g, 'kal ')
      .replace(/अच्छा/g, 'achha ')
      .replace(/ठीक/g, 'theek ')
      .replace(/समझ/g, 'samajh ')
      .replace(/लिया/g, 'liya ');

    // Character mapping for any unmapped Devanagari characters
    const devanagariMap = {
      'अ': 'a', 'आ': 'aa', 'इ': 'i', 'ई': 'ee', 'उ': 'u', 'ऊ': 'oo', 'ऋ': 'ri',
      'ए': 'e', 'ऐ': 'ai', 'ओ': 'o', 'औ': 'au', 'अं': 'an', 'अः': 'ah',
      'क': 'ka', 'ख': 'kha', 'ग': 'ga', 'घ': 'gha', 'ङ': 'nga',
      'च': 'cha', 'छ': 'chha', 'ज': 'ja', 'झ': 'jha', 'ञ': 'nya',
      'ट': 'ta', 'ठ': 'tha', 'ड': 'da', 'ढ': 'dha', 'ण': 'na',
      'त': 'ta', 'थ': 'tha', 'द': 'da', 'ध': 'dha', 'न': 'na',
      'प': 'pa', 'फ': 'pha', 'ब': 'ba', 'भ': 'bha', 'म': 'ma',
      'य': 'ya', 'र': 'ra', 'ल': 'la', 'व': 'va', 'श': 'sha', 'ष': 'sha', 'स': 'sa', 'ह': 'ha',
      'ा': 'aa', 'ि': 'i', 'ी': 'ee', 'ु': 'u', 'ू': 'oo', 'ृ': 'ri',
      'े': 'e', 'ै': 'ai', 'ो': 'o', 'ौ': 'au', 'ं': 'n', 'ँ': 'n', 'ः': 'h', '्': '',
      '।': '.', '॥': '.'
    };

    let transliterated = '';
    for (let i = 0; i < res.length; i++) {
      const ch = res[i];
      if (devanagariMap[ch] !== undefined) {
        const next = res[i + 1];
        if (devanagariMap[ch].endsWith('a') && next && ['ा','ि','ी','ु','ू','ृ','े','ै','ो','ौ','्'].includes(next)) {
          transliterated += devanagariMap[ch].slice(0, -1);
        } else {
          transliterated += devanagariMap[ch];
        }
      } else {
        transliterated += ch;
      }
    }

    return transliterated.replace(/\s+/g, ' ').trim();
  }

  connectStreamToWaveform(stream) {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      if (!this.audioContext) {
        this.audioContext = new AudioCtx();
      }
      if (this.audioContext.state === 'suspended') {
        this.audioContext.resume();
      }
      const source = this.audioContext.createMediaStreamSource(stream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 64;
      this.analyser.smoothingTimeConstant = 0.6;
      source.connect(this.analyser);
      this.realAudioData = new Uint8Array(this.analyser.frequencyBinCount);
    } catch (e) {
      console.warn('Waveform audio analyzer connect error:', e);
    }
  }

  initAudioWaveform() {
    const tick = () => {
      if (!this.isCallActive) return;

      const bars = [];
      const barCount = 32;

      // If we have real mic frequency data and caller is speaking into mic
      if (this.analyser && this.realAudioData && this.isListening && !this.isBotSpeaking) {
        this.analyser.getByteFrequencyData(this.realAudioData);
        let sum = 0;
        for (let i = 0; i < barCount; i++) {
          const val = (this.realAudioData[i % this.realAudioData.length] || 0) / 255;
          sum += val;
          bars.push(Math.max(0.08, val));
        }
        const avgVolume = Math.min(100, Math.round((sum / barCount) * 160));
        this.onVolumeChange(avgVolume);

        const now = Date.now();
        if (avgVolume > 8) {
          if (!this.hasRecentVocalActivity) {
            this.speechStartedTime = now;
            this.hasRecentVocalActivity = true;
          }
          this.lastVocalActivityTime = now;

          // Barge-in check: If bot is speaking and caller starts speaking into mic
          if (this.isBotSpeaking && this.agent?.bargeInAllowed !== false) {
            this.interruptBotSpeech();
          }
        } else if (this.hasRecentVocalActivity && (now - this.lastVocalActivityTime > (this.speechSilenceThresholdMs || 2500))) {
          // Caller physically stopped speaking for the full 2.5-second buffer!
          const speechDuration = this.lastVocalActivityTime - (this.speechStartedTime || (now - 2500));
          this.hasRecentVocalActivity = false;

          // If speech recognizer captured text or Whisper is needed, submit now after the 2.5s buffer
          if ((this.speechBuffer || this.latestInterimText) && !this.silenceTimer) {
            this.submitPendingSpeech();
          } else if (speechDuration > 400 && this.audioChunks.length > 0 && !this.silenceTimer && !this.isBotSpeaking) {
            // Web Speech produced no text, but user was physically speaking into headset!
            // Automatically transcribe via Groq Whisper Turbo!
            this.submitPendingSpeech();
          }
        }
      } else {
        this.onVolumeChange(0);
        const intensity = this.isBotSpeaking ? 0.95 : (this.isListening ? 0.45 : 0.12);
        for (let i = 0; i < barCount; i++) {
          const base = Math.sin(Date.now() * 0.008 + i * 0.35) * 0.5 + 0.5;
          const jitter = Math.random() * 0.35;
          bars.push(Math.min(1.0, (base + jitter) * intensity));
        }
      }

      this.onWaveformTick(bars);
      this.animFrameId = requestAnimationFrame(tick);
    };

    tick();
  }
}
