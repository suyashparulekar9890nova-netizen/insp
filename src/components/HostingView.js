import { storage } from '../services/storage.js';
import { Toast } from './Toast.js';

export class HostingView {
  constructor(options = {}) {
    this.onLaunchCall = options.onLaunchCall || (() => {});
    this.onOpenStudio = options.onOpenStudio || (() => {});
  }

  render(container) {
    const ws = storage.getActiveWorkspace();
    const agents = storage.getAgents();
    const phoneNumbers = storage.getPhoneNumbers();

    container.innerHTML = `
      <div class="view-header">
        <div class="view-title-group">
          <h1>Universal Voice Agent Hosting & Deployment Hub</h1>
          <p>This platform serves as a 24/7 cloud host for your custom voice agents across web widgets, WebRTC, and carrier SIP trunks</p>
        </div>
      </div>

      <!-- Infrastructure Metrics -->
      <div class="metrics-row">
        <div class="metric-card">
          <div class="metric-header">
            <span>Hosted Voice Agents</span>
            <span>🌐</span>
          </div>
          <div class="metric-value" style="color: var(--cyan-400);">${agents.length}</div>
          <div class="metric-sub">Active & Serving on Global CDN</div>
        </div>

        <div class="metric-card">
          <div class="metric-header">
            <span>Concurrency Allowance</span>
            <span>⚡</span>
          </div>
          <div class="metric-value" style="color: var(--emerald-400);">50 <span style="font-size: 0.9rem; color: var(--text-dim); font-weight: 500;">lines</span></div>
          <div class="metric-sub">Zero Busy Signals or Hold Times</div>
        </div>

        <div class="metric-card">
          <div class="metric-header">
            <span>WebRTC Stream Latency</span>
            <span>⚡</span>
          </div>
          <div class="metric-value" style="color: var(--indigo-500);">415<span style="font-size: 0.9rem; font-weight: 600;">ms</span></div>
          <div class="metric-sub">Sub-500ms Conversational Cadence</div>
        </div>

        <div class="metric-card">
          <div class="metric-header">
            <span>Human CSR Cost Saved</span>
            <span>💰</span>
          </div>
          <div class="metric-value" style="color: var(--emerald-400);">$0.14 <span style="font-size: 0.8rem; color: var(--text-dim);">vs $4.50 human</span></div>
          <div class="metric-sub">96.8% Operational Cost Reduction</div>
        </div>
      </div>

      <!-- Hosted Agents Grid -->
      <div class="card-panel">
        <div class="card-panel-header">
          <div class="card-panel-title">
            <span>🤖</span>
            <span>Active Hosted Voice Agents (${agents.length})</span>
          </div>
        </div>

        <div style="display: flex; flex-direction: column; gap: 1rem;">
          ${agents.map(ag => {
            const assignedNum = phoneNumbers.find(p => p.assignedAgentId === ag.id);
            const embedCode = `<script src="https://cdn.inspirus.ai/v1/voice-widget.js" data-agent-id="${ag.id}" async></script>`;

            return `
              <div style="background: var(--bg-darkest); border: 1px solid var(--border-medium); border-radius: var(--radius-lg); padding: 1.25rem;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 1rem; margin-bottom: 0.85rem;">
                  <div style="display: flex; gap: 1rem; align-items: center;">
                    <div style="font-size: 2rem; width: 48px; height: 48px; border-radius: var(--radius-md); background: var(--bg-elevated); display: flex; align-items: center; justify-content: center; border: 2px solid var(--indigo-500);">
                      ${ag.avatar || '🤖'}
                    </div>
                    <div>
                      <div style="font-size: 1.05rem; font-weight: 700; color: #fff;">${ag.name}</div>
                      <div style="font-size: 0.76rem; color: var(--text-muted); margin-top: 0.15rem;">
                        ${ag.role} • Voice: <strong style="color: var(--cyan-400);">${ag.voiceName}</strong> (${ag.language})
                      </div>
                    </div>
                  </div>

                  <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <span class="badge-status success">● Hosted & Live</span>
                    <button class="btn-primary btn-call-hosted-agent" data-agent-id="${ag.id}" style="padding: 0.35rem 0.85rem; font-size: 0.8rem;">
                      📞 Call Agent
                    </button>
                  </div>
                </div>

                <!-- Hosting Endpoints Row -->
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 0.75rem; background: var(--bg-card); padding: 0.85rem; border-radius: var(--radius-md); font-size: 0.75rem; margin-bottom: 0.85rem;">
                  <div>
                    <div style="color: var(--text-dim); margin-bottom: 0.2rem;">Direct Inbound Phone DID:</div>
                    <div style="font-family: var(--font-mono); font-weight: 700; color: var(--cyan-400);">
                      ${assignedNum ? assignedNum.phoneNumber : 'No direct DID (WebRTC Only)'}
                    </div>
                  </div>
                  <div>
                    <div style="color: var(--text-dim); margin-bottom: 0.2rem;">SIP Voice Trunk URI:</div>
                    <div style="font-family: var(--font-mono); color: var(--text-light); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                      sip:${ag.id}@inspirus.sip.us1.twilio.com
                    </div>
                  </div>
                  <div>
                    <div style="color: var(--text-dim); margin-bottom: 0.2rem;">WebRTC Hosted URL:</div>
                    <div style="font-family: var(--font-mono); color: var(--emerald-400);">
                      https://voice.inspirus.ai/agent/${ag.id}
                    </div>
                  </div>
                </div>

                <!-- Web Embed Snippet with Copy Button -->
                <div style="display: flex; align-items: center; justify-content: space-between; background: #060910; border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); padding: 0.5rem 0.75rem; font-family: var(--font-mono); font-size: 0.72rem;">
                  <span style="color: var(--cyan-400); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-right: 1rem;">
                    ${embedCode}
                  </span>
                  <button class="btn-secondary btn-copy-agent-embed" data-code="${encodeURIComponent(embedCode)}" style="font-size: 0.7rem; padding: 0.2rem 0.5rem; flex-shrink: 0;">
                    📋 Copy Embed Code
                  </button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;

    this.attachEvents(container, agents);
  }

  attachEvents(container, agents) {
    // Call hosted agent
    const callBtns = container.querySelectorAll('.btn-call-hosted-agent');
    callBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-agent-id');
        const agent = agents.find(a => a.id === id) || agents[0];
        this.onLaunchCall(agent);
      });
    });

    // Copy embed code
    const copyBtns = container.querySelectorAll('.btn-copy-agent-embed');
    copyBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const code = decodeURIComponent(btn.getAttribute('data-code'));
        navigator.clipboard.writeText(code);
        Toast.success('Web Voice Widget script copied to clipboard!');
      });
    });
  }
}
