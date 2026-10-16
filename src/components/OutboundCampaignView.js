import { storage } from '../services/storage.js';
import { Toast } from './Toast.js';

export class OutboundCampaignView {
  constructor(options = {}) {
    this.recipients = [];
    this.selectedAgentId = storage.getWhatsAppAssignedAgent()?.id || storage.getAgents()[0]?.id;
    this.campaignTone = 'friendly'; // 'friendly', 'urgent', 'settlement', 'appointment'
    this.campaignLanguage = 'auto'; // 'auto', 'hi', 'en'
    this.delaySeconds = 6;
    this.isDispatching = false;
    this.dispatchProgress = { current: 0, total: 0, sent: 0, failed: 0 };
    this.gatewayStatus = 'checking'; // 'online', 'offline', 'checking'
    this.previewModalItem = null;

    this.checkGatewayHealth();
  }

  async checkGatewayHealth() {
    try {
      const res = await fetch('http://127.0.0.1:5058/health', { method: 'GET' });
      if (res.ok) {
        const data = await res.json();
        this.gatewayStatus = data.chromeConnected ? 'online' : 'partial';
      } else {
        this.gatewayStatus = 'offline';
      }
    } catch {
      this.gatewayStatus = 'offline';
    }
  }

  render(container) {
    const agents = storage.getAllAgents();
    const activeAgent = agents.find(a => a.id === this.selectedAgentId) || agents[0];

    container.innerHTML = `
      <div class="view-header">
        <div class="view-title-group">
          <h1>📢 Outbound WhatsApp Campaigns & Dues Recovery</h1>
          <p>Upload a CSV with dues, fees, or appointment dates. Your AI agents generate tailored bilingual messages and dispatch them via WhatsApp.</p>
        </div>
        <div style="display: flex; gap: 0.65rem; align-items: center; flex-wrap: wrap;">
          <input type="file" id="outbound-csv-input" accept=".csv" style="display: none;" />
          <button class="btn-secondary" id="btn-upload-csv">
            📁 Upload CSV File
          </button>
          <button class="btn-primary" id="btn-load-sample" style="background: linear-gradient(135deg, #06b6d4, #3b82f6); border-color: #38bdf8;">
            ⚡ Load Sample Dues Data
          </button>
        </div>
      </div>

      <!-- Gateway Status Indicator Banner -->
      <div class="card-panel" style="background: ${this.gatewayStatus === 'online' ? 'rgba(16, 185, 129, 0.08)' : 'rgba(245, 158, 11, 0.08)'}; border: 1px solid ${this.gatewayStatus === 'online' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)'}; margin-bottom: 1.25rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.8rem;">
          <div style="display: flex; align-items: center; gap: 0.65rem;">
            <span style="font-size: 1.25rem;">${this.gatewayStatus === 'online' ? '🟢' : '🟡'}</span>
            <div>
              <div style="font-weight: 700; color: #fff; font-size: 0.92rem;">
                ${this.gatewayStatus === 'online' ? 'Automated WhatsApp Bridge Active (Port 5058)' : 'Direct 1-Click WhatsApp Web Mode'}
              </div>
              <div style="font-size: 0.76rem; color: var(--text-muted);">
                ${this.gatewayStatus === 'online' 
                  ? 'Autonomous unattended broadcast ready via your open Chrome session.' 
                  : 'Start node server/whatsapp_outbound.js for 100% automated sending, or click "Send" on any row for instant 1-click dispatch.'}
              </div>
            </div>
          </div>
          <div style="display: flex; gap: 0.5rem; align-items: center;">
            <span class="badge-status ${this.gatewayStatus === 'online' ? 'success' : 'warning'}" style="font-family: var(--font-mono); font-size: 0.72rem;">
              ${this.gatewayStatus === 'online' ? 'AUTO-DISPATCH READY' : '1-CLICK READY'}
            </span>
            <button class="btn-secondary" id="btn-refresh-gateway" style="padding: 0.25rem 0.5rem; font-size: 0.72rem;">🔄 Re-check</button>
          </div>
        </div>
      </div>

      <!-- Campaign Setup Controls -->
      <div class="card-panel" style="margin-bottom: 1.25rem;">
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; align-items: center;">
          <!-- Agent Selector -->
          <div>
            <label style="font-size: 0.78rem; font-weight: 700; color: var(--text-light); display: block; margin-bottom: 0.35rem;">
              🤖 Voice Agent Persona:
            </label>
            <select id="select-campaign-agent" class="form-select" style="width: 100%; background: var(--bg-darkest); color: var(--text-main); border: 1px solid var(--border-medium); border-radius: 6px; padding: 0.45rem 0.75rem;">
              ${agents.map(a => `<option value="${a.id}" ${a.id === this.selectedAgentId ? 'selected' : ''}>${a.avatar || '🤖'} ${a.name} (${a.role || 'Assistant'})</option>`).join('')}
            </select>
          </div>

          <!-- Campaign Tone -->
          <div>
            <label style="font-size: 0.78rem; font-weight: 700; color: var(--text-light); display: block; margin-bottom: 0.35rem;">
              🎭 Tone & Objective:
            </label>
            <select id="select-campaign-tone" class="form-select" style="width: 100%; background: var(--bg-darkest); color: var(--text-main); border: 1px solid var(--border-medium); border-radius: 6px; padding: 0.45rem 0.75rem;">
              <option value="friendly" ${this.campaignTone === 'friendly' ? 'selected' : ''}>💳 Friendly Payment Due Reminder</option>
              <option value="urgent" ${this.campaignTone === 'urgent' ? 'selected' : ''}>⚠️ Urgent / Past-Due Final Notice</option>
              <option value="settlement" ${this.campaignTone === 'settlement' ? 'selected' : ''}>🤝 Installment / Settlement Offer</option>
              <option value="appointment" ${this.campaignTone === 'appointment' ? 'selected' : ''}>🩺 Healthcare Appointment Recall</option>
            </select>
          </div>

          <!-- Language Preference -->
          <div>
            <label style="font-size: 0.78rem; font-weight: 700; color: var(--text-light); display: block; margin-bottom: 0.35rem;">
              🌐 Message Language:
            </label>
            <select id="select-campaign-lang" class="form-select" style="width: 100%; background: var(--bg-darkest); color: var(--text-main); border: 1px solid var(--border-medium); border-radius: 6px; padding: 0.45rem 0.75rem;">
              <option value="auto" ${this.campaignLanguage === 'auto' ? 'selected' : ''}>🌐 Auto-Detect (Per Recipient)</option>
              <option value="hi" ${this.campaignLanguage === 'hi' ? 'selected' : ''}>🇮🇳 Hindi (हिन्दी / Hinglish)</option>
              <option value="en" ${this.campaignLanguage === 'en' ? 'selected' : ''}>🇺🇸 English (US / Global)</option>
            </select>
          </div>

          <!-- Anti-Spam Interval -->
          <div>
            <label style="font-size: 0.78rem; font-weight: 700; color: var(--text-light); display: block; margin-bottom: 0.35rem;">
              ⏱️ Anti-Spam Safe Pause: <span style="color: var(--cyan-400);">${this.delaySeconds}s</span>
            </label>
            <input type="range" id="input-delay-slider" min="3" max="15" value="${this.delaySeconds}" style="width: 100%; accent-color: var(--cyan-400);" />
          </div>
        </div>
      </div>

      <!-- Execution Progress Bar (When Active) -->
      ${this.isDispatching ? `
        <div class="card-panel" style="background: rgba(99, 102, 241, 0.1); border-color: rgba(99, 102, 241, 0.4); margin-bottom: 1.25rem;">
          <div style="display: flex; justify-content: space-between; font-size: 0.85rem; font-weight: 700; color: #fff; margin-bottom: 0.4rem;">
            <span>🚀 Campaign Broadcasting in Progress...</span>
            <span style="font-family: var(--font-mono); color: var(--cyan-400);">
              ${this.dispatchProgress.current} / ${this.dispatchProgress.total} contacts (${Math.round((this.dispatchProgress.current / (this.dispatchProgress.total || 1)) * 100)}%)
            </span>
          </div>
          <div style="width: 100%; height: 8px; background: var(--bg-darkest); border-radius: 4px; overflow: hidden;">
            <div style="width: ${(this.dispatchProgress.current / (this.dispatchProgress.total || 1)) * 100}%; height: 100%; background: linear-gradient(90deg, #6366f1, #06b6d4); transition: width 0.3s ease;"></div>
          </div>
          <div style="display: flex; gap: 1rem; font-size: 0.74rem; color: var(--text-dim); margin-top: 0.4rem;">
            <span>✅ Sent: <strong>${this.dispatchProgress.sent}</strong></span>
            <span>❌ Failed: <strong>${this.dispatchProgress.failed}</strong></span>
            <span>⏳ Spacing: <strong>${this.delaySeconds}s between dispatches</strong></span>
          </div>
        </div>
      ` : ''}

      <!-- Recipients Table & Dispatch Bar -->
      <div class="card-panel">
        <div class="card-panel-header" style="flex-wrap: wrap; gap: 0.8rem;">
          <div class="card-panel-title">
            <span>👥</span>
            <span>Recipient Queue (${this.recipients.length} Loaded)</span>
          </div>
          <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
            ${this.recipients.length > 0 ? `
              <button class="btn-secondary" id="btn-generate-all-previews" style="font-size: 0.78rem;">
                ✨ Regenerate All AI Messages
              </button>
              <button class="btn-primary" id="btn-start-broadcast" ${this.isDispatching ? 'disabled' : ''} style="background: linear-gradient(135deg, #10b981, #059669); border-color: #34d399; font-size: 0.8rem;">
                ${this.isDispatching ? '⏳ Sending...' : '🚀 Start Automated Broadcast'}
              </button>
            ` : ''}
          </div>
        </div>

        ${this.recipients.length === 0 ? `
          <div style="text-align: center; padding: 3.5rem 1rem; color: var(--text-dim);">
            <div style="font-size: 3rem; margin-bottom: 0.8rem;">📂</div>
            <div style="font-weight: 700; font-size: 1.1rem; color: var(--text-light); margin-bottom: 0.4rem;">
              No CSV Loaded Yet
            </div>
            <div style="font-size: 0.82rem; max-width: 480px; margin: 0 auto 1.25rem; line-height: 1.5;">
              Upload your customer CSV file with columns: <code>Name, Phone, DueAmount, DueDate</code> or click the button below to test with ready-made demo dues data.
            </div>
            <button class="btn-primary" id="btn-empty-load-sample" style="background: linear-gradient(135deg, #06b6d4, #3b82f6); border-color: #38bdf8;">
              ⚡ Load Sample Dues Data
            </button>
          </div>
        ` : `
          <div class="data-table-container">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>WhatsApp Number</th>
                  <th>Amount Due</th>
                  <th>Due Date & Service</th>
                  <th>Personalized AI Message Preview</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                ${this.recipients.map((r, idx) => `
                  <tr>
                    <td>
                      <div style="font-weight: 700; color: var(--text-main); font-size: 0.88rem;">
                        ${r.Name || 'Valued Customer'}
                      </div>
                      <div style="font-size: 0.72rem; color: var(--text-dim);">
                        Lang: <strong style="color: var(--cyan-400);">${r.Language || 'Auto'}</strong>
                      </div>
                    </td>
                    <td>
                      <div style="font-family: var(--font-mono); font-weight: 700; color: #34d399; font-size: 0.85rem;">
                        ${r.Phone}
                      </div>
                    </td>
                    <td>
                      <span class="badge-status warning" style="font-family: var(--font-mono); font-weight: 700; font-size: 0.82rem;">
                        ${r.DueAmount || '₹0'}
                      </span>
                    </td>
                    <td>
                      <div style="font-size: 0.8rem; font-weight: 600; color: var(--text-light);">
                        📅 ${r.DueDate || 'Pending'}
                      </div>
                      <div style="font-size: 0.72rem; color: var(--text-dim);">
                        ${r.Service || r.Notes || 'Account Balance'}
                      </div>
                    </td>
                    <td style="max-width: 320px;">
                      <div style="font-size: 0.78rem; color: var(--text-light); line-height: 1.4; background: var(--bg-darkest); padding: 0.4rem 0.65rem; border-radius: 6px; border: 1px solid var(--border-subtle); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;" title="${this.escapeHtml(r._generatedMessage || '')}">
                        ${r._generatedMessage || '<span style="color: var(--text-dim); font-style: italic;">Click "Preview AI Message" to generate</span>'}
                      </div>
                    </td>
                    <td>
                      <span class="badge-status ${this.getStatusBadgeClass(r._status)}" style="font-family: var(--font-mono); font-size: 0.72rem;">
                        ${r._status || 'Pending'}
                      </span>
                    </td>
                    <td>
                      <div style="display: flex; gap: 0.35rem; align-items: center;">
                        <button class="btn-secondary btn-preview-msg" data-idx="${idx}" style="padding: 0.25rem 0.5rem; font-size: 0.74rem;" title="View or edit AI personalized message">
                          👁️ View
                        </button>
                        <button class="btn-primary btn-send-single" data-idx="${idx}" style="padding: 0.25rem 0.5rem; font-size: 0.74rem; background: #059669; border-color: #34d399;" title="Send directly now">
                          💬 Send
                        </button>
                      </div>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `}
      </div>

      <!-- Preview / Edit Modal -->
      <div id="outbound-modal-mount">
        ${this.previewModalItem ? this.renderPreviewModal(activeAgent) : ''}
      </div>
    `;

    this.attachEvents(container, activeAgent);
  }

  renderPreviewModal(agent) {
    const item = this.previewModalItem;
    return `
      <div class="modal-overlay" style="position: fixed; inset: 0; background: rgba(0,0,0,0.75); display: flex; align-items: center; justify-content: center; z-index: 9999; backdrop-filter: blur(4px);">
        <div class="modal-content card-panel" style="width: 100%; max-width: 540px; background: #0e1526; border: 1px solid var(--border-medium); border-radius: 12px; padding: 1.5rem; box-shadow: 0 20px 40px rgba(0,0,0,0.6);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; border-bottom: 1px solid var(--border-subtle); padding-bottom: 0.75rem;">
            <div style="font-weight: 700; color: #fff; font-size: 1.05rem; display: flex; align-items: center; gap: 0.5rem;">
              <span>💬</span>
              <span>WhatsApp Message Preview</span>
            </div>
            <button id="btn-close-modal" style="background: none; border: none; color: var(--text-dim); font-size: 1.2rem; cursor: pointer;">✕</button>
          </div>

          <div style="margin-bottom: 1rem; background: var(--bg-darkest); padding: 0.75rem; border-radius: 8px; font-size: 0.8rem; display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem;">
            <div><span style="color: var(--text-dim);">Recipient:</span> <strong>${item.Name}</strong></div>
            <div><span style="color: var(--text-dim);">Phone:</span> <strong style="color: #34d399;">${item.Phone}</strong></div>
            <div><span style="color: var(--text-dim);">Due Amount:</span> <strong style="color: var(--amber-400);">${item.DueAmount}</strong></div>
            <div><span style="color: var(--text-dim);">Due Date:</span> <strong>${item.DueDate}</strong></div>
          </div>

          <div style="margin-bottom: 1.25rem;">
            <label style="font-size: 0.78rem; font-weight: 700; color: var(--text-light); display: block; margin-bottom: 0.4rem;">
              Personalized Message Text (Edit if needed):
            </label>
            <textarea id="modal-msg-textarea" class="form-textarea" style="width: 100%; height: 130px; font-size: 0.85rem; line-height: 1.5; background: var(--bg-darkest); color: var(--text-main); border: 1px solid var(--border-medium); border-radius: 8px; padding: 0.65rem;">${item._generatedMessage || ''}</textarea>
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center; gap: 0.75rem; flex-wrap: wrap;">
            <button class="btn-secondary" id="btn-open-wa-direct" style="font-size: 0.8rem;">
              🌐 Open in WhatsApp Web
            </button>
            <div style="display: flex; gap: 0.5rem;">
              <button class="btn-secondary" id="btn-modal-cancel">Cancel</button>
              <button class="btn-primary" id="btn-modal-send" style="background: #059669; border-color: #34d399;">
                🚀 Dispatch via Bridge
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  attachEvents(container, activeAgent) {
    // CSV file picker
    const uploadBtn = container.querySelector('#btn-upload-csv');
    const fileInput = container.querySelector('#outbound-csv-input');
    if (uploadBtn && fileInput) {
      uploadBtn.addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
          this.loadCsvString(evt.target.result);
          Toast.success(`Loaded ${this.recipients.length} recipients from "${file.name}"!`);
          this.render(container);
        };
        reader.readAsText(file);
      });
    }

    // Load sample data button
    const loadSampleBtns = container.querySelectorAll('#btn-load-sample, #btn-empty-load-sample');
    loadSampleBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const sampleCsv = `Name,Phone,DueAmount,DueDate,Service,Language,Notes
Rajesh Sharma,+919876543210,₹4500,18-Oct-2026,Dental Cleaning,Hindi,Invoice #1024
Ananya Verma,+919123456789,₹12000,20-Oct-2026,Root Canal Consultation,English,Second reminder
Vikram Patel,+919811223344,₹8200,19-Oct-2026,Orthodontic Checkup,Hindi,Installment due
Sarah Jenkins,+14155550182,$350,22-Oct-2026,General Health Screening,English,Card on file expired
Amitabh Sen,+919822334455,₹2800,17-Oct-2026,Lab Reports & X-Ray,Hindi,Urgent due today`;
        this.loadCsvString(sampleCsv);
        Toast.success('⚡ Sample dues data loaded with 5 customer records!');
        this.render(container);
      });
    });

    // Recheck gateway health
    const refreshBtn = container.querySelector('#btn-refresh-gateway');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', async () => {
        Toast.info('Testing connection to port 5058...');
        await this.checkGatewayHealth();
        this.render(container);
        if (this.gatewayStatus === 'online') {
          Toast.success('Connected to WhatsApp Outbound Gateway!');
        } else {
          Toast.warning('Gateway not detected on port 5058. 1-Click web mode active.');
        }
      });
    }

    // Agent selector
    const agentSelect = container.querySelector('#select-campaign-agent');
    if (agentSelect) {
      agentSelect.addEventListener('change', (e) => {
        this.selectedAgentId = e.target.value;
        this.generateAllMessages(container);
      });
    }

    // Campaign tone selector
    const toneSelect = container.querySelector('#select-campaign-tone');
    if (toneSelect) {
      toneSelect.addEventListener('change', (e) => {
        this.campaignTone = e.target.value;
        this.generateAllMessages(container);
      });
    }

    // Campaign language selector
    const langSelect = container.querySelector('#select-campaign-lang');
    if (langSelect) {
      langSelect.addEventListener('change', (e) => {
        this.campaignLanguage = e.target.value;
        this.generateAllMessages(container);
      });
    }

    // Safe delay slider
    const delaySlider = container.querySelector('#input-delay-slider');
    if (delaySlider) {
      delaySlider.addEventListener('input', (e) => {
        this.delaySeconds = parseInt(e.target.value, 10);
        const label = container.querySelector('#input-delay-slider').previousElementSibling.querySelector('span');
        if (label) label.textContent = `${this.delaySeconds}s`;
      });
    }

    // Regenerate all messages
    const regenBtn = container.querySelector('#btn-generate-all-previews');
    if (regenBtn) {
      regenBtn.addEventListener('click', () => {
        this.generateAllMessages(container);
        Toast.success('Regenerated personalized messages for all contacts!');
      });
    }

    // Preview button on rows
    const previewBtns = container.querySelectorAll('.btn-preview-msg');
    previewBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.getAttribute('data-idx'), 10);
        this.previewModalItem = this.recipients[idx];
        this.render(container);
      });
    });

    // Send single button on rows
    const sendSingleBtns = container.querySelectorAll('.btn-send-single');
    sendSingleBtns.forEach(btn => {
      btn.addEventListener('click', async () => {
        const idx = parseInt(btn.getAttribute('data-idx'), 10);
        const item = this.recipients[idx];
        await this.dispatchSingleItem(item, container);
      });
    });

    // Start full automated broadcast
    const startBroadcastBtn = container.querySelector('#btn-start-broadcast');
    if (startBroadcastBtn) {
      startBroadcastBtn.addEventListener('click', () => {
        this.startAutomatedBroadcast(container);
      });
    }

    // Modal Events
    const closeModalBtn = container.querySelector('#btn-close-modal');
    const modalCancelBtn = container.querySelector('#btn-modal-cancel');
    const closeFn = () => {
      this.previewModalItem = null;
      this.render(container);
    };
    if (closeModalBtn) closeModalBtn.addEventListener('click', closeFn);
    if (modalCancelBtn) modalCancelBtn.addEventListener('click', closeFn);

    const modalDirectBtn = container.querySelector('#btn-open-wa-direct');
    if (modalDirectBtn && this.previewModalItem) {
      modalDirectBtn.addEventListener('click', () => {
        const item = this.previewModalItem;
        const msg = container.querySelector('#modal-msg-textarea')?.value || item._generatedMessage;
        const cleanPhone = item.Phone.replace(/[^\d]/g, '');
        window.open(`https://web.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(msg)}`, '_blank');
        item._status = 'Sent';
        closeFn();
      });
    }

    const modalSendBtn = container.querySelector('#btn-modal-send');
    if (modalSendBtn && this.previewModalItem) {
      modalSendBtn.addEventListener('click', async () => {
        const item = this.previewModalItem;
        const msg = container.querySelector('#modal-msg-textarea')?.value || item._generatedMessage;
        item._generatedMessage = msg;
        closeFn();
        await this.dispatchSingleItem(item, container);
      });
    }
  }

  loadCsvString(csvText) {
    const lines = csvText.split(/\r?\n/).filter(l => l.trim().length > 0);
    if (lines.length < 2) return;

    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    const rows = [];

    for (let i = 1; i < lines.length; i++) {
      const values = [];
      let inQuotes = false;
      let curr = '';
      const line = lines[i];

      for (let c = 0; c < line.length; c++) {
        const char = line[c];
        if (char === '"' && (c === 0 || line[c - 1] !== '\\')) {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          values.push(curr.trim().replace(/^"|"$/g, ''));
          curr = '';
        } else {
          curr += char;
        }
      }
      values.push(curr.trim().replace(/^"|"$/g, ''));

      if (values.length >= headers.length) {
        const obj = {};
        headers.forEach((h, idx) => {
          obj[h] = values[idx] || '';
        });
        obj._status = 'Pending';
        obj._generatedMessage = this.craftMessage(obj);
        rows.push(obj);
      }
    }

    this.recipients = rows;
  }

  craftMessage(item) {
    const agent = storage.getAllAgents().find(a => a.id === this.selectedAgentId) || storage.getAgents()[0];
    const agentName = agent?.name || 'Care Coordinator';
    const name = item.Name || 'Sir/Madam';
    const due = item.DueAmount || 'your pending balance';
    const date = item.DueDate || 'soon';
    const service = item.Service || item.Notes || 'services';

    let isHindi = false;
    if (this.campaignLanguage === 'hi') isHindi = true;
    else if (this.campaignLanguage === 'en') isHindi = false;
    else {
      // Auto: check item language column or country code
      isHindi = (item.Language?.toLowerCase().includes('hi') || item.Phone?.startsWith('+91') || item.Phone?.startsWith('91'));
    }

    if (this.campaignTone === 'urgent') {
      return isHindi
        ? `नमस्ते ${name} जी, मैं ${agentName} बोल रही हूँ। यह एक महत्वपूर्ण सूचना है कि आपका ${service} का ₹${due.replace(/[^\d,]/g, '')} का बिल ${date} को देय है। कृपया अनावश्यक पेनल्टी से बचने के लिए इसे समय पर भुगतान करें। भुगतान या सहायता के लिए यहाँ रिप्लाई करें।`
        : `Urgent Reminder from ${agentName}: Hello ${name}, your outstanding balance of ${due} for ${service} is due on ${date}. Please settle today to avoid late fees. Reply directly here if you need any assistance!`;
    }

    if (this.campaignTone === 'settlement') {
      return isHindi
        ? `नमस्ते ${name} जी, मैं ${agentName}। आपके ${service} खाते के लिए ₹${due.replace(/[^\d,]/g, '')} का बिल लंबित है। आज भुगतान करने पर या सुविधाजनक किश्तों में बाँटने के लिए हम विशेष सहायता दे रहे हैं। क्या हम इस पर बात कर सकते हैं?`
        : `Hello ${name}, this is ${agentName}. We have a flexible payment arrangement available for your outstanding balance of ${due} for ${service}. Please reply to this message to explore installment options.`;
    }

    if (this.campaignTone === 'appointment') {
      return isHindi
        ? `नमस्ते ${name} जी, मैं ${agentName}। आपका ${service} का अपॉइंटमेंट ${date} के लिए निर्धारित है। बकाया शुल्क ₹${due.replace(/[^\d,]/g, '')} है। क्या आप इस समय की पुष्टि करना चाहेंगे?`
        : `Hello ${name}! This is ${agentName} confirming your upcoming ${service} appointment scheduled for ${date}. Outstanding fee is ${due}. Reply "YES" to confirm or let us know if you need to reschedule!`;
    }

    // Default Friendly
    return isHindi
      ? `नमस्ते ${name} जी! मैं ${agentName}। एक विनम्र सूचना कि आपका ${service} का ₹${due.replace(/[^\d,]/g, '')} का बिल ${date} तक देय है। आप यहाँ रिप्लाई करके भी भुगतान लिंक प्राप्त कर सकते हैं। धन्यवाद!`
      : `Hello ${name}! This is ${agentName}. Just a friendly reminder that your invoice for ${service} (${due}) is due on ${date}. Let us know if you have any questions or need a quick payment link!`;
  }

  generateAllMessages(container) {
    this.recipients.forEach(r => {
      r._generatedMessage = this.craftMessage(r);
    });
    this.render(container);
  }

  async dispatchSingleItem(item, container) {
    item._status = 'Sending...';
    this.render(container);

    try {
      if (this.gatewayStatus === 'online') {
        const res = await fetch('http://127.0.0.1:5058/api/outbound/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: item.Phone, message: item._generatedMessage, name: item.Name })
        });
        const data = await res.json();
        if (res.ok && data.success) {
          item._status = 'Sent';
          Toast.success(`Message sent to ${item.Name} (+${item.Phone})!`);
        } else {
          item._status = 'Failed';
          Toast.error(data.error || 'Failed to dispatch message');
        }
      } else {
        // Fallback to direct WhatsApp Web URL
        const clean = item.Phone.replace(/[^\d]/g, '');
        window.open(`https://web.whatsapp.com/send?phone=${clean}&text=${encodeURIComponent(item._generatedMessage)}`, '_blank');
        item._status = 'Sent';
        Toast.success(`Opened WhatsApp Web chat for ${item.Name}!`);
      }
    } catch (err) {
      item._status = 'Failed';
      Toast.error(`Dispatch error: ${err.message}`);
    }

    this.render(container);
  }

  async startAutomatedBroadcast(container) {
    if (this.isDispatching) return;
    this.isDispatching = true;
    this.dispatchProgress = { current: 0, total: this.recipients.length, sent: 0, failed: 0 };
    this.render(container);

    Toast.info(`🚀 Starting outbound campaign for ${this.recipients.length} contacts...`);

    for (let i = 0; i < this.recipients.length; i++) {
      const item = this.recipients[i];
      this.dispatchProgress.current = i + 1;
      item._status = 'Sending...';
      this.render(container);

      try {
        if (this.gatewayStatus === 'online') {
          const res = await fetch('http://127.0.0.1:5058/api/outbound/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone: item.Phone, message: item._generatedMessage, name: item.Name })
          });
          const data = await res.json();
          if (res.ok && data.success) {
            item._status = 'Sent';
            this.dispatchProgress.sent++;
          } else {
            item._status = 'Failed';
            this.dispatchProgress.failed++;
          }
        } else {
          // In 1-click mode, open first one or notify
          const clean = item.Phone.replace(/[^\d]/g, '');
          window.open(`https://web.whatsapp.com/send?phone=${clean}&text=${encodeURIComponent(item._generatedMessage)}`, '_blank');
          item._status = 'Sent';
          this.dispatchProgress.sent++;
        }
      } catch (e) {
        item._status = 'Failed';
        this.dispatchProgress.failed++;
      }

      this.render(container);

      if (i < this.recipients.length - 1) {
        await new Promise(r => setTimeout(r, this.delaySeconds * 1000));
      }
    }

    this.isDispatching = false;
    Toast.success(`Campaign completed! Sent: ${this.dispatchProgress.sent}, Failed: ${this.dispatchProgress.failed}`);
    this.render(container);
  }

  getStatusBadgeClass(status) {
    if (status === 'Sent') return 'success';
    if (status === 'Sending...') return 'warning';
    if (status === 'Failed') return 'danger';
    return 'neutral';
  }

  escapeHtml(str) {
    return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
}
