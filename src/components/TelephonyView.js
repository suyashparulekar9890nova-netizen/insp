import { storage } from '../services/storage.js';
import { Toast } from './Toast.js';

export class TelephonyView {
  constructor(options = {}) {
    this.activeTab = 'inbound'; // 'inbound' or 'outbound'
    this.onSimulateCall = options.onSimulateCall || (() => {});
    this.onTriggerRing = options.onTriggerRing || (() => {});
  }

  render(container) {
    const ws = storage.getActiveWorkspace();
    const phoneNumbers = storage.getPhoneNumbers();
    const campaigns = storage.getCampaigns();
    const agents = storage.getAgents();

    container.innerHTML = `
      <div class="view-header">
        <div class="view-title-group">
          <h1>Telephony & Call Automation Studio</h1>
          <p>Carrier SIP trunking (Twilio, Vonage, Plivo), inbound DID assignment, and outbound CSV batch campaigns</p>
        </div>
        <div style="display: flex; gap: 0.65rem;">
          <button class="btn-secondary" id="btn-provision-number">+ Buy / Provision Number</button>
          <button class="btn-primary" id="btn-create-campaign">🚀 New Outbound Campaign</button>
        </div>
      </div>

      <!-- Navigation Tabs -->
      <div class="tabs-nav">
        <button class="tab-btn ${this.activeTab === 'inbound' ? 'active' : ''}" id="tab-inbound-numbers">
          📞 Inbound Phone Numbers (${phoneNumbers.length})
        </button>
        <button class="tab-btn ${this.activeTab === 'outbound' ? 'active' : ''}" id="tab-outbound-campaigns">
          🚀 Outbound Calling Campaigns (${campaigns.length})
        </button>
      </div>

      ${this.activeTab === 'inbound' ? this.renderInboundTab(ws, phoneNumbers, agents) : this.renderOutboundTab(ws, campaigns, agents, phoneNumbers)}

      <!-- Modals injected dynamically -->
      <div id="telephony-modal-container"></div>
    `;

    this.attachEvents(container, ws, agents, phoneNumbers);
  }

  renderInboundTab(ws, phoneNumbers, agents) {
    const assignedWhatsAppAgent = storage.getWhatsAppAssignedAgent();
    return `
      <!-- SIP Webhook Callout Card -->
      <div class="card-panel" style="background: rgba(99, 102, 241, 0.05); border-color: rgba(99, 102, 241, 0.25);">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
          <div>
            <div style="font-weight: 700; color: var(--text-main); font-size: 0.95rem; display: flex; align-items: center; gap: 0.4rem;">
              <span>🌐</span>
              <span>Twilio / SIP Voice Webhook Endpoint</span>
            </div>
            <div style="font-size: 0.78rem; color: var(--text-muted); margin-top: 0.2rem;">
              Configure your carrier phone number's "A Call Comes In" webhook to this URL:
            </div>
            <div style="font-family: var(--font-mono); font-size: 0.8rem; background: var(--bg-darkest); padding: 0.4rem 0.75rem; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle); color: var(--cyan-400); margin-top: 0.4rem; display: inline-block;">
              https://telephony.inspirus.ai/webhook/v1/inbound/${ws.id}
            </div>
          </div>
          <button class="btn-secondary" id="btn-copy-webhook" style="font-size: 0.78rem;">
            📋 Copy Webhook URL
          </button>
        </div>
      </div>

      <!-- WhatsApp Voice Auto-Receptionist Card (Live Connected Telephony) -->
      <div class="card-panel" style="background: radial-gradient(circle at top left, rgba(16, 185, 129, 0.12), rgba(6, 182, 212, 0.05)), #101625; border: 1px solid rgba(16, 185, 129, 0.4); margin-bottom: 1.25rem;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 1rem;">
          <div style="flex: 1; min-width: 300px;">
            <div style="font-weight: 700; color: #fff; font-size: 1rem; display: flex; align-items: center; gap: 0.5rem;">
              <span style="font-size: 1.2rem;">💬</span>
              <span>WhatsApp Voice Auto-Receptionist (Live Connected Telephony)</span>
              <span class="badge-status success" style="font-size: 0.7rem; font-family: var(--font-mono);">Hardware WASAPI Loopback + AI Engine</span>
            </div>
            <div style="font-size: 0.78rem; color: var(--text-muted); margin-top: 0.35rem; max-width: 650px; line-height: 1.5;">
              When customers call your WhatsApp, this assigned agent automatically answers in real time, uses their full Studio persona & system prompt, executes tools, and logs full transcripts to your Call Logs!
            </div>
            <div style="display: flex; gap: 0.9rem; align-items: center; margin-top: 0.75rem; font-size: 0.8rem; color: var(--text-light); flex-wrap: wrap;">
              <div style="display: flex; align-items: center; gap: 0.4rem;">
                <label for="select-whatsapp-agent" style="font-weight: 700; color: var(--text-light);">Assigned Agent:</label>
                <select id="select-whatsapp-agent" class="form-select" style="padding: 0.3rem 0.65rem; font-size: 0.8rem; background: var(--bg-darkest); color: var(--text-main); border: 1px solid var(--border-medium); border-radius: 6px;">
                  ${storage.getAllAgents().map(a => `<option value="${a.id}" ${a.id === assignedWhatsAppAgent.id ? 'selected' : ''}>${a.avatar || '🤖'} ${a.name}</option>`).join('')}
                </select>
              </div>
              <span>•</span>
              <span><strong>Voice:</strong> <span style="color: var(--cyan-400);">${assignedWhatsAppAgent.voiceName || 'Auto Neural'}</span></span>
              <span>•</span>
              <span><strong>Status:</strong> <span style="color: #34d399; font-weight: 600;">● Active & Ready</span></span>
            </div>
          </div>
          <div style="display: flex; flex-direction: column; gap: 0.4rem; align-items: flex-end;">
            <div style="font-family: var(--font-mono); font-size: 0.74rem; background: var(--bg-darkest); padding: 0.4rem 0.75rem; border-radius: var(--radius-sm); border: 1px solid var(--border-medium); color: #34d399;">
              npm run whatsapp:start
            </div>
            <span style="font-size: 0.7rem; color: var(--text-dim);">Telephony Gateway & Loopback Listener</span>
          </div>
        </div>
      </div>

      <!-- Numbers Table -->
      <div class="card-panel">
        <div class="card-panel-header">
          <div class="card-panel-title">
            <span>📱</span>
            <span>Provisioned Inbound Numbers</span>
          </div>
        </div>

        <div class="data-table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Phone Number</th>
                <th>Type & Label</th>
                <th>Assigned AI Agent</th>
                <th>Inbound Routing Rule</th>
                <th>Carrier / SIP</th>
                <th>Total Calls</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${phoneNumbers.map(num => {
                const assignedAgent = agents.find(a => a.id === num.assignedAgentId);
                return `
                  <tr>
                    <td>
                      <div style="font-family: var(--font-mono); font-weight: 700; color: var(--cyan-400);">${num.phoneNumber}</div>
                      <div style="font-size: 0.72rem; color: var(--text-dim);">${num.type}</div>
                    </td>
                    <td>
                      <div style="font-weight: 600;">${num.label}</div>
                      <div style="font-size: 0.72rem; color: var(--text-muted);">${num.businessHours}</div>
                    </td>
                    <td>
                      <div style="font-weight: 600; color: var(--text-main);">${assignedAgent ? assignedAgent.name : 'Unassigned'}</div>
                      <div style="font-size: 0.72rem; color: var(--text-dim);">${assignedAgent ? assignedAgent.role : 'None'}</div>
                    </td>
                    <td>
                      <span class="badge-status success">${num.inboundRouting}</span>
                    </td>
                    <td>
                      <div style="font-size: 0.8rem; font-weight: 600;">${num.provider}</div>
                      <div style="font-size: 0.72rem; color: var(--text-dim);">${num.monthlyCost}</div>
                    </td>
                    <td style="font-family: var(--font-mono);">${num.totalCallsReceived.toLocaleString()}</td>
                    <td>
                      <button class="btn-secondary btn-test-inbound-dial" data-number="${num.phoneNumber}" data-agent-id="${num.assignedAgentId}" style="padding: 0.25rem 0.6rem; font-size: 0.75rem;">
                        📞 Test Call
                      </button>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  renderOutboundTab(ws, campaigns, agents, phoneNumbers) {
    return `
      <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 1.25rem;">
        <!-- Left: Active Outbound Campaigns -->
        <div>
          <div class="card-panel">
            <div class="card-panel-header">
              <div class="card-panel-title">
                <span>📢</span>
                <span>Active Outbound Batches</span>
              </div>
            </div>

            <div style="display: flex; flex-direction: column; gap: 1rem;">
              ${campaigns.map(camp => {
                const agent = agents.find(a => a.id === camp.assignedAgentId);
                return `
                  <div style="background: var(--bg-darkest); border: 1px solid var(--border-medium); border-radius: var(--radius-lg); padding: 1.25rem;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.6rem;">
                      <div>
                        <div style="font-size: 1.05rem; font-weight: 700; color: var(--text-main);">${camp.name}</div>
                        <div style="font-size: 0.76rem; color: var(--text-muted); margin-top: 0.2rem;">
                          Using Bot: <strong style="color: var(--cyan-400);">${agent?.name || 'Voice Assistant'}</strong> • Caller ID: <span style="font-family: var(--font-mono);">${camp.callerId}</span>
                        </div>
                      </div>
                      <span class="badge-status ${camp.status === 'Running' ? 'warning' : 'success'}">${camp.status}</span>
                    </div>

                    <!-- Progress bar -->
                    <div style="margin: 0.75rem 0 0.5rem;">
                      <div style="display: flex; justify-content: space-between; font-size: 0.74rem; color: var(--text-dim); margin-bottom: 0.25rem;">
                        <span>Progress (${camp.callsPlaced} / ${camp.totalContacts} calls)</span>
                        <span style="font-family: var(--font-mono); font-weight: 700; color: var(--cyan-400);">${camp.progress}%</span>
                      </div>
                      <div style="width: 100%; height: 6px; background: var(--bg-elevated); border-radius: 3px; overflow: hidden;">
                        <div style="width: ${camp.progress}%; height: 100%; background: linear-gradient(90deg, var(--indigo-500), var(--cyan-400));"></div>
                      </div>
                    </div>

                    <!-- Campaign Stats -->
                    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.5rem; background: var(--bg-card); padding: 0.65rem; border-radius: var(--radius-md); font-size: 0.75rem; text-align: center; margin-top: 0.85rem;">
                      <div>
                        <div style="color: var(--text-dim);">Answered</div>
                        <div style="font-weight: 700; color: var(--text-main); font-size: 0.95rem;">${camp.callsAnswered}</div>
                      </div>
                      <div>
                        <div style="color: var(--text-dim);">Booked / Converted</div>
                        <div style="font-weight: 700; color: var(--emerald-400); font-size: 0.95rem;">${camp.appointmentsBooked}</div>
                      </div>
                      <div>
                        <div style="color: var(--text-dim);">Escalated</div>
                        <div style="font-weight: 700; color: var(--amber-400); font-size: 0.95rem;">${camp.escalatedToStaff}</div>
                      </div>
                      <div>
                        <div style="color: var(--text-dim);">CSV Source</div>
                        <div style="font-weight: 600; color: var(--cyan-400); font-size: 0.72rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${camp.csvFileName}</div>
                      </div>
                    </div>

                    <div style="display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 0.85rem; flex-wrap: wrap;">
                      <button class="btn-primary btn-ring-my-device" data-camp-id="${camp.id}" data-agent-id="${camp.assignedAgentId}" style="background: linear-gradient(135deg, #10b981, #059669); border-color: #34d399; font-size: 0.76rem; padding: 0.3rem 0.75rem; box-shadow: 0 0 10px rgba(16, 185, 129, 0.3);" title="Experience this campaign as an incoming web call on your device">
                        <span>🔔</span>
                        <span>Test Ring My Device</span>
                      </button>
                      <button class="btn-secondary btn-simulate-batch-dial" data-camp-id="${camp.id}" style="font-size: 0.76rem; padding: 0.3rem 0.75rem;">
                        ▶ Run Progressive Dial
                      </button>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        </div>

        <!-- Right: Outbound API Trigger Documentation -->
        <div>
          <div class="card-panel">
            <div class="card-panel-header">
              <div class="card-panel-title">
                <span>⚡</span>
                <span>Programmatic API Trigger</span>
              </div>
            </div>

            <div style="font-size: 0.78rem; color: var(--text-muted); margin-bottom: 0.75rem;">
              Trigger instantaneous outbound voice calls from HubSpot, Salesforce, or your custom backend via REST API:
            </div>

            <div style="background: var(--bg-darkest); border: 1px solid var(--border-medium); border-radius: var(--radius-md); padding: 0.75rem; font-family: var(--font-mono); font-size: 0.72rem; color: var(--text-light); overflow-x: auto; margin-bottom: 0.85rem; line-height: 1.5;">
              <span style="color: var(--cyan-400);">curl</span> -X POST https://api.inspirus.ai/v1/calls/dispatch \\<br/>
              &nbsp;&nbsp;-H <span style="color: var(--amber-400);">"Authorization: Bearer sec_live_9941a"</span> \\<br/>
              &nbsp;&nbsp;-H <span style="color: var(--amber-400);">"Content-Type: application/json"</span> \\<br/>
              &nbsp;&nbsp;-d '{<br/>
              &nbsp;&nbsp;&nbsp;&nbsp;<span style="color: var(--emerald-400);">"to"</span>: "+14155550142",<br/>
              &nbsp;&nbsp;&nbsp;&nbsp;<span style="color: var(--emerald-400);">"agent_id"</span>: "agent-maya",<br/>
              &nbsp;&nbsp;&nbsp;&nbsp;<span style="color: var(--emerald-400);">"variables"</span>: {<br/>
              &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span style="color: var(--emerald-400);">"patient_name"</span>: "Eleanor Vance",<br/>
              &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span style="color: var(--emerald-400);">"preferred_hygienist"</span>: "Claire"<br/>
              &nbsp;&nbsp;&nbsp;&nbsp;}<br/>
              &nbsp;&nbsp;}'
            </div>

            <button class="btn-secondary" id="btn-copy-curl" style="width: 100%; justify-content: center; font-size: 0.78rem;">
              📋 Copy cURL Request
            </button>
          </div>
        </div>
      </div>
    `;
  }

  attachEvents(container, ws, agents, phoneNumbers) {
    // Tabs
    const tabInbound = container.querySelector('#tab-inbound-numbers');
    const tabOutbound = container.querySelector('#tab-outbound-campaigns');
    if (tabInbound && tabOutbound) {
      tabInbound.addEventListener('click', () => {
        this.activeTab = 'inbound';
        this.render(container);
      });
      tabOutbound.addEventListener('click', () => {
        this.activeTab = 'outbound';
        this.render(container);
      });
    }

    // Copy Webhook
    const copyHookBtn = container.querySelector('#btn-copy-webhook');
    if (copyHookBtn) {
      copyHookBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(`https://telephony.inspirus.ai/webhook/v1/inbound/${ws.id}`);
        Toast.success('Twilio Webhook URL copied to clipboard');
      });
    }

    // Copy cURL
    const copyCurlBtn = container.querySelector('#btn-copy-curl');
    if (copyCurlBtn) {
      copyCurlBtn.addEventListener('click', () => {
        const text = `curl -X POST https://api.inspirus.ai/v1/calls/dispatch -H "Authorization: Bearer sec_live_9941a" -H "Content-Type: application/json" -d '{"to": "+14155550142", "agent_id": "agent-maya", "variables": {"patient_name": "Eleanor Vance"}}'`;
        navigator.clipboard.writeText(text);
        Toast.success('API cURL code copied to clipboard');
      });
    }

    // WhatsApp Assigned Agent Change
    const selectWaAgent = container.querySelector('#select-whatsapp-agent');
    if (selectWaAgent) {
      selectWaAgent.addEventListener('change', (e) => {
        storage.setWhatsAppAssignedAgent(e.target.value);
        const updated = storage.getAgentById(e.target.value);
        Toast.success(`WhatsApp Inbound Agent updated to "${updated?.name || 'Selected Agent'}"`);
        this.render(container);
      });
    }

    // Test Inbound Dial button
    const testDialBtns = container.querySelectorAll('.btn-test-inbound-dial');
    testDialBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const agentId = btn.getAttribute('data-agent-id');
        const agent = agents.find(a => a.id === agentId) || agents[0];
        this.onSimulateCall(agent);
      });
    });

    // Run Progressive Dial simulation
    const runDialBtns = container.querySelectorAll('.btn-simulate-batch-dial');
    runDialBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        Toast.info('Progressive Outbound Dialer initiating: placing calls to batch queue...');
        setTimeout(() => {
          Toast.success('Progressive batch dial: 5 calls connected! 3 appointment confirmations logged.');
        }, 1500);
      });
    });

    // Test Ring My Device simulation for outbound campaigns
    const ringDeviceBtns = container.querySelectorAll('.btn-ring-my-device');
    ringDeviceBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const agentId = btn.getAttribute('data-agent-id');
        const campId = btn.getAttribute('data-camp-id');
        const camp = (storage.getCampaigns() || []).find(c => c.id === campId);
        const agent = agents.find(a => a.id === agentId) || agents[0];
        this.onTriggerRing(agent, {
          reason: `Outbound Campaign: ${camp?.name || 'Automated Outreach'}`,
          language: agent?.language || 'hi-IN',
          initialGreeting: `Hello! This is an automated follow-up call regarding ${camp?.name || 'your appointment'}. Am I speaking with the account holder?`
        });
      });
    });

    // Provision Number Modal
    const provisionBtn = container.querySelector('#btn-provision-number');
    if (provisionBtn) {
      provisionBtn.addEventListener('click', () => {
        this.openProvisionModal(container, ws, agents);
      });
    }

    // New Campaign Modal
    const newCampBtn = container.querySelector('#btn-create-campaign');
    if (newCampBtn) {
      newCampBtn.addEventListener('click', () => {
        this.openCampaignModal(container, ws, agents, phoneNumbers);
      });
    }
  }

  openProvisionModal(container, ws, agents) {
    const modalHost = container.querySelector('#telephony-modal-container');
    modalHost.innerHTML = `
      <div class="call-modal-overlay open" id="modal-provision">
        <div class="call-modal-content" style="max-width: 520px;">
          <div class="call-modal-header">
            <h3 style="font-size: 1.1rem; font-weight: 700;">Buy / Provision Carrier Phone Number</h3>
            <button class="btn-secondary" id="btn-close-provision" style="padding: 0.2rem 0.5rem;">✕</button>
          </div>
          <form id="form-provision-number" style="padding: 1.5rem;">
            <div class="form-group">
              <label class="form-label">Carrier Provider</label>
              <select class="form-select" id="field-prov-provider">
                <option value="Twilio SIP">Twilio SIP Trunking (US-East)</option>
                <option value="Vonage Voice API">Vonage Voice API</option>
                <option value="Plivo SIP">Plivo Global Telephony</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Number Type</label>
              <select class="form-select" id="field-prov-type">
                <option value="Toll-Free (US/CA 888/800)">Toll-Free (US/CA 888 / 800)</option>
                <option value="Local Direct (DID)">Local Direct (San Francisco, New York, Chicago)</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Phone Label / Friendly Name</label>
              <input type="text" class="form-input" id="field-prov-label" placeholder="e.g. VIP Concierge Line" required />
            </div>
            <div class="form-group">
              <label class="form-label">Assign to Voice Bot</label>
              <select class="form-select" id="field-prov-agent">
                ${agents.map(a => `<option value="${a.id}">${a.name}</option>`).join('')}
              </select>
            </div>
            <div style="display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1.25rem;">
              <button type="button" class="btn-secondary" id="btn-cancel-provision">Cancel</button>
              <button type="submit" class="btn-primary">Provision Number ($1.50/mo)</button>
            </div>
          </form>
        </div>
      </div>
    `;

    const close = () => { modalHost.innerHTML = ''; };
    modalHost.querySelector('#btn-close-provision').addEventListener('click', close);
    modalHost.querySelector('#btn-cancel-provision').addEventListener('click', close);

    modalHost.querySelector('#form-provision-number').addEventListener('submit', (e) => {
      e.preventDefault();
      const randDid = `+1 (${Math.floor(200 + Math.random() * 700)}) ${Math.floor(200 + Math.random() * 800)}-${Math.floor(1000 + Math.random() * 9000)}`;
      const newNum = {
        id: `num-${Date.now()}`,
        workspaceId: ws.id,
        phoneNumber: randDid,
        type: modalHost.querySelector('#field-prov-type').value,
        provider: modalHost.querySelector('#field-prov-provider').value,
        label: modalHost.querySelector('#field-prov-label').value,
        assignedAgentId: modalHost.querySelector('#field-prov-agent').value,
        status: 'Active',
        capabilities: ['Voice', 'SMS'],
        inboundRouting: 'Direct to Bot',
        businessHours: '24/7 Always Open',
        monthlyCost: '$1.50/mo',
        totalCallsReceived: 0
      };

      storage.savePhoneNumber(newNum);
      Toast.success(`Provisioned ${newNum.phoneNumber} successfully!`);
      close();
      this.render(container);
    });
  }

  openCampaignModal(container, ws, agents, phoneNumbers) {
    const modalHost = container.querySelector('#telephony-modal-container');
    modalHost.innerHTML = `
      <div class="call-modal-overlay open" id="modal-campaign">
        <div class="call-modal-content" style="max-width: 640px;">
          <div class="call-modal-header">
            <h3 style="font-size: 1.1rem; font-weight: 700;">Launch Outbound Voice Campaign</h3>
            <button class="btn-secondary" id="btn-close-camp" style="padding: 0.2rem 0.5rem;">✕</button>
          </div>
          <form id="form-create-campaign" style="padding: 1.5rem;">
            <div class="form-group">
              <label class="form-label">Campaign Name</label>
              <input type="text" class="form-input" id="field-camp-name" placeholder="e.g. November Hygiene Recall & Follow-ups" required />
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
              <div class="form-group">
                <label class="form-label">Assigned Voice Agent</label>
                <select class="form-select" id="field-camp-agent">
                  ${agents.map(a => `<option value="${a.id}">${a.name}</option>`).join('')}
                </select>
              </div>

              <div class="form-group">
                <label class="form-label">Outbound Caller ID</label>
                <select class="form-select" id="field-camp-callerid">
                  ${phoneNumbers.map(n => `<option value="${n.phoneNumber}">${n.phoneNumber} (${n.label})</option>`).join('')}
                </select>
              </div>
            </div>

            <!-- CSV Upload Section -->
            <div class="form-group">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.4rem;">
                <label class="form-label" style="margin-bottom: 0;">Upload Contact List (CSV)</label>
                <button type="button" class="btn-secondary" id="btn-download-sample-csv" style="font-size: 0.72rem; padding: 0.15rem 0.5rem;">
                  📥 Download Sample CSV
                </button>
              </div>

              <div style="border: 2px dashed var(--border-medium); border-radius: var(--radius-md); padding: 1.25rem; text-align: center; background: var(--bg-darkest); cursor: pointer;" id="csv-drop-zone">
                <div style="font-size: 1.8rem; margin-bottom: 0.3rem;">📄</div>
                <div style="font-size: 0.85rem; font-weight: 600; color: var(--text-main);" id="csv-filename-display">
                  Click to choose or drag & drop contact CSV file
                </div>
                <div style="font-size: 0.72rem; color: var(--text-dim); margin-top: 0.25rem;">
                  Requires columns: <code>phone_number</code>, <code>customer_name</code>
                </div>
                <input type="file" id="field-camp-csv-file" accept=".csv" style="display: none;" />
              </div>

              <!-- Preview of parsed columns -->
              <div id="csv-preview-container" style="display: none; margin-top: 0.6rem; padding: 0.65rem; background: var(--bg-elevated); border-radius: var(--radius-sm); font-size: 0.75rem;">
                <span style="color: var(--emerald-400); font-weight: 700;">✓ CSV Parsed:</span>
                <span id="csv-preview-text" style="color: var(--text-light); margin-left: 4px;">45 contacts detected with variable tags.</span>
              </div>
            </div>

            <div style="display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1.25rem;">
              <button type="button" class="btn-secondary" id="btn-cancel-camp">Cancel</button>
              <button type="submit" class="btn-primary">Launch Campaign Dialer</button>
            </div>
          </form>
        </div>
      </div>
    `;

    const close = () => { modalHost.innerHTML = ''; };
    modalHost.querySelector('#btn-close-camp').addEventListener('click', close);
    modalHost.querySelector('#btn-cancel-camp').addEventListener('click', close);

    const dropZone = modalHost.querySelector('#csv-drop-zone');
    const fileInput = modalHost.querySelector('#field-camp-csv-file');
    const filenameDisplay = modalHost.querySelector('#csv-filename-display');
    const previewContainer = modalHost.querySelector('#csv-preview-container');

    dropZone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => {
      if (fileInput.files.length > 0) {
        const file = fileInput.files[0];
        filenameDisplay.textContent = `Selected: ${file.name} (${Math.round(file.size / 1024)} KB)`;
        previewContainer.style.display = 'block';
      }
    });

    modalHost.querySelector('#btn-download-sample-csv').addEventListener('click', () => {
      const csvContent = "data:text/csv;charset=utf-8,phone_number,patient_name,appointment_date,service\n+14155550142,Eleanor Vance,2026-10-22,Cleaning\n+14155550189,Robert Morales,2026-10-23,Checkup\n+14155550211,Sophia Zhang,2026-10-24,Whitening";
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", "sample_patient_recall_contacts.csv");
      document.body.appendChild(link);
      link.click();
      link.remove();
      Toast.success('Downloaded sample CSV template');
    });

    modalHost.querySelector('#form-create-campaign').addEventListener('submit', (e) => {
      e.preventDefault();
      const newCamp = {
        id: `camp-${Date.now()}`,
        workspaceId: ws.id,
        name: modalHost.querySelector('#field-camp-name').value,
        type: 'Outbound Batch',
        assignedAgentId: modalHost.querySelector('#field-camp-agent').value,
        status: 'Running',
        progress: 15,
        totalContacts: 60,
        callsPlaced: 9,
        callsAnswered: 8,
        appointmentsBooked: 5,
        escalatedToStaff: 1,
        callerId: modalHost.querySelector('#field-camp-callerid').value,
        csvFileName: fileInput.files[0]?.name || 'uploaded_contacts.csv',
        createdAt: new Date().toISOString()
      };

      storage.saveCampaign(newCamp);
      Toast.success(`Campaign "${newCamp.name}" launched on automated dialer!`);
      close();
      this.render(container);
    });
  }
}
