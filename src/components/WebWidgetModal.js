import { storage } from '../services/storage.js';
import { Toast } from './Toast.js';

export class WebWidgetModal {
  constructor(options = {}) {
    this.container = null;
    this.onLaunchCall = options.onLaunchCall || (() => {});
  }

  open(agent = null) {
    const agents = storage.getAgents();
    const targetAgent = agent || agents[0];

    if (!this.container) {
      this.container = document.createElement('div');
      this.container.id = 'web-widget-modal-root';
      document.body.appendChild(this.container);
    }

    this.render(targetAgent);
  }

  render(agent) {
    const ws = storage.getActiveWorkspace();
    const embedScript = `<!-- Inspirus Voice AI Floating Web Widget -->
<script 
  src="https://cdn.inspirus.ai/v1/voice-widget.js" 
  data-agent-id="${agent.id}" 
  data-workspace-id="${ws.id}"
  data-theme="dark"
  data-greeting="${encodeURIComponent(agent.greeting)}"
  async>
</script>`;

    this.container.innerHTML = `
      <div class="call-modal-overlay open" id="widget-modal-backdrop">
        <div class="call-modal-content" style="max-width: 640px;">
          <!-- Header -->
          <div class="call-modal-header">
            <div style="display: flex; align-items: center; gap: 0.65rem;">
              <span style="font-size: 1.4rem;">🌐</span>
              <div>
                <h3 style="font-size: 1.1rem; font-weight: 700; color: #fff;">
                  Web Voice Agent Hosting & Embed
                </h3>
                <div style="font-size: 0.75rem; color: var(--text-muted);">
                  Host <strong>${agent.name}</strong> on any website or mobile app with 1 line of code
                </div>
              </div>
            </div>
            <button class="btn-secondary" id="btn-close-widget-modal" style="padding: 0.2rem 0.5rem;">✕</button>
          </div>

          <!-- Body -->
          <div style="padding: 1.5rem;">
            <!-- Embed Snippet Box -->
            <div class="form-group">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.4rem;">
                <label class="form-label" style="margin-bottom: 0;">Embeddable HTML / JS Snippet</label>
                <button class="btn-secondary" id="btn-copy-widget-code" style="font-size: 0.72rem; padding: 0.2rem 0.6rem;">
                  📋 Copy Snippet
                </button>
              </div>
              <textarea class="form-textarea" id="widget-code-textarea" rows="6" readonly style="font-size: 0.76rem; color: var(--cyan-400);">${embedScript}</textarea>
              <div class="form-hint">Paste this code right before the closing <code>&lt;/body&gt;</code> tag of your website.</div>
            </div>

            <!-- SIP & Telephony Hosting URLs -->
            <div style="background: var(--bg-darkest); border: 1px solid var(--border-medium); border-radius: var(--radius-md); padding: 1rem; margin-bottom: 1.25rem;">
              <div style="font-size: 0.74rem; font-weight: 700; text-transform: uppercase; color: var(--text-dim); margin-bottom: 0.5rem;">
                Telephony & Cloud Voice Hosting Endpoints
              </div>

              <div style="font-size: 0.78rem; color: var(--text-muted); margin-bottom: 0.4rem;">
                <strong>SIP URI:</strong> <code style="color: var(--cyan-400); font-family: var(--font-mono);">sip:${agent.id}@inspirus.sip.us1.twilio.com</code>
              </div>
              <div style="font-size: 0.78rem; color: var(--text-muted); margin-bottom: 0.4rem;">
                <strong>WebRTC WebSocket URL:</strong> <code style="color: var(--emerald-400); font-family: var(--font-mono);">wss://voice.inspirus.ai/v1/stream/${agent.id}</code>
              </div>
              <div style="font-size: 0.78rem; color: var(--text-muted);">
                <strong>Hosting Status:</strong> <span class="badge-status success" style="margin-left: 4px;">Live & Hosted (Global Anycast CDN)</span>
              </div>
            </div>

            <!-- Test Widget Preview Button -->
            <div style="display: flex; justify-content: flex-end; gap: 0.75rem;">
              <button class="btn-secondary" id="btn-cancel-widget">Close</button>
              <button class="btn-primary" id="btn-test-widget-live">
                <span>📞</span>
                <span>Test Hosted Voice Agent Now</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    this.attachEvents(agent);
  }

  attachEvents(agent) {
    const close = () => { if (this.container) this.container.innerHTML = ''; };

    this.container.querySelector('#btn-close-widget-modal').addEventListener('click', close);
    this.container.querySelector('#btn-cancel-widget').addEventListener('click', close);

    const copyBtn = this.container.querySelector('#btn-copy-widget-code');
    const textarea = this.container.querySelector('#widget-code-textarea');
    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(textarea.value);
      Toast.success('Web Voice Widget script copied to clipboard!');
    });

    const testLiveBtn = this.container.querySelector('#btn-test-widget-live');
    testLiveBtn.addEventListener('click', () => {
      close();
      this.onLaunchCall(agent);
    });
  }
}
