import { storage } from '../services/storage.js';

export class Sidebar {
  constructor(options = {}) {
    this.currentView = options.initialView || 'dashboard';
    this.onViewChange = options.onViewChange || (() => {});
  }

  render(container) {
    const agents = storage.getAgents();
    const phoneNumbers = storage.getPhoneNumbers();
    const tools = storage.getTools();
    const callLogs = storage.getCallLogs();

    container.innerHTML = `
      <aside class="sidebar-nav">
        <div class="nav-category-title">Autonomous Voice Creation</div>

        <button class="nav-link-btn ${this.currentView === 'architect' ? 'active' : ''}" data-view="architect" style="background: linear-gradient(90deg, rgba(99, 102, 241, 0.15), rgba(6, 182, 212, 0.15)); border: 1px solid rgba(99, 102, 241, 0.35); color: #fff;">
          <div class="nav-item-left">
            <span>✨</span>
            <span style="font-weight: 700;">AI Agent Architect</span>
          </div>
          <span class="nav-pill-badge" style="background: var(--indigo-500); color: white;">GEN</span>
        </button>

        <div class="nav-category-title" style="margin-top: 0.6rem;">Core Operations</div>

        <button class="nav-link-btn ${this.currentView === 'dashboard' ? 'active' : ''}" data-view="dashboard">
          <div class="nav-item-left">
            <span>📊</span>
            <span>Dashboard & KPIs</span>
          </div>
        </button>

        <button class="nav-link-btn ${this.currentView === 'studio' ? 'active' : ''}" data-view="studio">
          <div class="nav-item-left">
            <span>🤖</span>
            <span>Agent Studio (Builder)</span>
          </div>
          <span class="nav-pill-badge">${agents.length}</span>
        </button>

        <button class="nav-link-btn ${this.currentView === 'telephony' ? 'active' : ''}" data-view="telephony">
          <div class="nav-item-left">
            <span>📞</span>
            <span>Telephony & Inbound</span>
          </div>
          <span class="nav-pill-badge">${phoneNumbers.length}</span>
        </button>

        <button class="nav-link-btn ${this.currentView === 'outbound' ? 'active' : ''}" data-view="outbound" style="background: linear-gradient(90deg, rgba(16, 185, 129, 0.1), rgba(6, 182, 212, 0.1)); border: 1px solid rgba(16, 185, 129, 0.3);">
          <div class="nav-item-left">
            <span>📢</span>
            <span style="font-weight: 600;">Outbound Dues & CSV</span>
          </div>
          <span class="nav-pill-badge" style="background: #10b981; color: white;">NEW</span>
        </button>

        <div class="nav-category-title" style="margin-top: 0.6rem;">Integrations & Intelligence</div>

        <button class="nav-link-btn ${this.currentView === 'tools' ? 'active' : ''}" data-view="tools">
          <div class="nav-item-left">
            <span>⚡</span>
            <span>Tools & CRM Functions</span>
          </div>
          <span class="nav-pill-badge">${tools.length}</span>
        </button>

        <button class="nav-link-btn ${this.currentView === 'call_logs' ? 'active' : ''}" data-view="call_logs">
          <div class="nav-item-left">
            <span>🎧</span>
            <span>Call Logs & Transcripts</span>
          </div>
          <span class="nav-pill-badge">${callLogs.length}</span>
        </button>

        <div class="nav-category-title" style="margin-top: 0.6rem;">Enterprise & Hosting</div>

        <button class="nav-link-btn ${this.currentView === 'hosting' ? 'active' : ''}" data-view="hosting">
          <div class="nav-item-left">
            <span>🌐</span>
            <span>Agent Web Hosting</span>
          </div>
        </button>

        <button class="nav-link-btn ${this.currentView === 'tenants' ? 'active' : ''}" data-view="tenants">
          <div class="nav-item-left">
            <span>🏢</span>
            <span>Tenant Workspaces</span>
          </div>
        </button>
      </aside>
    `;

    this.attachEvents(container);
  }

  attachEvents(container) {
    const buttons = container.querySelectorAll('.nav-link-btn');
    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        const view = btn.getAttribute('data-view');
        this.currentView = view;
        buttons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.onViewChange(view);
      });
    });
  }
}
