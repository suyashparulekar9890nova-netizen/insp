import { storage } from '../services/storage.js';
import { VoicePipeline } from '../services/voicePipeline.js';
import { LLMService } from '../services/llmService.js';
import { Toast } from './Toast.js';

export class LiveCallModal {
  constructor(options = {}) {
    this.container = null;
    this.pipeline = null;
    this.agent = null;
    this.onCallEnded = options.onCallEnded || (() => { });
    this.onOpenApiKeyModal = options.onOpenApiKeyModal || (() => { });

    // Portal state
    this.currentMode = 'split'; // 'call', 'chat', 'split'
    this.voiceMuted = false;
    this.isListening = false;
    this.interimSpeechText = '';
    this.apiError = null;
    this.selectedLanguage = options.language || 'en-US';
  }

  open(agent = null, customOptions = {}) {
    const agents = storage.getAgents();
    this.agent = agent || agents[0];
    const isHindiAgent = (this.agent?.language && this.agent.language.startsWith('hi')) || 
      /swara|madhur|hindi/i.test(this.agent?.voiceName || '') || 
      /[\u0900-\u097F]/.test(this.agent?.greeting || '');
    this.selectedLanguage = customOptions.language || (isHindiAgent ? 'hi-IN' : (this.agent?.language || 'en-US'));
    this.initialCustomGreeting = customOptions.initialGreeting || (isHindiAgent && (!this.agent?.greeting || this.agent.greeting.startsWith('Hello') || !/[\u0900-\u097F]/.test(this.agent.greeting))
      ? `नमस्ते! डेंटलकेयर प्लस क्लिनिक में आपका स्वागत है। मेरा नाम ${this.agent?.name?.split('—')[0]?.trim() || 'Maya'} है। क्या आप नया अपॉइंटमेंट बुक करना चाहते हैं या कोई सहायता चाहिए?`
      : (this.agent?.greeting || null));

    if (!this.container) {
      this.container = document.createElement('div');
      this.container.id = 'live-call-modal-root';
      document.body.appendChild(this.container);
    }

    this.render();
    this.initPipeline();
  }

  render() {
    const basePersonality = this.agent?.ownerContext?.basePersonality || this.agent?.tone || 'Empathetic & Calming Guardian';
    const llmConfig = LLMService.getConfig();
    const hasKey = LLMService.hasActiveApiKey();

    this.container.innerHTML = `
      <div class="call-modal-overlay open" id="live-call-backdrop">
        <div class="call-modal-content" style="width: 1060px; max-width: 96vw; max-height: 92vh;">
          <!-- Call Modal Header -->
          <div class="call-modal-header" style="padding: 0.9rem 1.4rem;">
            <div class="call-agent-info">
              <div class="call-avatar" style="font-size: 1.6rem; width: 44px; height: 44px;">${this.agent.avatar || '🤖'}</div>
              <div>
                <div style="display: flex; align-items: center; gap: 0.6rem;">
                  <span style="font-weight: 800; font-size: 1.05rem; color: var(--text-main);">${this.agent.name}</span>
                  <span class="badge-status success" style="font-size: 0.68rem; padding: 0.1rem 0.45rem;">LIVE CONNECTED</span>
                </div>
                <div style="font-size: 0.72rem; color: var(--text-muted);">
                  Persona: <strong style="color: var(--cyan-400);">${basePersonality}</strong> • Voice: <strong>${this.agent.voiceName}</strong>
                </div>
              </div>
            </div>

            <!-- Mode Switcher Tabs (Chat vs Call vs Split) -->
            <div class="portal-mode-tabs" id="portal-mode-tabs">
              <button class="portal-mode-tab ${this.currentMode === 'call' ? 'active' : ''}" data-mode="call">
                <span>📞</span>
                <span>Voice Call</span>
              </button>
              <button class="portal-mode-tab ${this.currentMode === 'chat' ? 'active' : ''}" data-mode="chat">
                <span>💬</span>
                <span>Live Chat</span>
              </button>
              <button class="portal-mode-tab ${this.currentMode === 'split' ? 'active' : ''}" data-mode="split">
                <span>🔀</span>
                <span>Call + Chat</span>
              </button>
            </div>

            <!-- Controls (Voice Toggle, Timer, End) -->
            <div style="display: flex; align-items: center; gap: 0.65rem;">
              <button class="voice-mute-toggle ${this.voiceMuted ? 'muted' : 'active'}" id="btn-toggle-voice-output" title="Toggle audio speech output">
                <span>${this.voiceMuted ? '🔇' : '🔊'}</span>
                <span id="txt-voice-toggle-label">${this.voiceMuted ? 'Voice Muted' : 'Voice Speaking'}</span>
              </button>

              <div class="call-timer-badge" id="call-timer-display" style="padding: 0.25rem 0.65rem; font-size: 0.88rem;">00:00</div>

              <button class="btn-danger" id="btn-hangup-call" style="padding: 0.35rem 0.8rem; font-size: 0.8rem;">
                <span>🔴</span>
                <span>End Call</span>
              </button>
            </div>
          </div>

          <!-- Spontaneous AI Engine Status Banner -->
          <div id="ai-engine-banner" style="background: ${this.apiError ? 'rgba(245, 158, 11, 0.15)' : (hasKey ? 'rgba(16, 185, 129, 0.12)' : 'rgba(6, 182, 212, 0.12)')}; border-bottom: 1px solid ${this.apiError ? 'rgba(245, 158, 11, 0.3)' : (hasKey ? 'rgba(16, 185, 129, 0.3)' : 'rgba(6, 182, 212, 0.3)')}; padding: 0.4rem 1.4rem; display: flex; justify-content: space-between; align-items: center; font-size: 0.76rem;">
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <span>${this.apiError ? '⚠️' : (hasKey ? '🟢' : '⚡')}</span>
              <span id="ai-status-text" style="color: ${this.apiError ? 'var(--amber-400)' : (hasKey ? 'var(--emerald-400)' : 'var(--cyan-400)')}; font-weight: 600;">
                ${this.apiError ? `Cloud API Notice: ${this.apiError} → Smart Autonomous AI Engine Active` : (hasKey ? `Spontaneous AI Engine Active: ${llmConfig.provider.toUpperCase()} (${llmConfig.model})` : 'Smart Autonomous AI Engine Active (Zero-Key Intelligent Mode)')}
              </span>
            </div>
            <button class="btn-secondary" id="btn-call-manage-api-key" style="font-size: 0.7rem; padding: 0.15rem 0.55rem;">
              🔑 API Key Settings
            </button>
          </div>

          <!-- Sandbox Split Body -->
          <div class="call-sandbox-body" id="sandbox-body-layout" style="display: grid; grid-template-columns: ${this.currentMode === 'call' ? '1fr 340px' : (this.currentMode === 'chat' ? '1fr 300px' : '1.15fr 360px')}; flex: 1; overflow: hidden; min-height: 480px;">
            
            <!-- Left Pane: Unified Conversation Stream & Real-time Messaging -->
            <div style="display: flex; flex-direction: column; height: 100%; border-right: 1px solid var(--border-subtle); background: #0b111e; overflow: hidden;">
              
              <!-- Call & Listening Bar (Prominent in Call and Split Modes) -->
              <div id="live-voice-control-bar" style="background: rgba(15, 23, 42, 0.85); border-bottom: 1px solid var(--border-subtle); padding: 0.75rem 1.25rem; display: ${this.currentMode === 'chat' ? 'none' : 'block'};">
                <div style="display: flex; gap: 0.75rem; align-items: center;">
                  <!-- Main Mic Talk Button -->
                  <button class="voice-talk-btn ${this.isListening ? 'listening' : ''}" id="btn-main-mic-talk" style="flex: 1;">
                    <span style="font-size: 1.2rem;">${this.isListening ? '🔴' : '🎙️'}</span>
                    <span id="txt-mic-talk-label">${this.isListening ? 'Listening to your voice... Speak now!' : 'Click to Speak (Microphone)'}</span>
                  </button>

                  <button class="btn-secondary" id="btn-test-bargein" style="padding: 0.8rem 0.9rem; font-size: 0.78rem; border-color: rgba(99, 102, 241, 0.4); color: var(--cyan-400);" title="Interrupt bot while speaking">
                    ⚡ Barge-In
                  </button>
                </div>

                <!-- Live Interim Speech Preview (Agent listens to what caller speaks) -->
                <div class="interim-speech-preview" id="interim-speech-box" style="display: none; margin-top: 0.6rem; align-items: center; justify-content: space-between; gap: 0.75rem;">
                  <div style="display: flex; align-items: center; gap: 0.4rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1;">
                    <span>🎙️ Hearing:</span>
                    <span id="interim-speech-text" style="font-weight: 600; color: #fff;"></span>
                  </div>
                  <button type="button" class="btn-primary" id="btn-submit-interim-voice" style="padding: 0.2rem 0.65rem; font-size: 0.72rem; white-space: nowrap; border-radius: 4px;">
                    Send Now ↵
                  </button>
                </div>

                <!-- Mic Device Selector, Language Switcher & Live Volume Level Meter -->
                <div style="display: flex; align-items: center; justify-content: space-between; gap: 0.65rem; margin-top: 0.55rem; padding-top: 0.45rem; border-top: 1px solid rgba(255, 255, 255, 0.07); font-size: 0.72rem; color: var(--text-muted); flex-wrap: wrap;">
                  <div style="display: flex; align-items: center; gap: 0.4rem; flex: 1; min-width: 160px;">
                    <span>🎧 Mic:</span>
                    <select id="select-audio-device" class="form-select" style="padding: 0.15rem 0.4rem; font-size: 0.7rem; flex: 1; max-width: 175px; height: auto; background: rgba(0,0,0,0.3); border-color: rgba(255,255,255,0.15); color: #fff;">
                      <option value="">Default Microphone</option>
                    </select>
                  </div>

                  <!-- Bilingual Language Opt Buttons (English vs Hindi) -->
                  <div style="display: flex; align-items: center; gap: 0.35rem; background: rgba(0,0,0,0.45); padding: 0.2rem 0.4rem; border-radius: 6px; border: 1px solid rgba(255,255,255,0.12);">
                    <span style="font-size: 0.75rem;" title="Select Caller Language">🌐</span>
                    <button type="button" class="lang-opt-btn" id="btn-lang-en" data-lang="en-US" style="background: ${this.selectedLanguage !== 'hi-IN' ? 'var(--indigo-600)' : 'transparent'}; border: 1px solid ${this.selectedLanguage !== 'hi-IN' ? 'var(--indigo-400)' : 'transparent'}; color: #fff; padding: 0.16rem 0.5rem; font-size: 0.69rem; font-weight: 700; border-radius: 4px; cursor: pointer; transition: all 0.2s ease;">
                      🇬🇧 English
                    </button>
                    <button type="button" class="lang-opt-btn" id="btn-lang-hi" data-lang="hi-IN" style="background: ${this.selectedLanguage === 'hi-IN' ? 'linear-gradient(135deg, #ea580c, #16a34a)' : 'transparent'}; border: 1px solid ${this.selectedLanguage === 'hi-IN' ? '#f59e0b' : 'transparent'}; color: #fff; padding: 0.16rem 0.5rem; font-size: 0.69rem; font-weight: 700; border-radius: 4px; cursor: pointer; transition: all 0.2s ease;">
                      🇮🇳 हिंदी (Hindi)
                    </button>
                  </div>

                  <div style="display: flex; align-items: center; gap: 0.4rem;">
                    <span>Level:</span>
                    <div style="width: 55px; height: 7px; background: rgba(255,255,255,0.12); border-radius: 4px; overflow: hidden; position: relative;">
                      <div id="mic-volume-level-bar" style="width: 0%; height: 100%; background: linear-gradient(90deg, #10b981, #06b6d4, #f59e0b); transition: width 0.05s ease;"></div>
                    </div>
                    <span id="mic-volume-level-text" style="font-family: var(--font-mono); font-size: 0.68rem; min-width: 24px; color: var(--emerald-400);">0%</span>
                  </div>
                </div>
              </div>

              <!-- Diarized Chat Transcript -->
              <div class="transcript-pane" id="live-transcript-stream" style="flex: 1; overflow-y: auto; padding: 1.25rem; border-right: none;">
                <!-- Bubbles will appear here dynamically -->
              </div>

              <!-- Typing / Reasoning Indicator -->
              <div id="chat-typing-box" style="display: none; padding: 0 1.25rem;">
                <div class="chat-typing-indicator">
                  <span>${this.agent.name} is reasoning</span>
                  <span class="chat-typing-dot"></span>
                  <span class="chat-typing-dot"></span>
                  <span class="chat-typing-dot"></span>
                </div>
              </div>

              <!-- Bottom Chat Input Bar -->
              <div style="background: #0f1626; border-top: 1px solid var(--border-medium); padding: 0.85rem 1.25rem;">
                <div style="display: flex; gap: 0.5rem; align-items: center;">
                  <button class="btn-secondary" id="btn-chat-mic" style="padding: 0.5rem 0.75rem; font-size: 1rem; border-radius: var(--radius-md);" title="Click to speak via microphone">
                    🎙️
                  </button>
                  <input type="text" class="form-input" id="call-custom-text-input" placeholder="${this.selectedLanguage === 'hi-IN' ? 'हिंदी में संदेश या प्रश्न टाइप करें...' : `Type a message, question, or query for ${this.agent.name}...`}" style="font-size: 0.82rem; padding: 0.55rem 0.85rem; flex: 1;" />
                  <button class="btn-primary" id="btn-send-custom-text" style="padding: 0.55rem 1.1rem; font-size: 0.84rem; font-weight: 700;">
                    Send
                  </button>
                </div>

                <!-- Dynamic Language-Aware Query Test Chips Container -->
                <div id="prompt-chips-container" style="display: flex; gap: 0.4rem; margin-top: 0.55rem; overflow-x: auto; padding-bottom: 2px;"></div>
              </div>
            </div>

            <!-- Right Pane: Oscilloscope, Adaptive Persona HUD & Telemetry -->
            <div class="controls-telemetry-pane" style="background: var(--bg-card); padding: 1.25rem; display: flex; flex-direction: column; gap: 1.1rem; overflow-y: auto;">
              
              <!-- Audio Waveform Visualizer -->
              <div class="waveform-container">
                <canvas class="waveform-canvas" id="audio-waveform-canvas" width="300" height="55"></canvas>
                <div class="pipeline-status-text" id="pipeline-status-badge">
                  Connecting carrier audio stream...
                </div>
              </div>

              <!-- Real-Time Adaptive Dynamic Persona HUD -->
              <div style="background: var(--bg-darkest); border: 1px solid rgba(99, 102, 241, 0.4); border-radius: var(--radius-md); padding: 0.85rem; box-shadow: 0 4px 15px rgba(0,0,0,0.5);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.45rem;">
                  <span style="font-size: 0.74rem; font-weight: 700; text-transform: uppercase; color: var(--cyan-400); display: flex; align-items: center; gap: 0.35rem;">
                    <span>🧠</span>
                    <span>Adaptive Persona Engine</span>
                  </span>
                  <span class="badge-status success" style="font-size: 0.65rem; padding: 0.1rem 0.4rem;">LIVE MIRRORING</span>
                </div>

                <div style="font-size: 0.75rem; margin-bottom: 0.4rem;">
                  <span style="color: var(--text-dim);">Customer Vibe Detected:</span>
                  <strong style="color: var(--amber-400); margin-left: 4px;" id="hud-customer-emotion">Neutral / Balanced</strong>
                </div>

                <div style="font-size: 0.75rem; margin-bottom: 0.4rem;">
                  <span style="color: var(--text-dim);">Adapted Behavior Tone:</span>
                  <strong style="color: var(--emerald-400); margin-left: 4px;" id="hud-adapted-tone">Base Persona Active</strong>
                </div>

                <!-- Customer Stress / Urgency Bar -->
                <div>
                  <div style="display: flex; justify-content: space-between; font-size: 0.68rem; color: var(--text-dim); margin-bottom: 0.2rem;">
                    <span>Caller Stress / Urgency Level</span>
                    <span id="hud-stress-val" style="font-family: var(--font-mono); color: var(--cyan-400);">20%</span>
                  </div>
                  <div style="width: 100%; height: 5px; background: var(--bg-elevated); border-radius: 3px; overflow: hidden;">
                    <div id="hud-stress-bar" style="width: 20%; height: 100%; background: linear-gradient(90deg, var(--emerald-500), var(--amber-400)); transition: width 0.3s ease;"></div>
                  </div>
                </div>
              </div>

              <!-- Live Telemetry Card -->
              <div class="telemetry-card">
                <div class="telemetry-header">
                  <span>Ultra-Low Latency Telemetry</span>
                  <span style="color: var(--cyan-400); font-family: var(--font-mono);" id="telem-total-latency">360ms</span>
                </div>
                <div class="latency-row">
                  <span>Voice STT Listening</span>
                  <span id="telem-stt">88ms</span>
                </div>
                <div class="latency-row">
                  <span>LLM / Local Reasoning (TTFT)</span>
                  <span id="telem-llm">154ms</span>
                </div>
                <div class="latency-row">
                  <span>TTS Audio Stream TTFB</span>
                  <span id="telem-tts">118ms</span>
                </div>
              </div>

              <!-- Human Handoff Whisper Card -->
              <div id="live-handoff-whisper-box" style="display: none;" class="whisper-brief-card">
                <div class="whisper-title">
                  <span>👥</span>
                  <span>Live Human Handoff Bridged!</span>
                </div>
                <div style="font-size: 0.75rem; color: var(--text-light); line-height: 1.4;">
                  <strong>Operator Number:</strong> ${storage.getActiveWorkspace().humanHandoffNumber || '+1 (800) 555-0192'}<br/>
                  <div style="background: rgba(0,0,0,0.3); padding: 0.45rem; border-radius: 4px; margin-top: 0.35rem; font-style: italic; color: #fff;" id="live-whisper-text">
                    Transferring call with AI briefing packet.
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    `;

    this.attachEvents();
  }

  initPipeline() {
    const transcriptPane = this.container.querySelector('#live-transcript-stream');
    const timerDisplay = this.container.querySelector('#call-timer-display');
    const statusBadge = this.container.querySelector('#pipeline-status-badge');
    const canvas = this.container.querySelector('#audio-waveform-canvas');
    const ctx = canvas.getContext('2d');

    const handoffBox = this.container.querySelector('#live-handoff-whisper-box');
    const whisperText = this.container.querySelector('#live-whisper-text');

    const hudEmotion = this.container.querySelector('#hud-customer-emotion');
    const hudAdaptedTone = this.container.querySelector('#hud-adapted-tone');
    const hudStressVal = this.container.querySelector('#hud-stress-val');
    const hudStressBar = this.container.querySelector('#hud-stress-bar');

    const interimBox = this.container.querySelector('#interim-speech-box');
    const interimText = this.container.querySelector('#interim-speech-text');
    const typingBox = this.container.querySelector('#chat-typing-box');

    const mainMicBtn = this.container.querySelector('#btn-main-mic-talk');
    const mainMicLabel = this.container.querySelector('#txt-mic-talk-label');

    this.pipeline = new VoicePipeline({
      agent: this.agent,
      voiceMuted: this.voiceMuted,
      language: this.selectedLanguage,
      onLanguageChange: (lang) => {
        this.updateLanguageUI(lang);
      },
      onTranscriptUpdate: (messages) => {
        this.renderTranscriptBubbles(transcriptPane, messages);
      },
      onInterimSpeech: (speech) => {
        if (speech && speech.trim()) {
          interimBox.style.display = 'flex';
          interimText.textContent = speech.trim();
        } else {
          interimBox.style.display = 'none';
          interimText.textContent = '';
        }
      },
      onVolumeChange: (vol) => {
        const bar = this.container.querySelector('#mic-volume-level-bar');
        const txt = this.container.querySelector('#mic-volume-level-text');
        if (bar) bar.style.width = `${vol}%`;
        if (txt) txt.textContent = `${vol}%`;
      },
      onDeviceChange: () => {
        this.populateAudioDevices();
      },
      onAdaptiveStateChange: (adaptiveData) => {
        if (hudEmotion) hudEmotion.textContent = adaptiveData.detectedCustomerEmotion;
        if (hudAdaptedTone) hudAdaptedTone.textContent = adaptiveData.activeAdaptedBehavior;
        if (hudStressVal) hudStressVal.textContent = `${adaptiveData.customerStressScore}%`;
        if (hudStressBar) {
          hudStressBar.style.width = `${adaptiveData.customerStressScore}%`;
          if (adaptiveData.customerStressScore > 75) {
            hudStressBar.style.background = 'linear-gradient(90deg, var(--amber-400), var(--rose-500))';
          } else {
            hudStressBar.style.background = 'linear-gradient(90deg, var(--emerald-500), var(--cyan-400))';
          }
        }
      },
      onStateChange: ({ status, message, error, provider }) => {
        if (statusBadge) {
          statusBadge.textContent = message || status;
          if (status === 'speaking') {
            statusBadge.style.color = 'var(--indigo-400)';
            if (typingBox) typingBox.style.display = 'none';
          } else if (status === 'listening') {
            statusBadge.style.color = 'var(--emerald-400)';
            if (typingBox) typingBox.style.display = 'none';
          } else if (status === 'thinking') {
            statusBadge.style.color = 'var(--cyan-400)';
            if (typingBox) typingBox.style.display = 'block';
          } else if (status === 'interrupted') {
            statusBadge.style.color = 'var(--amber-400)';
          }
        }

        // Handle listening state on talk button
        if (status === 'listening') {
          this.isListening = true;
          if (mainMicBtn) {
            mainMicBtn.classList.add('listening');
            mainMicLabel.textContent = 'Listening to your voice... Speak now!';
          }
        } else if (status === 'listening-stopped' || status === 'speaking') {
          this.isListening = false;
          if (mainMicBtn) {
            mainMicBtn.classList.remove('listening');
            mainMicLabel.textContent = 'Click to Speak (Microphone)';
          }
        }

        // Handle API notice
        if (status === 'api-error' && error) {
          this.apiError = `${provider || 'API'}: ${error}`;
          const bannerText = this.container.querySelector('#ai-status-text');
          const banner = this.container.querySelector('#ai-engine-banner');
          if (bannerText) {
            bannerText.textContent = `Cloud API Notice: ${error} → Smart Autonomous AI Engine Active`;
            bannerText.style.color = 'var(--amber-400)';
          }
          if (banner) {
            banner.style.background = 'rgba(245, 158, 11, 0.15)';
            banner.style.borderBottomColor = 'rgba(245, 158, 11, 0.3)';
          }
        }
      },
      onTelemetryUpdate: (data) => {
        if (data.durationSeconds !== undefined && timerDisplay) {
          const m = Math.floor(data.durationSeconds / 60);
          const s = data.durationSeconds % 60;
          timerDisplay.textContent = `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
        }
        if (data.totalLatency) {
          const tot = this.container.querySelector('#telem-total-latency');
          const stt = this.container.querySelector('#telem-stt');
          const llm = this.container.querySelector('#telem-llm');
          const tts = this.container.querySelector('#telem-tts');
          if (tot) tot.textContent = `${data.totalLatency}ms`;
          if (stt) stt.textContent = `${data.sttLatency}ms`;
          if (llm) llm.textContent = `${data.llmLatency}ms`;
          if (tts) tts.textContent = `${data.ttsLatency}ms`;
        }
      },
      onToolExecuted: (tool) => {
        Toast.success(`Bot executed function: ${tool.name}`);
      },
      onHumanHandoffTriggered: (tool) => {
        if (handoffBox) {
          handoffBox.style.display = 'block';
          whisperText.textContent = tool.args?.caller_intent_summary || 'Transferred live call to human queue';
        }
        Toast.info('Call routed to human operator with live AI Whisper packet!');
      },
      onWaveformTick: (bars) => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const barWidth = canvas.width / bars.length;
        const middleY = canvas.height / 2;

        for (let i = 0; i < bars.length; i++) {
          const barHeight = Math.max(4, bars[i] * (canvas.height - 8));
          const x = i * barWidth;
          const y = middleY - barHeight / 2;

          const gradient = ctx.createLinearGradient(0, y, 0, y + barHeight);
          gradient.addColorStop(0, '#6366f1');
          gradient.addColorStop(0.5, '#06b6d4');
          gradient.addColorStop(1, '#34d399');

          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.roundRect(x + 1, y, Math.max(2, barWidth - 2), barHeight, 2);
          ctx.fill();
        }
      }
    });

    this.pipeline.startCall(this.initialCustomGreeting);
    this.populateAudioDevices();
  }

  async populateAudioDevices() {
    const select = this.container.querySelector('#select-audio-device');
    if (!select) return;
    try {
      const devices = await VoicePipeline.getAudioInputDevices();
      if (devices && devices.length > 0) {
        // Auto-detect Bluetooth Headset / soundcore
        const preferred = devices.find(d =>
          /soundcore|space|headset|hands-free|bluetooth|wireless|airpods|buds/i.test(d.label)
        );

        select.innerHTML = devices.map((d, idx) => {
          const isSelected = preferred ? (d.deviceId === preferred.deviceId) : (idx === 0);
          return `<option value="${d.deviceId}" ${isSelected ? 'selected' : ''}>${d.label || `Microphone ${idx + 1}`}</option>`;
        }).join('');

        if (preferred && this.pipeline && !this.pipeline.selectedDeviceId) {
          this.pipeline.setSelectedDeviceId(preferred.deviceId);
        }
      }
      select.onchange = (e) => {
        if (this.pipeline) {
          this.pipeline.setSelectedDeviceId(e.target.value);
          Toast.info(`Microphone input switched to: ${select.options[select.selectedIndex]?.text}`);
        }
      };
    } catch (e) {
      console.warn('Audio device enum error:', e);
    }
  }

  renderTranscriptBubbles(pane, messages) {
    pane.innerHTML = messages.map(msg => `
      <div class="chat-bubble ${msg.speaker}">
        <div style="font-weight: 700; font-size: 0.75rem; margin-bottom: 0.25rem; display: flex; justify-content: space-between; color: ${msg.speaker === 'bot' ? 'var(--indigo-400)' : 'var(--cyan-400)'};">
          <span>${msg.speaker === 'bot' ? this.agent.name : 'You (Caller)'}</span>
          ${msg.emotion ? `<span style="font-size: 0.68rem; color: var(--amber-400); font-family: var(--font-mono);">[Vibe: ${msg.emotion}]</span>` : ''}
          ${msg.adaptedTone ? `<span style="font-size: 0.68rem; color: var(--emerald-400); font-family: var(--font-mono);">[Tone: ${msg.adaptedTone}]</span>` : ''}
        </div>
        <div style="line-height: 1.5;">${msg.text}</div>
        ${msg.toolCall ? `
          <div class="tool-pill-tag">
            <span>⚡ Function Called: <strong>${msg.toolCall.name}</strong></span>
            ${msg.toolCall.result ? `<span style="color: var(--text-light); margin-left: 4px;">(${typeof msg.toolCall.result === 'object' ? JSON.stringify(msg.toolCall.result) : msg.toolCall.result})</span>` : ''}
          </div>
        ` : ''}
        <div class="bubble-meta">
          <span>${msg.timestamp}</span>
          <span>${msg.speaker === 'bot' ? (this.voiceMuted ? 'Adaptive Chat' : 'Adaptive AI Speech') : 'Voice / Chat Input'}</span>
        </div>
      </div>
    `).join('');

    setTimeout(() => {
      pane.scrollTop = pane.scrollHeight;
    }, 40);
  }

  attachEvents() {
    const hangupBtn = this.container.querySelector('#btn-hangup-call');
    hangupBtn.addEventListener('click', () => {
      this.close();
    });

    // Portal Mode Switcher
    const modeTabs = this.container.querySelectorAll('.portal-mode-tab');
    const voiceControlBar = this.container.querySelector('#live-voice-control-bar');
    const layout = this.container.querySelector('#sandbox-body-layout');

    modeTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        modeTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const mode = tab.getAttribute('data-mode');
        this.currentMode = mode;

        if (mode === 'chat') {
          voiceControlBar.style.display = 'none';
          layout.style.gridTemplateColumns = '1fr 300px';
        } else if (mode === 'call') {
          voiceControlBar.style.display = 'block';
          layout.style.gridTemplateColumns = '1fr 340px';
        } else {
          // split
          voiceControlBar.style.display = 'block';
          layout.style.gridTemplateColumns = '1.15fr 360px';
        }
      });
    });

    // Voice Output Toggle (Mute / Unmute TTS)
    const voiceToggleBtn = this.container.querySelector('#btn-toggle-voice-output');
    const voiceToggleLabel = this.container.querySelector('#txt-voice-toggle-label');
    voiceToggleBtn.addEventListener('click', () => {
      this.voiceMuted = !this.voiceMuted;
      if (this.pipeline) {
        this.pipeline.setVoiceMuted(this.voiceMuted);
      }
      if (this.voiceMuted) {
        voiceToggleBtn.classList.remove('active');
        voiceToggleBtn.classList.add('muted');
        voiceToggleBtn.querySelector('span:first-child').textContent = '🔇';
        voiceToggleLabel.textContent = 'Voice Muted';
        Toast.info('Agent audio speech muted. Text chat remains active.');
      } else {
        voiceToggleBtn.classList.remove('muted');
        voiceToggleBtn.classList.add('active');
        voiceToggleBtn.querySelector('span:first-child').textContent = '🔊';
        voiceToggleLabel.textContent = 'Voice Speaking';
        Toast.success('Agent audio speech enabled.');
      }
    });

    // Main Big Microphone Button
    const mainMicBtn = this.container.querySelector('#btn-main-mic-talk');
    mainMicBtn.addEventListener('click', async () => {
      if (this.pipeline) {
        if (this.pipeline.latestInterimText && this.pipeline.latestInterimText.trim().length > 0) {
          this.pipeline.submitPendingSpeech();
        } else if (this.pipeline.isListening) {
          this.pipeline.stopListening();
        } else {
          await this.pipeline.startListening();
        }
      }
    });

    // Chat Bar Mic Button
    const chatMicBtn = this.container.querySelector('#btn-chat-mic');
    chatMicBtn.addEventListener('click', async () => {
      if (this.pipeline) {
        if (this.pipeline.latestInterimText && this.pipeline.latestInterimText.trim().length > 0) {
          this.pipeline.submitPendingSpeech();
        } else if (this.pipeline.isListening) {
          this.pipeline.stopListening();
        } else {
          await this.pipeline.startListening();
        }
      }
    });

    // Explicit Interim Submit Button
    const submitInterimBtn = this.container.querySelector('#btn-submit-interim-voice');
    if (submitInterimBtn) {
      submitInterimBtn.addEventListener('click', () => {
        if (this.pipeline) {
          this.pipeline.submitPendingSpeech();
        }
      });
    }

    const btnEn = this.container.querySelector('#btn-lang-en');
    const btnHi = this.container.querySelector('#btn-lang-hi');

    if (btnEn) {
      btnEn.addEventListener('click', () => {
        this.setLanguage('en-US');
      });
    }

    if (btnHi) {
      btnHi.addEventListener('click', () => {
        this.setLanguage('hi-IN');
      });
    }

    this.renderPromptChips();

    const manageKeyBtn = this.container.querySelector('#btn-call-manage-api-key');
    if (manageKeyBtn) {
      manageKeyBtn.addEventListener('click', () => {
        this.onOpenApiKeyModal();
      });
    }

    const bargeInBtn = this.container.querySelector('#btn-test-bargein');
    bargeInBtn.addEventListener('click', () => {
      if (this.pipeline) {
        this.pipeline.interruptBotSpeech();
        setTimeout(() => {
          this.pipeline.processUserInput("Wait, excuse me, I actually need to change the day to Friday afternoon instead!");
        }, 300);
      }
    });

    const customInput = this.container.querySelector('#call-custom-text-input');
    const sendBtn = this.container.querySelector('#btn-send-custom-text');

    const handleSend = () => {
      const val = customInput.value.trim();
      if (val && this.pipeline) {
        this.pipeline.processUserInput(val);
        customInput.value = '';
      }
    };

    sendBtn.addEventListener('click', handleSend);
    customInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleSend();
    });
  }

  getPromptChips(lang) {
    if (lang && lang.startsWith('hi')) {
      return [
        { label: '🙏 नमस्ते अभिवादन', text: 'नमस्ते साएश! क्या आप क्रिमिनल डिफेंस और जमानत मामलों में सहायता करते हैं?', color: '#f59e0b' },
        { label: '⚖️ जमानत और केस पूछताछ', text: 'नमस्ते, मेरे भाई को मियामी में गिरफ्तार कर लिया गया है, क्या आप जमानत कराने में तुरंत मदद कर सकते हैं?', color: '#10b981' },
        { label: '⏱️ तुरंत वकील परामर्श', text: 'मुझे अभी तुरंत एक क्रिमिनल डिफेंस वकील से बात करनी है, क्या कोई उपलब्ध है?', color: '#06b6d4' },
        { label: '💼 फीस और प्रक्रिया', text: 'आपकी कानूनी फीस कितनी है और क्या पहली सलाह मुफ्त है?', color: '#a855f7' },
        { label: '😰 आपातकालीन मदद', text: 'मदद कीजिए! पुलिस ने मेरे रिश्तेदार को हिरासत में ले लिया है, हमें तुरंत वकील चाहिए!', color: '#f43f5e' }
      ];
    }
    return [
      { label: '⚖️ Bail Bonds Inquiry', text: 'My brother was arrested in Miami last night on DUI charges. How fast can your lawyers get him out on bond?', color: '#10b981' },
      { label: '😰 Panicked Caller', text: 'Help! Police just detained my family member in Miami, we need an emergency criminal defense lawyer right now!', color: '#f43f5e' },
      { label: '⏱️ Urgent Consultation', text: 'I have a court arraignment tomorrow morning at 9 AM, can I speak directly to an attorney today?', color: '#f59e0b' },
      { label: '💼 Legal Fees & Retainer', text: 'What are your flat fees for felony defense representation, and is the initial consultation free?', color: '#a855f7' },
      { label: '😊 Friendly Caller', text: 'Good morning! I wanted to inquire about retaining your defense practice for a pending case.', color: '#06b6d4' }
    ];
  }

  renderPromptChips() {
    const container = this.container.querySelector('#prompt-chips-container');
    if (!container) return;
    const chips = this.getPromptChips(this.selectedLanguage);
    container.innerHTML = chips.map(chip => `
      <button class="prompt-chip-btn" data-text="${chip.text.replace(/"/g, '&quot;')}" style="border-color: ${chip.color}55; color: #fff; font-size: 0.72rem; padding: 0.28rem 0.6rem; white-space: nowrap; border-radius: 4px; background: rgba(0,0,0,0.3); cursor: pointer; transition: all 0.2s ease;">
        ${chip.label}
      </button>
    `).join('');

    const promptBtns = container.querySelectorAll('.prompt-chip-btn[data-text]');
    promptBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const text = btn.getAttribute('data-text');
        if (this.pipeline) {
          this.pipeline.processUserInput(text);
        }
      });
    });
  }

  updateLanguageUI(lang) {
    this.selectedLanguage = lang;
    const btnEn = this.container.querySelector('#btn-lang-en');
    const btnHi = this.container.querySelector('#btn-lang-hi');
    const customInput = this.container.querySelector('#call-custom-text-input');

    if (btnEn && btnHi) {
      if (lang && lang.startsWith('hi')) {
        btnEn.style.background = 'transparent';
        btnEn.style.borderColor = 'transparent';
        btnHi.style.background = 'linear-gradient(135deg, #ea580c, #16a34a)';
        btnHi.style.borderColor = '#f59e0b';
      } else {
        btnEn.style.background = 'var(--indigo-600)';
        btnEn.style.borderColor = 'var(--indigo-400)';
        btnHi.style.background = 'transparent';
        btnHi.style.borderColor = 'transparent';
      }
    }

    if (customInput) {
      customInput.placeholder = (lang && lang.startsWith('hi'))
        ? `हिंदी में संदेश या प्रश्न टाइप करें (उदा. जमानत में मदद चाहिए)...`
        : `Type a message, question, or query for ${this.agent.name}...`;
    }

    this.renderPromptChips();
  }

  setLanguage(lang) {
    const prevLang = this.selectedLanguage;
    this.selectedLanguage = lang;
    if (this.pipeline) {
      this.pipeline.setLanguage(lang);
      if (this.pipeline.isCallActive && prevLang !== lang) {
        const isHi = lang.startsWith('hi');
        const agentName = this.agent?.name?.split('—')[0]?.trim() || 'Agent';
        const isLegal = this.agent?.name?.toLowerCase().includes('saiesh') || (this.agent?.systemPrompt || '').toLowerCase().includes('defense');
        
        let switchMsg = '';
        if (isHi) {
          switchMsg = isLegal
            ? `नमस्ते! भाषा हिंदी में बदल दी गई है। मैं ${agentName} हूँ। मैं जमानत और क्रिमिनल केस में आपकी सहायता के लिए तैयार हूँ।`
            : `नमस्ते! भाषा हिंदी में सेट कर दी गई है। मैं आपकी सहायता के लिए तैयार हूँ।`;
        } else {
          switchMsg = isLegal
            ? `Language locked to English. My name is ${agentName}. How can I assist you with your criminal defense or bail inquiry?`
            : `Language switched to English. How can I assist you today?`;
        }

        this.pipeline.addMessage('bot', switchMsg);
        this.pipeline.speakBotResponse(switchMsg);
      }
    }
    this.updateLanguageUI(lang);
    Toast.info(lang.startsWith('hi') 
      ? '🌐 हिंदी भाषा चुनी गई — एजेंट अब 100% हिंदी में बोलेगा और उत्तर देगा।' 
      : '🌐 English locked — Agent will strictly answer in English.');
  }

  close() {
    if (this.pipeline) {
      const cdr = this.pipeline.endCall();
      Toast.success(`Call ended (${cdr.durationFormatted}). Detail record saved to analytics logs.`);
      this.onCallEnded(cdr);
    }

    if (this.container) {
      this.container.innerHTML = '';
    }
  }
}
