import { storage } from '../services/storage.js';
import { Toast } from './Toast.js';

export class CallLogsView {
  constructor(options = {}) {
    this.filterStatus = 'all';
    this.filterSentiment = 'all';
    this.searchQuery = '';
    this.selectedCallId = options.initialCallId || null;
  }

  render(container) {
    const ws = storage.getActiveWorkspace();
    const callLogs = storage.getCallLogs();

    // Filtering
    let filtered = callLogs.filter(call => {
      if (this.filterStatus !== 'all') {
        if (this.filterStatus === 'completed' && call.status !== 'Completed') return false;
        if (this.filterStatus === 'escalated' && call.status !== 'Transferred to Human') return false;
      }
      if (this.filterSentiment !== 'all') {
        if (this.filterSentiment === 'positive' && call.sentiment !== 'Positive') return false;
        if (this.filterSentiment === 'frustrated' && !call.sentiment.includes('Frustrated')) return false;
      }
      if (this.searchQuery) {
        const q = this.searchQuery.toLowerCase();
        return (
          (call.callerName || '').toLowerCase().includes(q) ||
          (call.callerNumber || '').toLowerCase().includes(q) ||
          (call.agentName || '').toLowerCase().includes(q)
        );
      }
      return true;
    });

    container.innerHTML = `
      <div class="view-header">
        <div class="view-title-group">
          <h1>Call Detail Records & Human Handoff Monitoring</h1>
          <p>Diarized audio transcripts, mid-call tool execution traces, AI Whisper summaries, and sentiment analytics</p>
        </div>
        <div style="display: flex; gap: 0.65rem;">
          <button class="btn-secondary" id="btn-export-all-cdr">📥 Export CDR (CSV)</button>
        </div>
      </div>

      <!-- Filters Bar -->
      <div class="card-panel" style="padding: 0.85rem 1.25rem; margin-bottom: 1.25rem;">
        <div style="display: flex; gap: 1rem; align-items: center; flex-wrap: wrap;">
          <div style="flex: 1; min-width: 220px;">
            <input type="text" class="form-input" id="search-calls-input" placeholder="🔍 Search caller name, phone number, or agent..." value="${this.searchQuery}" style="padding: 0.45rem 0.75rem; font-size: 0.82rem;" />
          </div>

          <div style="display: flex; gap: 0.5rem; align-items: center;">
            <span style="font-size: 0.75rem; color: var(--text-dim); font-weight: 600;">Status:</span>
            <select class="form-select" id="filter-status-select" style="padding: 0.4rem 0.65rem; font-size: 0.78rem; width: auto;">
              <option value="all" ${this.filterStatus === 'all' ? 'selected' : ''}>All Calls</option>
              <option value="completed" ${this.filterStatus === 'completed' ? 'selected' : ''}>Resolved by AI</option>
              <option value="escalated" ${this.filterStatus === 'escalated' ? 'selected' : ''}>Transferred to Human</option>
            </select>
          </div>

          <div style="display: flex; gap: 0.5rem; align-items: center;">
            <span style="font-size: 0.75rem; color: var(--text-dim); font-weight: 600;">Sentiment:</span>
            <select class="form-select" id="filter-sentiment-select" style="padding: 0.4rem 0.65rem; font-size: 0.78rem; width: auto;">
              <option value="all" ${this.filterSentiment === 'all' ? 'selected' : ''}>All Sentiments</option>
              <option value="positive" ${this.filterSentiment === 'positive' ? 'selected' : ''}>Positive</option>
              <option value="frustrated" ${this.filterSentiment === 'frustrated' ? 'selected' : ''}>Frustrated / Escalated</option>
            </select>
          </div>
        </div>
      </div>

      <!-- Call Logs Table -->
      <div class="card-panel">
        <div class="card-panel-header">
          <div class="card-panel-title">
            <span>🎧</span>
            <span>Recorded Calls (${filtered.length})</span>
          </div>
        </div>

        <div class="data-table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Caller & Phone</th>
                <th>Assigned Bot</th>
                <th>Resolution Status</th>
                <th>Duration</th>
                <th>Sentiment Score</th>
                <th>Avg Latency</th>
                <th>Cost</th>
                <th>Tools Called</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${filtered.length === 0 ? `
                <tr>
                  <td colspan="9" style="text-align: center; padding: 2rem; color: var(--text-dim);">
                    No calls matching current filters.
                  </td>
                </tr>
              ` : filtered.map(call => `
                <tr>
                  <td>
                    <div style="font-weight: 600; color: var(--text-main);">${call.callerName}</div>
                    <div style="font-family: var(--font-mono); font-size: 0.72rem; color: var(--cyan-400);">${call.callerNumber}</div>
                  </td>
                  <td>
                    <div style="font-weight: 500;">${call.agentName}</div>
                    <div style="font-size: 0.7rem; color: var(--text-dim);">${call.direction} DID: ${call.inboundNumber}</div>
                  </td>
                  <td>
                    <span class="badge-status ${call.status === 'Completed' ? 'success' : 'warning'}">
                      ${call.status}
                    </span>
                  </td>
                  <td style="font-family: var(--font-mono);">${call.durationFormatted}</td>
                  <td>
                    <span style="font-weight: 600; color: ${call.sentiment === 'Positive' ? 'var(--emerald-400)' : (call.sentiment === 'Neutral' ? 'var(--text-light)' : 'var(--rose-500)')};">
                      ● ${call.sentiment} (${Math.round((call.sentimentScore || 0.8) * 100)}%)
                    </span>
                  </td>
                  <td style="font-family: var(--font-mono); color: var(--cyan-400);">${call.latencyAvgMs || 420}ms</td>
                  <td style="font-family: var(--font-mono); font-size: 0.75rem;">$${call.costUsd?.toFixed(2) || '0.12'}</td>
                  <td>
                    ${call.toolsExecuted && call.toolsExecuted.length > 0 ? call.toolsExecuted.map(t => `
                      <span class="tool-pill-tag" style="margin: 0 2px;">⚡ ${t}</span>
                    `).join('') : '<span style="color: var(--text-dim); font-size: 0.75rem;">None</span>'}
                  </td>
                  <td>
                    <button class="btn-primary btn-open-call-detail" data-call-id="${call.id}" style="padding: 0.25rem 0.65rem; font-size: 0.75rem;">
                      Inspect Call
                    </button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Call Detail Modal Host -->
      <div id="call-detail-modal-host"></div>
    `;

    this.attachEvents(container, callLogs);

    if (this.selectedCallId) {
      const target = callLogs.find(c => c.id === this.selectedCallId);
      if (target) {
        this.openCallDetailModal(container, target);
      }
    }
  }

  attachEvents(container, callLogs) {
    const searchInput = container.querySelector('#search-calls-input');
    searchInput.addEventListener('input', (e) => {
      this.searchQuery = e.target.value;
      this.render(container);
    });

    const filterStatus = container.querySelector('#filter-status-select');
    filterStatus.addEventListener('change', (e) => {
      this.filterStatus = e.target.value;
      this.render(container);
    });

    const filterSentiment = container.querySelector('#filter-sentiment-select');
    filterSentiment.addEventListener('change', (e) => {
      this.filterSentiment = e.target.value;
      this.render(container);
    });

    const exportBtn = container.querySelector('#btn-export-all-cdr');
    exportBtn.addEventListener('click', () => {
      Toast.success('Exported CDR call history to CSV');
    });

    const detailBtns = container.querySelectorAll('.btn-open-call-detail');
    detailBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const callId = btn.getAttribute('data-call-id');
        const call = callLogs.find(c => c.id === callId);
        if (call) {
          this.openCallDetailModal(container, call);
        }
      });
    });
  }

  openCallDetailModal(container, call) {
    const host = container.querySelector('#call-detail-modal-host');
    const isEscalated = call.status === 'Transferred to Human';

    host.innerHTML = `
      <div class="call-modal-overlay open" id="modal-call-detail">
        <div class="call-modal-content" style="width: 950px; max-width: 95vw;">
          <!-- Header -->
          <div class="call-modal-header">
            <div style="display: flex; align-items: center; gap: 0.75rem;">
              <div style="font-size: 1.5rem;">🎧</div>
              <div>
                <h3 style="font-size: 1.05rem; font-weight: 700; color: var(--text-main);">
                  Call Inspector: ${call.callerName} (${call.callerNumber})
                </h3>
                <div style="font-size: 0.75rem; color: var(--text-muted);">
                  Bot: <strong>${call.agentName}</strong> • Duration: <span style="font-family: var(--font-mono);">${call.durationFormatted}</span> • Sentiment: <strong style="color: ${call.sentiment === 'Positive' ? 'var(--emerald-400)' : 'var(--amber-400)'};">${call.sentiment}</strong>
                </div>
              </div>
            </div>
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <button class="btn-secondary" id="btn-export-transcript" style="font-size: 0.75rem;">📥 Export JSON</button>
              <button class="btn-secondary" id="btn-close-detail-modal" style="padding: 0.2rem 0.5rem;">✕</button>
            </div>
          </div>

          <!-- Body Split: Transcript vs Details -->
          <div class="call-sandbox-body">
            <!-- Left: Diarized Audio Transcript -->
            <div class="transcript-pane" style="max-height: 520px;">
              <!-- Simulated Waveform Audio Scrubber -->
              <div class="audio-player-box" style="margin-bottom: 0.5rem;">
                <button class="play-pause-btn" id="btn-audio-playback">▶</button>
                <div style="font-family: var(--font-mono); font-size: 0.75rem; color: var(--cyan-400);" id="audio-time-stamp">00:00 / ${call.durationFormatted}</div>
                <div class="audio-scrubber-track">
                  <div class="audio-scrubber-progress" id="audio-scrubber-fill"></div>
                </div>
                <span style="font-size: 0.72rem; color: var(--text-dim); font-family: var(--font-mono);">1.0x</span>
              </div>

              <!-- Messages Stream -->
              ${(call.transcript || []).map(msg => `
                <div class="chat-bubble ${msg.speaker}">
                  <div style="font-weight: 700; font-size: 0.75rem; margin-bottom: 0.25rem; color: ${msg.speaker === 'bot' ? 'var(--indigo-500)' : 'var(--cyan-400)'};">
                    ${msg.speaker === 'bot' ? call.agentName : call.callerName}
                  </div>
                  <div>${msg.text}</div>
                  ${msg.toolCall ? `
                    <div class="tool-pill-tag">
                      <span>⚡ Tool: <strong>${msg.toolCall.name}</strong></span>
                      ${msg.toolCall.result ? `<span style="color: var(--text-light); margin-left: 4px;">(${typeof msg.toolCall.result === 'object' ? JSON.stringify(msg.toolCall.result) : msg.toolCall.result})</span>` : ''}
                    </div>
                  ` : ''}
                  <div class="bubble-meta">
                    <span>${msg.timestamp || '00:00'}</span>
                    <span>${msg.speaker === 'bot' ? 'Synthesized Audio' : 'Transcribed Audio'}</span>
                  </div>
                </div>
              `).join('')}
            </div>

            <!-- Right: Handoff & Telemetry Breakdown -->
            <div class="controls-telemetry-pane" style="max-height: 520px;">
              <!-- Human Handoff Packet if applicable -->
              ${isEscalated ? `
                <div class="whisper-brief-card">
                  <div class="whisper-title">
                    <span>👥</span>
                    <span>Human Handoff & AI Whisper Packet</span>
                  </div>
                  <div style="font-size: 0.76rem; color: var(--text-light); line-height: 1.4; margin-bottom: 0.5rem;">
                    <strong>Transferred To:</strong> ${call.handoffDetails?.transferredTo || '+1 (800) 555-0192 (Clinic On-Call Nurse)'}<br/>
                    <strong>Escalation Reason:</strong> ${call.handoffDetails?.transferReason || 'Medical Emergency / Severe Pain'}
                  </div>
                  <div style="background: rgba(0,0,0,0.25); padding: 0.6rem; border-radius: var(--radius-sm); border: 1px solid rgba(245, 158, 11, 0.25);">
                    <div style="font-size: 0.7rem; text-transform: uppercase; color: var(--amber-400); font-weight: 700; margin-bottom: 0.2rem;">
                      AI Whisper Summary for Staff:
                    </div>
                    <div style="font-size: 0.74rem; color: #fff; font-style: italic;">
                      "${call.handoffDetails?.whisperSummary || 'Caller requested immediate human assistance.'}"
                    </div>
                  </div>
                </div>
              ` : `
                <div style="background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: var(--radius-md); padding: 0.75rem;">
                  <div style="color: var(--emerald-400); font-weight: 700; font-size: 0.82rem; margin-bottom: 0.3rem;">
                    ✓ 100% Resolved by AI Bot
                  </div>
                  <div style="font-size: 0.74rem; color: var(--text-light);">
                    The conversational bot completed all slots and executed tools with zero human intervention required.
                  </div>
                </div>
              `}

              <!-- Telemetry Card -->
              <div class="telemetry-card">
                <div class="telemetry-header">
                  <span>Voice Pipeline Telemetry</span>
                  <span style="color: var(--cyan-400); font-family: var(--font-mono);">${call.latencyAvgMs || 428}ms</span>
                </div>
                <div class="latency-row">
                  <span>Speech-to-Text (STT)</span>
                  <span>92ms</span>
                </div>
                <div class="latency-row">
                  <span>LLM Time-to-First-Token</span>
                  <span>168ms</span>
                </div>
                <div class="latency-row">
                  <span>TTS Audio Chunk TTFB</span>
                  <span>128ms</span>
                </div>
                <div class="latency-row">
                  <span>SIP Network Roundtrip</span>
                  <span>40ms</span>
                </div>
              </div>

              <!-- Tools Executed List -->
              <div style="background: var(--bg-darkest); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 0.85rem;">
                <div style="font-size: 0.72rem; text-transform: uppercase; color: var(--text-dim); font-weight: 700; margin-bottom: 0.45rem;">
                  Tool Executions Mid-Call
                </div>
                ${call.toolsExecuted && call.toolsExecuted.length > 0 ? call.toolsExecuted.map(t => `
                  <div style="display: flex; align-items: center; justify-content: space-between; font-family: var(--font-mono); font-size: 0.75rem; color: var(--emerald-400); margin-bottom: 0.25rem;">
                    <span>⚡ ${t}</span>
                    <span style="color: var(--text-dim);">HTTP 200</span>
                  </div>
                `).join('') : '<div style="font-size: 0.74rem; color: var(--text-dim);">No external tools triggered.</div>'}
              </div>

              <!-- CRM Sync Status -->
              <div style="background: var(--bg-darkest); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 0.85rem;">
                <div style="font-size: 0.72rem; text-transform: uppercase; color: var(--text-dim); font-weight: 700; margin-bottom: 0.35rem;">
                  CRM Synced Record
                </div>
                <div style="font-size: 0.75rem; color: var(--text-light);">
                  ${call.crmTarget || 'HubSpot Deal / Contact Record'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    const close = () => { host.innerHTML = ''; };
    host.querySelector('#btn-close-detail-modal').addEventListener('click', close);

    // Audio Playback Simulation
    const playBtn = host.querySelector('#btn-audio-playback');
    const scrubberFill = host.querySelector('#audio-scrubber-fill');
    let isPlaying = false;
    let playInterval = null;
    let pct = 0;

    playBtn.addEventListener('click', () => {
      isPlaying = !isPlaying;
      playBtn.textContent = isPlaying ? '⏸' : '▶';

      if (isPlaying) {
        Toast.info('Playing recorded audio stream with synchronized transcript...');
        playInterval = setInterval(() => {
          pct += 5;
          if (pct > 100) {
            pct = 0;
            isPlaying = false;
            playBtn.textContent = '▶';
            clearInterval(playInterval);
          }
          scrubberFill.style.width = `${pct}%`;
        }, 300);
      } else {
        clearInterval(playInterval);
      }
    });

    // Export Transcript JSON
    host.querySelector('#btn-export-transcript').addEventListener('click', () => {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(call, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `call_transcript_${call.id}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      Toast.success('Downloaded full Call Detail Record (JSON)');
    });
  }
}
