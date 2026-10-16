import { storage } from '../services/storage.js';
import { Toast } from './Toast.js';

export class Header {
  constructor(options = {}) {
    this.onSimulateCall = options.onSimulateCall || (() => {});
    this.onOpenWorkspaceModal = options.onOpenWorkspaceModal || (() => {});
    this.onOpenArchitect = options.onOpenArchitect || (() => {});
    this.onOpenEmbedModal = options.onOpenEmbedModal || (() => {});
    this.onOpenApiKeyModal = options.onOpenApiKeyModal || (() => {});
    this.onTriggerRing = options.onTriggerRing || (() => {});
  }

  render(container) {
    const activeWs = storage.getActiveWorkspace();
    const workspaces = storage.getWorkspaces();

    container.innerHTML = `
      <header class="top-header">
        <div class="brand-section">
          <a href="#" class="brand-logo" id="brand-home-link">
            <div class="brand-icon-box">⚡</div>
            <span>Inspirus Voice AI</span>
          </a>

          <!-- Multi-Tenant Workspace Selector -->
          <div class="workspace-selector" id="workspace-selector-container">
            <button class="workspace-badge-btn" id="workspace-dropdown-trigger" title="Switch isolated business workspace">
              <span class="tenant-indicator-dot"></span>
              <span id="current-workspace-name">${activeWs.name}</span>
              <span style="font-size: 0.7rem; color: var(--text-dim); margin-left: 2px;">▼</span>
            </button>

            <div class="workspace-dropdown-menu" id="workspace-dropdown-menu">
              <div class="workspace-dropdown-header">Switch Isolated Workspace</div>
              <div id="workspace-items-list">
                ${workspaces.map(ws => `
                  <div class="workspace-item ${ws.id === activeWs.id ? 'active' : ''}" data-ws-id="${ws.id}">
                    <div>
                      <div class="workspace-item-title">${ws.name}</div>
                      <div class="workspace-item-sub">${ws.industry} • ${ws.tier}</div>
                    </div>
                    ${ws.id === activeWs.id ? '<span style="color: var(--indigo-500); font-size: 0.8rem;">✓</span>' : ''}
                  </div>
                `).join('')}
              </div>
              <div style="border-top: 1px solid var(--border-subtle); margin-top: 0.4rem; padding-top: 0.4rem;">
                <button class="btn-secondary" id="btn-create-workspace" style="width: 100%; justify-content: center; font-size: 0.78rem; padding: 0.35rem 0.5rem;">
                  + Add New Workspace
                </button>
              </div>
            </div>
          </div>
        </div>

        <div class="header-right-actions">
          <!-- Prompt-to-Agent Generator Button -->
          <button class="btn-secondary" id="btn-header-open-architect" style="background: rgba(99, 102, 241, 0.15); border-color: rgba(99, 102, 241, 0.4); color: #fff;">
            <span>✨</span>
            <span>AI Agent Architect</span>
          </button>

          <!-- LLM API Key Settings Button -->
          <button class="btn-secondary" id="btn-header-open-apikey" style="background: rgba(16, 185, 129, 0.12); border-color: rgba(16, 185, 129, 0.35); color: #fff;" title="Configure Gemini / OpenAI API key for spontaneous live responses">
            <span>🔑</span>
            <span>API Key</span>
          </button>

          <!-- Live Simulator Button -->
          <button class="btn-simulate-call" id="btn-header-simulate-call">
            <span>📞</span>
            <span>Test Voice Agent Live</span>
          </button>

          <!-- Instant Outbound Web-Ring Button -->
          <button class="btn-primary" id="btn-header-ring-me" style="background: linear-gradient(135deg, #10b981, #059669); border-color: #34d399; box-shadow: 0 0 15px rgba(16, 185, 129, 0.4);" title="Trigger realistic incoming web call to this device">
            <span>🔔</span>
            <span>Ring My Device</span>
          </button>
        </div>
      </header>
    `;

    this.attachEvents(container);
  }

  attachEvents(container) {
    const trigger = container.querySelector('#workspace-dropdown-trigger');
    const menu = container.querySelector('#workspace-dropdown-menu');

    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      menu.classList.toggle('show');
    });

    document.addEventListener('click', (e) => {
      if (!menu.contains(e.target) && !trigger.contains(e.target)) {
        menu.classList.remove('show');
      }
    });

    const items = container.querySelectorAll('.workspace-item');
    items.forEach(item => {
      item.addEventListener('click', () => {
        const wsId = item.getAttribute('data-ws-id');
        menu.classList.remove('show');
        if (wsId !== storage.getActiveWorkspaceId()) {
          storage.setActiveWorkspaceId(wsId);
          const newWs = storage.getActiveWorkspace();
          Toast.success(`Switched workspace to: ${newWs.name}`);
        }
      });
    });

    const addWsBtn = container.querySelector('#btn-create-workspace');
    addWsBtn.addEventListener('click', () => {
      menu.classList.remove('show');
      this.onOpenWorkspaceModal();
    });

    const simulateCallBtn = container.querySelector('#btn-header-simulate-call');
    simulateCallBtn.addEventListener('click', () => {
      this.onSimulateCall();
    });

    const ringMeBtn = container.querySelector('#btn-header-ring-me');
    if (ringMeBtn) {
      ringMeBtn.addEventListener('click', () => {
        const agents = storage.getAgents();
        const activeAgent = agents.find(a => a.name?.toLowerCase().includes('saiesh')) || agents[0];
        this.onTriggerRing(activeAgent, {
          reason: 'Outbound AI Callback • Legal Consultation',
          language: activeAgent?.language || 'hi-IN'
        });
      });
    }

    const openArchitectBtn = container.querySelector('#btn-header-open-architect');
    openArchitectBtn.addEventListener('click', () => {
      this.onOpenArchitect();
    });

    const openEmbedBtn = container.querySelector('#btn-header-open-embed');
    if (openEmbedBtn) {
      openEmbedBtn.addEventListener('click', () => {
        this.onOpenEmbedModal();
      });
    }

    const openApiKeyBtn = container.querySelector('#btn-header-open-apikey');
    if (openApiKeyBtn) {
      openApiKeyBtn.addEventListener('click', () => {
        this.onOpenApiKeyModal();
      });
    }
  }
}
