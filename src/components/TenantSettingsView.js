import { storage } from '../services/storage.js';
import { Toast } from './Toast.js';

export class TenantSettingsView {
  constructor(options = {}) {
    this.onWorkspaceSwitched = options.onWorkspaceSwitched || (() => {});
  }

  render(container) {
    const activeWs = storage.getActiveWorkspace();
    const allWorkspaces = storage.getWorkspaces();
    const agents = storage.getAgents(activeWs.id);
    const phoneNumbers = storage.getPhoneNumbers(activeWs.id);
    const callLogs = storage.getCallLogs(activeWs.id);

    const usagePercent = Math.min(100, Math.round((activeWs.monthlyMinutesUsed / activeWs.monthlyMinutesLimit) * 100));

    container.innerHTML = `
      <div class="view-header">
        <div class="view-title-group">
          <h1>Multi-Tenant Platform & Workspace Isolation</h1>
          <p>Enterprise tenant accounts, data segregation, RBAC permissions, and carrier SIP trunk credentials</p>
        </div>
        <div>
          <button class="btn-primary" id="btn-create-tenant-modal">+ Create Isolated Workspace</button>
        </div>
      </div>

      <!-- Current Workspace Profile & Quotas -->
      <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 1.5rem; margin-bottom: 1.5rem;">
        <!-- Left: Workspace Configuration -->
        <div class="card-panel" style="margin-bottom: 0;">
          <div class="card-panel-header">
            <div class="card-panel-title">
              <span>🏢</span>
              <span>Active Workspace Profile: ${activeWs.name}</span>
            </div>
            <span class="badge-status success">${activeWs.tier}</span>
          </div>

          <form id="form-update-workspace">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
              <div class="form-group">
                <label class="form-label">Business / Brand Name</label>
                <input type="text" class="form-input" id="field-ws-name" value="${activeWs.name}" required />
              </div>
              <div class="form-group">
                <label class="form-label">Industry Vertical</label>
                <input type="text" class="form-input" id="field-ws-industry" value="${activeWs.industry}" required />
              </div>
            </div>

            <!-- SIP Trunking & Carrier Credentials -->
            <div style="background: var(--bg-darkest); border: 1px solid var(--border-medium); border-radius: var(--radius-md); padding: 1rem; margin-bottom: 1rem;">
              <div style="font-size: 0.75rem; text-transform: uppercase; color: var(--text-dim); font-weight: 700; margin-bottom: 0.6rem;">
                Carrier SIP Trunking Configuration
              </div>

              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                <div class="form-group" style="margin-bottom: 0.5rem;">
                  <label class="form-label">Carrier Provider</label>
                  <input type="text" class="form-input" value="${activeWs.telephonyProvider}" readonly />
                </div>
                <div class="form-group" style="margin-bottom: 0.5rem;">
                  <label class="form-label">Twilio / Carrier Account SID</label>
                  <input type="text" class="form-input" value="${activeWs.twilioAccountSid}" style="font-family: var(--font-mono); font-size: 0.78rem;" />
                </div>
              </div>

              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-top: 0.5rem;">
                <div class="form-group" style="margin-bottom: 0;">
                  <label class="form-label">Auth Token (Encrypted)</label>
                  <input type="text" class="form-input" value="${activeWs.twilioAuthToken}" style="font-family: var(--font-mono); font-size: 0.78rem;" />
                </div>
                <div class="form-group" style="margin-bottom: 0;">
                  <label class="form-label">Private SIP Domain</label>
                  <input type="text" class="form-input" value="${activeWs.sipDomain}" style="font-family: var(--font-mono); font-size: 0.78rem;" />
                </div>
              </div>
            </div>

            <!-- Human Handoff Routing Target -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
              <div class="form-group">
                <label class="form-label">Operator Escalation Phone Number</label>
                <input type="text" class="form-input" id="field-ws-handoff-num" value="${activeWs.humanHandoffNumber}" style="font-family: var(--font-mono);" required />
              </div>
              <div class="form-group">
                <label class="form-label">Handoff Bridge Mode</label>
                <select class="form-select" id="field-ws-handoff-type">
                  <option value="Warm Transfer with AI Whisper" ${activeWs.humanHandoffType?.includes('Warm') ? 'selected' : ''}>Warm Transfer with AI Whisper</option>
                  <option value="Blind SIP REFER Transfer">Blind SIP REFER Transfer</option>
                </select>
              </div>
            </div>

            <div style="display: flex; justify-content: flex-end;">
              <button type="submit" class="btn-primary">Save Workspace Settings</button>
            </div>
          </form>
        </div>

        <!-- Right: Quota & Data Isolation Safeguards -->
        <div>
          <!-- Quota card -->
          <div class="card-panel" style="margin-bottom: 1.25rem;">
            <div class="card-panel-header">
              <div class="card-panel-title">
                <span>⏱️</span>
                <span>Monthly Quota</span>
              </div>
              <span style="font-family: var(--font-mono); font-size: 0.8rem; color: var(--cyan-400); font-weight: 700;">${usagePercent}%</span>
            </div>
            <div style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 0.4rem;">
              ${(activeWs.monthlyMinutesUsed).toLocaleString()} of ${(activeWs.monthlyMinutesLimit).toLocaleString()} minutes used
            </div>
            <div style="width: 100%; height: 8px; background: var(--bg-darkest); border-radius: 4px; overflow: hidden; margin-bottom: 0.75rem;">
              <div style="width: ${usagePercent}%; height: 100%; background: linear-gradient(90deg, var(--indigo-500), var(--cyan-400));"></div>
            </div>
            <div style="font-size: 0.72rem; color: var(--text-dim);">
              Billing cycle resets on the 1st of every month. Automatic soft-limit alerts enabled at 80%.
            </div>
          </div>

          <!-- Data Isolation Status -->
          <div class="card-panel" style="margin-bottom: 0; background: rgba(16, 185, 129, 0.05); border-color: rgba(16, 185, 129, 0.25);">
            <div style="color: var(--emerald-400); font-weight: 700; font-size: 0.85rem; margin-bottom: 0.4rem; display: flex; align-items: center; gap: 0.4rem;">
              <span>🔒</span>
              <span>Tenant Data Isolation Active</span>
            </div>
            <div style="font-size: 0.75rem; color: var(--text-light); line-height: 1.45;">
              This workspace holds strictly segregated data:
              <ul style="margin-left: 1.2rem; margin-top: 0.4rem; color: var(--text-muted);">
                <li><strong>${agents.length}</strong> Dedicated Voice Agents</li>
                <li><strong>${phoneNumbers.length}</strong> Assigned Phone DIDs</li>
                <li><strong>${callLogs.length}</strong> Private Call Records & Audio</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <!-- All Tenant Accounts Switcher Grid -->
      <div class="card-panel">
        <div class="card-panel-header">
          <div class="card-panel-title">
            <span>👥</span>
            <span>Switch Business Workspaces (${allWorkspaces.length})</span>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1rem;">
          ${allWorkspaces.map(ws => `
            <div style="background: var(--bg-darkest); border: 1px solid ${ws.id === activeWs.id ? 'var(--indigo-500)' : 'var(--border-subtle)'}; border-radius: var(--radius-lg); padding: 1.1rem; position: relative;">
              ${ws.id === activeWs.id ? '<div style="position: absolute; top: 12px; right: 12px; font-size: 0.7rem; background: var(--indigo-500); color: white; padding: 0.15rem 0.5rem; border-radius: var(--radius-full); font-weight: 700;">CURRENT</div>' : ''}
              <div style="font-weight: 700; font-size: 1rem; color: var(--text-main); margin-bottom: 0.25rem;">${ws.name}</div>
              <div style="font-size: 0.75rem; color: var(--cyan-400); margin-bottom: 0.6rem;">${ws.industry} • ${ws.tier}</div>
              <div style="font-size: 0.72rem; color: var(--text-dim); margin-bottom: 0.85rem;">
                Region: ${ws.region}<br/>
                Carrier: ${ws.telephonyProvider}
              </div>
              ${ws.id !== activeWs.id ? `
                <button class="btn-secondary btn-switch-ws" data-ws-id="${ws.id}" style="width: 100%; justify-content: center; font-size: 0.78rem;">
                  Switch to ${ws.name.split(' ')[0]} →
                </button>
              ` : `
                <div style="font-size: 0.74rem; color: var(--emerald-400); font-weight: 600;">✓ Active Session Connected</div>
              `}
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Modal Container -->
      <div id="tenant-modal-host"></div>
    `;

    this.attachEvents(container, activeWs);
  }

  attachEvents(container, activeWs) {
    // Save form
    const form = container.querySelector('#form-update-workspace');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const updated = {
          ...activeWs,
          name: container.querySelector('#field-ws-name').value,
          industry: container.querySelector('#field-ws-industry').value,
          humanHandoffNumber: container.querySelector('#field-ws-handoff-num').value,
          humanHandoffType: container.querySelector('#field-ws-handoff-type').value
        };
        storage.saveWorkspace(updated);
        Toast.success('Updated workspace profile');
        this.render(container);
      });
    }

    // Switch workspace buttons
    const switchBtns = container.querySelectorAll('.btn-switch-ws');
    switchBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetId = btn.getAttribute('data-ws-id');
        storage.setActiveWorkspaceId(targetId);
        Toast.success(`Switched active tenant workspace`);
        this.onWorkspaceSwitched(targetId);
      });
    });

    // Create Tenant Modal
    const createBtn = container.querySelector('#btn-create-tenant-modal');
    if (createBtn) {
      createBtn.addEventListener('click', () => {
        this.openCreateWorkspaceModal(container);
      });
    }
  }

  openCreateWorkspaceModal(container) {
    const host = container.querySelector('#tenant-modal-host');
    host.innerHTML = `
      <div class="call-modal-overlay open" id="modal-create-ws">
        <div class="call-modal-content" style="max-width: 540px;">
          <div class="call-modal-header">
            <h3 style="font-size: 1.1rem; font-weight: 700;">Create Isolated Business Workspace</h3>
            <button class="btn-secondary" id="btn-close-ws-modal" style="padding: 0.2rem 0.5rem;">✕</button>
          </div>
          <form id="form-new-ws" style="padding: 1.5rem;">
            <div class="form-group">
              <label class="form-label">Business / Account Name</label>
              <input type="text" class="form-input" id="field-new-ws-name" placeholder="e.g. Metro Real Estate Concierge" required />
            </div>
            <div class="form-group">
              <label class="form-label">Industry Vertical</label>
              <input type="text" class="form-input" id="field-new-ws-industry" placeholder="e.g. Real Estate & Property" required />
            </div>
            <div class="form-group">
              <label class="form-label">Telephony Carrier</label>
              <select class="form-select" id="field-new-ws-provider">
                <option value="Twilio SIP Trunking">Twilio SIP Trunking (US-East)</option>
                <option value="Vonage Voice API">Vonage Voice API</option>
                <option value="Plivo Telephony">Plivo Telephony</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Escalation Handoff Phone Number</label>
              <input type="text" class="form-input" id="field-new-ws-phone" placeholder="+1 (800) 555-0100" required />
            </div>
            <div style="display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1.25rem;">
              <button type="button" class="btn-secondary" id="btn-cancel-ws-modal">Cancel</button>
              <button type="submit" class="btn-primary">Create Workspace</button>
            </div>
          </form>
        </div>
      </div>
    `;

    const close = () => { host.innerHTML = ''; };
    host.querySelector('#btn-close-ws-modal').addEventListener('click', close);
    host.querySelector('#btn-cancel-ws-modal').addEventListener('click', close);

    host.querySelector('#form-new-ws').addEventListener('submit', (e) => {
      e.preventDefault();
      const newWs = {
        id: `ws-${Date.now()}`,
        name: host.querySelector('#field-new-ws-name').value,
        slug: host.querySelector('#field-new-ws-name').value.toLowerCase().replace(/\s+/g, '-'),
        industry: host.querySelector('#field-new-ws-industry').value,
        tier: 'Growth Tier',
        region: 'US-East (N. Virginia)',
        telephonyProvider: host.querySelector('#field-new-ws-provider').value,
        twilioAccountSid: `AC${Math.random().toString(36).substring(2, 15)}`,
        twilioAuthToken: '••••••••••••••••••••••••8819',
        sipDomain: 'custom.sip.inspirus.ai',
        monthlyMinutesLimit: 15000,
        monthlyMinutesUsed: 0,
        members: [{ name: 'Account Admin', role: 'Owner', avatar: 'AA' }],
        humanHandoffNumber: host.querySelector('#field-new-ws-phone').value,
        humanHandoffType: 'Warm Transfer with AI Whisper',
        createdAt: new Date().toISOString()
      };

      storage.saveWorkspace(newWs);
      storage.setActiveWorkspaceId(newWs.id);
      Toast.success(`Created & switched to "${newWs.name}"!`);
      close();
      this.onWorkspaceSwitched(newWs.id);
    });
  }
}
