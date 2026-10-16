import { storage } from '../services/storage.js';
import { Toast } from './Toast.js';

export class ToolsIntegrationsView {
  constructor() {
    this.selectedToolForTestId = null;
    this.testOutputJson = null;
  }

  render(container) {
    const ws = storage.getActiveWorkspace();
    const tools = storage.getTools();
    const crmSettings = storage.getCrmSettings();

    if (!this.selectedToolForTestId && tools.length > 0) {
      this.selectedToolForTestId = tools[0].id;
    }

    const activeTestTool = tools.find(t => t.id === this.selectedToolForTestId) || tools[0];

    container.innerHTML = `
      <div class="view-header">
        <div class="view-title-group">
          <h1>Real-Time Tools & CRM Integrations</h1>
          <p>Function calling definitions, webhook endpoints, and bidirectional synchronization with HubSpot, Salesforce, and Zendesk</p>
        </div>
        <div>
          <button class="btn-primary" id="btn-add-custom-tool">+ Create Custom Webhook Tool</button>
        </div>
      </div>

      <!-- Top CRM Connection Cards -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
        <!-- HubSpot -->
        <div class="card-panel" style="margin-bottom: 0; background: var(--bg-card); border-color: ${crmSettings.hubspot?.connected ? 'rgba(16, 185, 129, 0.3)' : 'var(--border-subtle)'};">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.6rem;">
            <div style="font-weight: 700; font-size: 0.95rem; color: var(--text-main); display: flex; align-items: center; gap: 0.4rem;">
              <span>🟠</span>
              <span>HubSpot CRM</span>
            </div>
            <span class="badge-status ${crmSettings.hubspot?.connected ? 'success' : 'warning'}">
              ${crmSettings.hubspot?.connected ? 'Active Sync' : 'Disconnected'}
            </span>
          </div>
          <div style="font-size: 0.74rem; color: var(--text-muted); margin-bottom: 0.6rem;">
            Pushes call summaries, transcripts, and auto-created deals into HubSpot.
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 0.72rem; color: var(--text-dim); border-top: 1px solid var(--border-subtle); padding-top: 0.4rem;">
            <span>Last Sync: 10m ago</span>
            <span style="color: var(--cyan-400); cursor: pointer;" id="btn-toggle-hubspot">Configure</span>
          </div>
        </div>

        <!-- Salesforce -->
        <div class="card-panel" style="margin-bottom: 0; background: var(--bg-card); border-color: ${crmSettings.salesforce?.connected ? 'rgba(16, 185, 129, 0.3)' : 'var(--border-subtle)'};">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.6rem;">
            <div style="font-weight: 700; font-size: 0.95rem; color: var(--text-main); display: flex; align-items: center; gap: 0.4rem;">
              <span>☁️</span>
              <span>Salesforce</span>
            </div>
            <span class="badge-status ${crmSettings.salesforce?.connected ? 'success' : 'warning'}">
              ${crmSettings.salesforce?.connected ? 'Active Sync' : 'Ready to Connect'}
            </span>
          </div>
          <div style="font-size: 0.74rem; color: var(--text-muted); margin-bottom: 0.6rem;">
            Enterprise Service Cloud contact record creation and lead progression.
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 0.72rem; color: var(--text-dim); border-top: 1px solid var(--border-subtle); padding-top: 0.4rem;">
            <span>OAuth 2.0</span>
            <span style="color: var(--cyan-400); cursor: pointer;" id="btn-toggle-salesforce">${crmSettings.salesforce?.connected ? 'Disconnect' : 'Connect'}</span>
          </div>
        </div>

        <!-- Zendesk -->
        <div class="card-panel" style="margin-bottom: 0; background: var(--bg-card); border-color: ${crmSettings.zendesk?.connected ? 'rgba(16, 185, 129, 0.3)' : 'var(--border-subtle)'};">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.6rem;">
            <div style="font-weight: 700; font-size: 0.95rem; color: var(--text-main); display: flex; align-items: center; gap: 0.4rem;">
              <span>🟢</span>
              <span>Zendesk Support</span>
            </div>
            <span class="badge-status ${crmSettings.zendesk?.connected ? 'success' : 'warning'}">
              ${crmSettings.zendesk?.connected ? 'Active' : 'Offline'}
            </span>
          </div>
          <div style="font-size: 0.74rem; color: var(--text-muted); margin-bottom: 0.6rem;">
            Automatically files priority support tickets on human handoff escalation.
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 0.72rem; color: var(--text-dim); border-top: 1px solid var(--border-subtle); padding-top: 0.4rem;">
            <span>Subdomain: dentalcare-help</span>
            <span style="color: var(--cyan-400); cursor: pointer;" id="btn-toggle-zendesk">Manage</span>
          </div>
        </div>
      </div>

      <!-- Main Layout: Registered Tools & Interactive Dry-Run Console -->
      <div style="display: grid; grid-template-columns: 1.3fr 1fr; gap: 1.5rem;">
        <!-- Left: Function Calling Registry -->
        <div class="card-panel" style="margin-bottom: 0;">
          <div class="card-panel-header">
            <div class="card-panel-title">
              <span>⚡</span>
              <span>Registered Mid-Call Tools (${tools.length})</span>
            </div>
          </div>

          <div style="display: flex; flex-direction: column; gap: 0.85rem;">
            ${tools.map(tool => `
              <div style="background: var(--bg-darkest); border: 1px solid var(--border-medium); border-radius: var(--radius-md); padding: 1rem; cursor: pointer; transition: all 0.15s ease;" class="tool-list-row ${tool.id === activeTestTool?.id ? 'active-tool-row' : ''}" data-tool-id="${tool.id}">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem;">
                  <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <span style="font-size: 0.7rem; font-weight: 700; padding: 0.15rem 0.4rem; border-radius: 4px; background: var(--bg-elevated); color: var(--cyan-400); font-family: var(--font-mono);">${tool.method || 'POST'}</span>
                    <span style="font-family: var(--font-mono); font-size: 0.88rem; font-weight: 700; color: var(--text-main);">${tool.name}</span>
                  </div>
                  <span style="font-size: 0.72rem; color: var(--text-dim);">${tool.category}</span>
                </div>
                <div style="font-size: 0.76rem; color: var(--text-muted); margin-bottom: 0.45rem;">
                  ${tool.description}
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.72rem; color: var(--text-dim);">
                  <span style="font-family: var(--font-mono);">${tool.parameters ? tool.parameters.length : 0} Parameters defined</span>
                  <button class="btn-secondary btn-select-dryrun" data-tool-id="${tool.id}" style="padding: 0.15rem 0.55rem; font-size: 0.72rem;">
                    Select for Dry Run →
                  </button>
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Right: Interactive Live Tool Dry-Run Tester -->
        <div class="card-panel" style="margin-bottom: 0;">
          <div class="card-panel-header">
            <div class="card-panel-title">
              <span>🧪</span>
              <span>Live Tool Dry-Run Tester</span>
            </div>
            <span class="badge-status info">${activeTestTool?.name || 'No tool'}</span>
          </div>

          <div style="font-size: 0.78rem; color: var(--text-muted); margin-bottom: 0.85rem;">
            Test the live function calling endpoint with mock caller parameters and verify JSON response:
          </div>

          <form id="dry-run-form">
            <div style="background: var(--bg-darkest); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 0.85rem; margin-bottom: 0.85rem;">
              <div style="font-size: 0.72rem; text-transform: uppercase; color: var(--text-dim); font-weight: 700; margin-bottom: 0.5rem;">
                Parameter Inputs (JSON Schema)
              </div>

              ${(activeTestTool?.parameters || []).map(param => `
                <div class="form-group" style="margin-bottom: 0.6rem;">
                  <label class="form-label" style="font-size: 0.75rem; margin-bottom: 0.2rem;">
                    <code>${param.name}</code> (${param.type})${param.required ? ' <span style="color: var(--rose-500);">*</span>' : ''}
                  </label>
                  <input type="text" class="form-input dry-run-param-input" data-param-name="${param.name}" value="${this.getDefaultParamVal(param.name)}" style="font-size: 0.78rem; padding: 0.4rem 0.65rem;" />
                  <div style="font-size: 0.68rem; color: var(--text-dim);">${param.description}</div>
                </div>
              `).join('')}
            </div>

            <button type="submit" class="btn-primary" style="width: 100%; justify-content: center;">
              <span>⚡</span>
              <span>Execute Live Dry Run</span>
            </button>
          </form>

          <!-- JSON Response Console -->
          <div style="margin-top: 1rem;">
            <div style="display: flex; justify-content: space-between; font-size: 0.74rem; color: var(--text-dim); margin-bottom: 0.35rem;">
              <span>Response Payload (Live Simulation)</span>
              <span style="color: var(--emerald-400); font-family: var(--font-mono);">HTTP 200 OK</span>
            </div>
            <div style="background: #060910; border: 1px solid var(--border-medium); border-radius: var(--radius-md); padding: 0.85rem; font-family: var(--font-mono); font-size: 0.74rem; color: var(--cyan-400); max-height: 200px; overflow-y: auto; white-space: pre-wrap;" id="dry-run-output">
${JSON.stringify(activeTestTool?.mockResponse || { status: 'READY_TO_RUN' }, null, 2)}
            </div>
          </div>
        </div>
      </div>

      <!-- Add Tool Modal Host -->
      <div id="tool-modal-host"></div>
    `;

    this.attachEvents(container, tools, activeTestTool);
  }

  getDefaultParamVal(paramName) {
    if (paramName.includes('patient') || paramName.includes('contact')) return 'Eleanor Vance';
    if (paramName.includes('service')) return 'Checkup & Cleaning';
    if (paramName.includes('date')) return '2026-10-22';
    if (paramName.includes('time')) return '10:30 AM';
    if (paramName.includes('tracking') || paramName.includes('load')) return 'LD-88412';
    if (paramName.includes('reason')) return 'Patient has severe toothache';
    if (paramName.includes('summary')) return 'Patient needs immediate emergency triage';
    if (paramName.includes('urgent')) return 'true';
    if (paramName.includes('assets')) return '$3,500,000';
    return 'Sample Value';
  }

  attachEvents(container, tools, activeTestTool) {
    // Select tool for dry run
    const selectBtns = container.querySelectorAll('.btn-select-dryrun, .tool-list-row');
    selectBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const toolId = btn.getAttribute('data-tool-id');
        this.selectedToolForTestId = toolId;
        this.render(container);
      });
    });

    // Execute dry run form
    const dryRunForm = container.querySelector('#dry-run-form');
    if (dryRunForm) {
      dryRunForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const outputElem = container.querySelector('#dry-run-output');
        outputElem.textContent = 'Executing webhook & resolving live parameters...';

        setTimeout(() => {
          const resp = activeTestTool?.mockResponse || { success: true, timestamp: new Date().toISOString() };
          outputElem.textContent = JSON.stringify(resp, null, 2);
          Toast.success(`Executed "${activeTestTool?.name}" successfully (HTTP 200 OK)`);
        }, 400);
      });
    }

    // Toggle CRM connectors
    const toggleSf = container.querySelector('#btn-toggle-salesforce');
    if (toggleSf) {
      toggleSf.addEventListener('click', () => {
        const crm = storage.getCrmSettings();
        crm.salesforce.connected = !crm.salesforce.connected;
        storage.saveCrmSettings(crm);
        Toast.success(crm.salesforce.connected ? 'Connected to Salesforce Service Cloud' : 'Salesforce disconnected');
        this.render(container);
      });
    }

    const toggleHubspot = container.querySelector('#btn-toggle-hubspot');
    if (toggleHubspot) {
      toggleHubspot.addEventListener('click', () => {
        Toast.info('HubSpot CRM: Active Portal #4920182 with two-way Deal & Contact synchronization');
      });
    }

    const toggleZendesk = container.querySelector('#btn-toggle-zendesk');
    if (toggleZendesk) {
      toggleZendesk.addEventListener('click', () => {
        Toast.info('Zendesk Support: Enabled for ticket escalation on Human Handoff triggers');
      });
    }

    // Add Custom Tool Modal
    const addToolBtn = container.querySelector('#btn-add-custom-tool');
    if (addToolBtn) {
      addToolBtn.addEventListener('click', () => {
        this.openAddToolModal(container);
      });
    }
  }

  openAddToolModal(container) {
    const host = container.querySelector('#tool-modal-host');
    host.innerHTML = `
      <div class="call-modal-overlay open" id="modal-add-tool">
        <div class="call-modal-content" style="max-width: 580px;">
          <div class="call-modal-header">
            <h3 style="font-size: 1.1rem; font-weight: 700;">Create Custom Webhook Tool</h3>
            <button class="btn-secondary" id="btn-close-tool-modal" style="padding: 0.2rem 0.5rem;">✕</button>
          </div>
          <form id="form-new-tool" style="padding: 1.5rem;">
            <div class="form-group">
              <label class="form-label">Function Name (snake_case)</label>
              <input type="text" class="form-input" id="field-tool-name" placeholder="e.g. check_prescription_status" required />
            </div>
            <div class="form-group">
              <label class="form-label">Category</label>
              <select class="form-select" id="field-tool-category">
                <option value="ERP & Logistics">ERP & Logistics</option>
                <option value="Calendar & Scheduling">Calendar & Scheduling</option>
                <option value="CRM & Sales">CRM & Sales</option>
                <option value="Billing & Payments">Billing & Payments</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">HTTP Method & Webhook Endpoint URL</label>
              <div style="display: flex; gap: 0.5rem;">
                <select class="form-select" id="field-tool-method" style="width: 110px;">
                  <option value="POST">POST</option>
                  <option value="GET">GET</option>
                  <option value="PUT">PUT</option>
                </select>
                <input type="url" class="form-input" id="field-tool-url" placeholder="https://api.yourcompany.com/v1/..." required />
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Description (Explains to LLM when to call this function)</label>
              <textarea class="form-textarea" id="field-tool-desc" rows="3" placeholder="Look up prescription refill eligibility and delivery status by patient ID or RX number..." required></textarea>
            </div>
            <div style="display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1.25rem;">
              <button type="button" class="btn-secondary" id="btn-cancel-new-tool">Cancel</button>
              <button type="submit" class="btn-primary">Register Tool</button>
            </div>
          </form>
        </div>
      </div>
    `;

    const close = () => { host.innerHTML = ''; };
    host.querySelector('#btn-close-tool-modal').addEventListener('click', close);
    host.querySelector('#btn-cancel-new-tool').addEventListener('click', close);

    host.querySelector('#form-new-tool').addEventListener('submit', (e) => {
      e.preventDefault();
      const newTool = {
        id: `tool-${Date.now()}`,
        workspaceId: storage.getActiveWorkspaceId(),
        name: host.querySelector('#field-tool-name').value.trim().toLowerCase().replace(/\s+/g, '_'),
        displayName: host.querySelector('#field-tool-name').value,
        category: host.querySelector('#field-tool-category').value,
        description: host.querySelector('#field-tool-desc').value,
        endpointUrl: host.querySelector('#field-tool-url').value,
        method: host.querySelector('#field-tool-method').value,
        parameters: [
          { name: "query_id", type: "string", required: true, description: "ID to query" }
        ],
        mockResponse: {
          success: true,
          status: "PROCESSED",
          result: "Data returned successfully from custom endpoint"
        }
      };

      storage.saveTool(newTool);
      Toast.success(`Tool "${newTool.name}" created and available for agents!`);
      close();
      this.selectedToolForTestId = newTool.id;
      this.render(container);
    });
  }
}
