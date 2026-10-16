import { storage } from '../services/storage.js';

export class DashboardView {
  constructor(options = {}) {
    this.onNavigate = options.onNavigate || (() => {});
    this.onInspectCall = options.onInspectCall || (() => {});
    this.onSimulateCall = options.onSimulateCall || (() => {});
    this.onOpenArchitect = options.onOpenArchitect || (() => {});
    this.onTriggerRing = options.onTriggerRing || (() => {});
  }

  render(container) {
    const ws = storage.getActiveWorkspace();
    const agents = storage.getAgents();
    const phoneNumbers = storage.getPhoneNumbers();
    const callLogs = storage.getCallLogs();

    // Calculations
    const totalCalls = callLogs.length;
    const resolvedByAi = callLogs.filter(c => c.status === 'Completed').length;
    const escalated = callLogs.filter(c => c.status === 'Transferred to Human').length;
    const resolutionRate = totalCalls > 0 ? ((resolvedByAi / totalCalls) * 100).toFixed(1) : 89.4;
    const escalationRate = totalCalls > 0 ? ((escalated / totalCalls) * 100).toFixed(1) : 10.6;
    const usagePercent = Math.min(100, Math.round((ws.monthlyMinutesUsed / ws.monthlyMinutesLimit) * 100));

    container.innerHTML = `
      <div class="view-header">
        <div class="view-title-group">
          <h1>${ws.name} — Operations Hub</h1>
          <p>Real-time conversational voice metrics, low-latency telemetry, and human escalation monitoring</p>
        </div>
        <div style="display: flex; gap: 0.6rem; align-items: center; flex-wrap: wrap;">
          <button class="btn-secondary" id="btn-goto-studio">🤖 Agent Builder</button>
          <button class="btn-primary" id="btn-quick-test-call">📞 Launch Live Call Simulator</button>
          <button class="btn-primary" id="btn-quick-ring-device" style="background: linear-gradient(135deg, #10b981, #059669); border-color: #34d399; box-shadow: 0 0 15px rgba(16, 185, 129, 0.35);" title="Trigger realistic phone ringing on this device">
            <span>🔔</span>
            <span>Ring My Device</span>
          </button>
        </div>
      </div>

      <!-- Autonomous Agent Architect Prompt Bar (Headline Feature) -->
      <div class="card-panel" style="background: radial-gradient(circle at top left, rgba(99, 102, 241, 0.15), rgba(6, 182, 212, 0.08)), #101625; border: 1px solid rgba(99, 102, 241, 0.4); box-shadow: 0 10px 30px -10px var(--indigo-glow); margin-bottom: 1.5rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
          <div style="display: flex; align-items: center; gap: 0.6rem;">
            <div style="width: 32px; height: 32px; border-radius: 8px; background: linear-gradient(135deg, var(--indigo-500), var(--cyan-400)); display: flex; align-items: center; justify-content: center; font-size: 1.1rem;">
              ✨
            </div>
            <div>
              <div style="font-size: 1rem; font-weight: 800; color: #fff;">Need a Voice Agent? Tell us what to build:</div>
              <div style="font-size: 0.76rem; color: var(--text-muted);">Our AI synthesizes the persona, system prompt, ElevenLabs/Deepgram voice, tools, and rules in seconds.</div>
            </div>
          </div>
          <span class="badge-status success" style="font-family: var(--font-mono); font-size: 0.72rem;">Zero-Code Generator</span>
        </div>

        <div style="display: flex; gap: 0.6rem;">
          <input type="text" class="form-input" id="dashboard-agent-prompt-input" placeholder="e.g. Build an emergency 24/7 HVAC dispatcher that quotes our $89 service call fee and books technician slots..." style="font-size: 0.88rem; padding: 0.65rem 1rem; background: var(--bg-darkest); border-color: rgba(99, 102, 241, 0.35);" />
          <button class="btn-primary" id="btn-dashboard-generate" style="flex-shrink: 0; background: linear-gradient(135deg, var(--indigo-500), var(--cyan-400)); padding: 0.65rem 1.25rem;">
            <span>✨</span>
            <span>Build & Deploy</span>
          </button>
        </div>

        <div style="display: flex; align-items: center; gap: 0.5rem; margin-top: 0.65rem; font-size: 0.74rem; color: var(--text-dim); flex-wrap: wrap;">
          <span style="font-weight: 600;">Popular Blueprints:</span>
          <span class="dash-quick-chip" data-prompt="Build an emergency 24/7 HVAC and plumbing repair dispatcher that quotes our $89 diagnostic fee and books technician arrivals" style="cursor: pointer; color: var(--cyan-400); text-decoration: underline;">🔧 24/7 HVAC Dispatch</span>
          <span>•</span>
          <span class="dash-quick-chip" data-prompt="Build a cheerful restaurant host agent that books table reservations, answers menu questions, and processes takeout orders" style="cursor: pointer; color: var(--cyan-400); text-decoration: underline;">🍕 Restaurant Host</span>
          <span>•</span>
          <span class="dash-quick-chip" data-prompt="Build an e-commerce order support bot that looks up package tracking and processes 30-day returns" style="cursor: pointer; color: var(--cyan-400); text-decoration: underline;">📦 E-Commerce Returns</span>
          <span>•</span>
          <span class="dash-quick-chip" data-prompt="Build a Tier-1 IT helpdesk voice assistant that resets passwords and escalates P1 server outages" style="cursor: pointer; color: var(--cyan-400); text-decoration: underline;">💻 IT Helpdesk</span>
        </div>
      </div>

      <!-- KPI Metrics Cards Row -->
      <div class="metrics-row">
        <div class="metric-card">
          <div class="metric-header">
            <span>Voice Minutes Quota</span>
            <span>⏱️</span>
          </div>
          <div class="metric-value">${(ws.monthlyMinutesUsed).toLocaleString()} <span style="font-size: 0.9rem; color: var(--text-dim); font-weight: 500;">/ ${(ws.monthlyMinutesLimit).toLocaleString()}m</span></div>
          <div class="metric-sub">
            <div style="width: 100%; height: 4px; background: var(--bg-elevated); border-radius: 2px; margin-top: 4px; overflow: hidden;">
              <div style="width: ${usagePercent}%; height: 100%; background: linear-gradient(90deg, var(--indigo-500), var(--cyan-400));"></div>
            </div>
          </div>
        </div>

        <div class="metric-card">
          <div class="metric-header">
            <span>AI Resolution Rate</span>
            <span>🎯</span>
          </div>
          <div class="metric-value" style="color: var(--emerald-400);">${resolutionRate}%</div>
          <div class="metric-sub">
            <span>↑ +3.2% vs human benchmarks</span>
          </div>
        </div>

        <div class="metric-card">
          <div class="metric-header">
            <span>Human Handoff Rate</span>
            <span>👥</span>
          </div>
          <div class="metric-value" style="color: var(--amber-400);">${escalationRate}%</div>
          <div class="metric-sub" style="color: var(--amber-400);">
            <span>With Instant AI Whisper Briefing</span>
          </div>
        </div>

        <div class="metric-card">
          <div class="metric-header">
            <span>Pipeline Avg Latency</span>
            <span>⚡</span>
          </div>
          <div class="metric-value" style="color: var(--cyan-400);">428<span style="font-size: 1rem; font-weight: 600;">ms</span></div>
          <div class="metric-sub">
            <span>STT 92ms • LLM 170ms • TTS 128ms</span>
          </div>
        </div>
      </div>

      <!-- Active Telephony & Agents Banner -->
      <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 1.25rem; margin-bottom: 1.5rem;">
        <div class="card-panel" style="margin-bottom: 0;">
          <div class="card-panel-header">
            <div class="card-panel-title">
              <span>🤖</span>
              <span>Active Hosted Voice Agents (${agents.length})</span>
            </div>
            <button class="btn-secondary" id="btn-see-all-agents" style="font-size: 0.76rem; padding: 0.25rem 0.65rem;">View Studio</button>
          </div>

          <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 0.85rem;">
            ${agents.map(ag => `
              <div class="agent-card-item" data-agent-id="${ag.id}" style="border: 1px solid var(--border-medium);">
                <div class="agent-item-top">
                  <div class="agent-avatar-icon">${ag.avatar || '🤖'}</div>
                  <div>
                    <div class="agent-name-title">${ag.name}</div>
                    <span class="agent-badge-tag">${ag.badge || 'Ready'}</span>
                  </div>
                </div>
                <div style="font-size: 0.76rem; color: var(--text-muted); margin: 0.4rem 0;">
                  ${ag.role}
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 0.72rem; color: var(--text-dim); border-top: 1px solid var(--border-subtle); padding-top: 0.4rem;">
                  <span>Voice: ${ag.voiceName.split(' ')[0]}</span>
                  <span>Lang: ${ag.language}</span>
                </div>
                <div style="display: flex; gap: 0.35rem; margin-top: 0.5rem;" onclick="event.stopPropagation();">
                  <button class="btn-secondary btn-card-ring" data-agent-id="${ag.id}" style="flex: 1; justify-content: center; font-size: 0.72rem; padding: 0.28rem 0.4rem; background: rgba(16, 185, 129, 0.12); border-color: rgba(16, 185, 129, 0.4); color: #34d399;" title="Ring my device with this agent">
                    🔔 Ring Me
                  </button>
                  <button class="btn-secondary btn-card-call" data-agent-id="${ag.id}" style="flex: 1; justify-content: center; font-size: 0.72rem; padding: 0.28rem 0.4rem;" title="Start call directly">
                    📞 Call
                  </button>
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <div class="card-panel" style="margin-bottom: 0;">
          <div class="card-panel-header">
            <div class="card-panel-title">
              <span>📞</span>
              <span>Assigned Phone Numbers</span>
            </div>
            <button class="btn-secondary" id="btn-manage-numbers" style="font-size: 0.76rem; padding: 0.25rem 0.65rem;">Manage DIDs</button>
          </div>

          <div style="display: flex; flex-direction: column; gap: 0.6rem;">
            ${phoneNumbers.map(num => `
              <div style="display: flex; align-items: center; justify-content: space-between; padding: 0.65rem 0.75rem; background: var(--bg-darkest); border: 1px solid var(--border-subtle); border-radius: var(--radius-md);">
                <div>
                  <div style="font-family: var(--font-mono); font-size: 0.85rem; font-weight: 700; color: var(--cyan-400);">${num.phoneNumber}</div>
                  <div style="font-size: 0.72rem; color: var(--text-muted);">${num.label}</div>
                </div>
                <span class="badge-status success">${num.provider}</span>
              </div>
            `).join('')}
          </div>
        </div>
      </div>

      <!-- Recent Live Call Activity Feed -->
      <div class="card-panel">
        <div class="card-panel-header">
          <div class="card-panel-title">
            <span>🎧</span>
            <span>Recent Inbound & Outbound Voice Calls</span>
          </div>
          <button class="btn-secondary" id="btn-view-all-calls" style="font-size: 0.78rem; padding: 0.3rem 0.75rem;">Full Call Log Table</button>
        </div>

        <div class="data-table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Caller / Time</th>
                <th>Assigned Bot</th>
                <th>Status</th>
                <th>Duration</th>
                <th>Sentiment</th>
                <th>Tools Used</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${callLogs.slice(0, 5).map(call => `
                <tr>
                  <td>
                    <div style="font-weight: 600; color: var(--text-main);">${call.callerName}</div>
                    <div style="font-size: 0.72rem; color: var(--text-dim); font-family: var(--font-mono);">${call.callerNumber}</div>
                  </td>
                  <td>
                    <div style="font-weight: 500;">${call.agentName}</div>
                  </td>
                  <td>
                    <span class="badge-status ${call.status === 'Completed' ? 'success' : 'warning'}">
                      ${call.status}
                    </span>
                  </td>
                  <td style="font-family: var(--font-mono);">${call.durationFormatted}</td>
                  <td>
                    <span style="font-size: 0.78rem; color: ${call.sentiment === 'Positive' ? 'var(--emerald-400)' : (call.sentiment === 'Neutral' ? 'var(--text-muted)' : 'var(--rose-500)')};">
                      ● ${call.sentiment}
                    </span>
                  </td>
                  <td>
                    ${call.toolsExecuted && call.toolsExecuted.length > 0 ? call.toolsExecuted.map(t => `
                      <span class="tool-pill-tag" style="margin: 0 2px;">⚡ ${t}</span>
                    `).join('') : '<span style="color: var(--text-dim); font-size: 0.75rem;">None</span>'}
                  </td>
                  <td>
                    <button class="btn-secondary btn-inspect-row" data-call-id="${call.id}" style="padding: 0.25rem 0.6rem; font-size: 0.75rem;">
                      Inspect Call
                    </button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    this.attachEvents(container);
  }

  attachEvents(container) {
    container.querySelector('#btn-goto-studio').addEventListener('click', () => this.onNavigate('studio'));
    container.querySelector('#btn-see-all-agents').addEventListener('click', () => this.onNavigate('studio'));
    container.querySelector('#btn-manage-numbers').addEventListener('click', () => this.onNavigate('telephony'));
    container.querySelector('#btn-view-all-calls').addEventListener('click', () => this.onNavigate('call_logs'));
    container.querySelector('#btn-quick-test-call').addEventListener('click', () => this.onSimulateCall());

    const quickRingBtn = container.querySelector('#btn-quick-ring-device');
    if (quickRingBtn) {
      quickRingBtn.addEventListener('click', () => {
        const ags = storage.getAgents();
        const target = ags.find(a => a.name?.toLowerCase().includes('saiesh')) || ags[0];
        this.onTriggerRing(target, {
          reason: 'Outbound Client Callback • Legal Consultation',
          language: target?.language || 'hi-IN'
        });
      });
    }

    // Prompt generator bar
    const promptInput = container.querySelector('#dashboard-agent-prompt-input');
    const genBtn = container.querySelector('#btn-dashboard-generate');

    const handlePrompt = (promptText) => {
      this.onOpenArchitect(promptText);
    };

    genBtn.addEventListener('click', () => {
      handlePrompt(promptInput.value.trim());
    });

    promptInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handlePrompt(promptInput.value.trim());
    });

    // Quick chips
    const quickChips = container.querySelectorAll('.dash-quick-chip');
    quickChips.forEach(chip => {
      chip.addEventListener('click', () => {
        const p = chip.getAttribute('data-prompt');
        handlePrompt(p);
      });
    });

    const inspectBtns = container.querySelectorAll('.btn-inspect-row');
    inspectBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const callId = btn.getAttribute('data-call-id');
        this.onInspectCall(callId);
      });
    });

    const agentCards = container.querySelectorAll('.agent-card-item');
    agentCards.forEach(card => {
      card.addEventListener('click', () => {
        this.onNavigate('studio');
      });
    });

    const cardRingBtns = container.querySelectorAll('.btn-card-ring');
    cardRingBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const agentId = btn.getAttribute('data-agent-id');
        const target = storage.getAgents().find(a => a.id === agentId);
        this.onTriggerRing(target, {
          reason: `Direct Agent Callback (${target?.role || 'Voice Assistant'})`,
          language: target?.language || 'hi-IN'
        });
      });
    });

    const cardCallBtns = container.querySelectorAll('.btn-card-call');
    cardCallBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const agentId = btn.getAttribute('data-agent-id');
        const target = storage.getAgents().find(a => a.id === agentId);
        this.onSimulateCall(target);
      });
    });
  }
}
