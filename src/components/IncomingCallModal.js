import { storage } from '../services/storage.js';
import { Toast } from './Toast.js';

class RingtoneGenerator {
  constructor() {
    this.audioCtx = null;
    this.intervalId = null;
    this.isPlaying = false;
  }

  start() {
    if (this.isPlaying) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AudioContext();
      this.isPlaying = true;

      const playRingBurst = () => {
        if (!this.isPlaying || !this.audioCtx) return;
        if (this.audioCtx.state === 'suspended') {
          this.audioCtx.resume().catch(() => {});
        }

        const now = this.audioCtx.currentTime;
        const osc1 = this.audioCtx.createOscillator();
        const osc2 = this.audioCtx.createOscillator();
        const gainNode = this.audioCtx.createGain();

        // Standard Telephone PBX dual-tone cadence (440Hz + 480Hz)
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(440, now);
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(480, now);

        gainNode.gain.setValueAtTime(0.001, now);
        gainNode.gain.exponentialRampToValueAtTime(0.18, now + 0.05);
        gainNode.gain.setValueAtTime(0.18, now + 1.85);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + 2.0);

        osc1.connect(gainNode);
        osc2.connect(gainNode);
        gainNode.connect(this.audioCtx.destination);

        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 2.0);
        osc2.stop(now + 2.0);
      };

      playRingBurst();
      this.intervalId = setInterval(playRingBurst, 4000);
    } catch (e) {
      console.warn('Ringtone AudioContext warning:', e);
    }
  }

  stop() {
    this.isPlaying = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.audioCtx) {
      try {
        this.audioCtx.close();
      } catch {}
      this.audioCtx = null;
    }
  }
}

export class IncomingCallModal {
  constructor(options = {}) {
    this.onAccept = options.onAccept || (() => {});
    this.onDecline = options.onDecline || (() => {});
    this.container = null;
    this.ringtone = new RingtoneGenerator();
    this.timeoutTimer = null;
    this.currentAgent = null;
    this.currentLanguage = 'en-US';
    this.currentReason = '';
    this.customGreeting = '';
  }

  show(agent = null, options = {}) {
    const agents = storage.getAgents();
    this.currentAgent = agent || agents[0];
    this.currentLanguage = options.language || this.currentAgent?.language || 'en-US';
    this.currentReason = options.reason || 'AI Callback & Proactive Assistance';
    this.customGreeting = options.initialGreeting || null;

    if (!this.container) {
      this.container = document.createElement('div');
      this.container.id = 'incoming-call-modal-root';
      document.body.appendChild(this.container);
    }

    this.render();
    this.attachEvents();
    this.ringtone.start();

    // Auto-timeout after 35 seconds of ringing
    if (this.timeoutTimer) clearTimeout(this.timeoutTimer);
    this.timeoutTimer = setTimeout(() => {
      this.decline('Missed / Unanswered');
    }, 35000);
  }

  render() {
    const agent = this.currentAgent;
    const isHindi = this.currentLanguage.startsWith('hi');
    const agentName = agent.name || 'AI Voice Agent';
    const role = agent.role || 'Autonomous Voice Specialist';
    const avatar = agent.avatar || '🤖';

    this.container.innerHTML = `
      <div class="incoming-call-overlay open" id="incoming-call-backdrop">
        <div class="incoming-call-card">
          <!-- Animated Ring Pulse Rings -->
          <div class="incoming-call-pulse-wrapper">
            <div class="pulse-ring ring-1"></div>
            <div class="pulse-ring ring-2"></div>
            <div class="pulse-ring ring-3"></div>
            <div class="incoming-avatar-bubble">
              <span class="incoming-avatar-emoji">${avatar}</span>
            </div>
          </div>

          <!-- Incoming Title & Agent Info -->
          <div class="incoming-call-header">
            <div class="incoming-badge-pill">
              <span class="pulse-dot"></span>
              <span>INCOMING AI WEB CALL</span>
            </div>
            <h2 class="incoming-caller-name">${agentName}</h2>
            <p class="incoming-caller-role">${role}</p>
          </div>

          <!-- Call Context / Reason -->
          <div class="incoming-call-context">
            <div class="incoming-context-icon">⚡</div>
            <div class="incoming-context-text">
              <strong>Reason:</strong> ${this.currentReason}
            </div>
          </div>

          <!-- Bilingual Selector for this incoming call -->
          <div class="incoming-lang-picker">
            <span style="font-size: 0.72rem; color: var(--text-dim); margin-right: 0.35rem;">Language:</span>
            <button type="button" class="incoming-lang-btn ${!isHindi ? 'active' : ''}" id="btn-incoming-en">
              🇬🇧 English
            </button>
            <button type="button" class="incoming-lang-btn ${isHindi ? 'active' : ''}" id="btn-incoming-hi">
              🇮🇳 हिंदी (Hindi)
            </button>
          </div>

          <!-- Action Buttons (Accept vs Decline) -->
          <div class="incoming-call-actions">
            <!-- Decline Button -->
            <button type="button" class="call-action-btn btn-decline" id="btn-decline-call" title="Decline incoming call">
              <div class="action-icon-circle decline-circle">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08c-.18-.17-.29-.42-.29-.7 0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28-.79-.74-1.69-1.36-2.67-1.85-.33-.16-.56-.5-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z"/>
                </svg>
              </div>
              <span class="action-label">Decline</span>
            </button>

            <!-- Accept Button -->
            <button type="button" class="call-action-btn btn-accept" id="btn-accept-call" title="Answer and start conversation">
              <div class="action-icon-circle accept-circle animate-wiggle">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56-.35-.12-.74-.03-1.01.24l-1.57 1.97c-2.83-1.44-5.15-3.75-6.59-6.59l1.97-1.57c.27-.27.36-.66.24-1.01-.36-1.11-.56-2.3-.56-3.53 0-.54-.45-.99-.99-.99H4.19C3.65 3 3 3.24 3 3.99 3 13.28 10.72 21 20.01 21c.71 0 .99-.63.99-1.18v-3.45c0-.54-.45-.99-.99-.99z"/>
                </svg>
              </div>
              <span class="action-label">Accept Call</span>
            </button>
          </div>

          <div class="incoming-footer-tip">
            🔒 Direct WebRTC Encrypted Audio • No Phone Carrier Fees
          </div>
        </div>
      </div>
    `;
  }

  attachEvents() {
    const backdrop = this.container.querySelector('#incoming-call-backdrop');
    const acceptBtn = this.container.querySelector('#btn-accept-call');
    const declineBtn = this.container.querySelector('#btn-decline-call');
    const btnEn = this.container.querySelector('#btn-incoming-en');
    const btnHi = this.container.querySelector('#btn-incoming-hi');

    btnEn?.addEventListener('click', () => {
      this.currentLanguage = 'en-US';
      btnEn.classList.add('active');
      btnHi.classList.remove('active');
    });

    btnHi?.addEventListener('click', () => {
      this.currentLanguage = 'hi-IN';
      btnHi.classList.add('active');
      btnEn.classList.remove('active');
    });

    acceptBtn?.addEventListener('click', () => {
      this.accept();
    });

    declineBtn?.addEventListener('click', () => {
      this.decline('Declined by user');
    });
  }

  accept() {
    this.cleanup();
    Toast.success(`Call connected with ${this.currentAgent.name}!`);
    this.onAccept({
      agent: this.currentAgent,
      language: this.currentLanguage,
      initialGreeting: this.customGreeting
    });
  }

  decline(reason = 'Declined by user') {
    this.cleanup();
    Toast.info(`Call from ${this.currentAgent.name} was declined.`);
    this.onDecline({
      agent: this.currentAgent,
      reason
    });
  }

  cleanup() {
    if (this.timeoutTimer) {
      clearTimeout(this.timeoutTimer);
      this.timeoutTimer = null;
    }
    this.ringtone.stop();
    if (this.container) {
      this.container.innerHTML = '';
    }
  }
}
