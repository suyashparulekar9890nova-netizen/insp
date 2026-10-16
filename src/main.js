import './style.css';
import { storage } from './services/storage.js';
import { Header } from './components/Header.js';
import { Sidebar } from './components/Sidebar.js';
import { DashboardView } from './components/DashboardView.js';
import { AgentStudioView } from './components/AgentStudioView.js';
import { TelephonyView } from './components/TelephonyView.js';
import { OutboundCampaignView } from './components/OutboundCampaignView.js';
import { ToolsIntegrationsView } from './components/ToolsIntegrationsView.js';
import { CallLogsView } from './components/CallLogsView.js';
import { HostingView } from './components/HostingView.js';
import { TenantSettingsView } from './components/TenantSettingsView.js';
import { LiveCallModal } from './components/LiveCallModal.js';
import { IncomingCallModal } from './components/IncomingCallModal.js';
import { AgentArchitectModal } from './components/AgentArchitectModal.js';
import { WebWidgetModal } from './components/WebWidgetModal.js';
import { ApiKeyModal } from './components/ApiKeyModal.js';
import { Toast } from './components/Toast.js';
import { VoicePipeline } from './services/voicePipeline.js';
window.VoicePipeline = VoicePipeline;

class App {
  constructor() {
    this.currentView = 'dashboard';
    this.header = null;
    this.sidebar = null;
    this.viewInstances = {};

    this.apiKeyModal = new ApiKeyModal();

    this.liveCallModal = new LiveCallModal({
      onCallEnded: () => {
        this.renderView();
      },
      onOpenApiKeyModal: () => this.apiKeyModal.open()
    });

    this.incomingCallModal = new IncomingCallModal({
      onAccept: ({ agent, language, initialGreeting }) => {
        this.openCallSimulator(agent, { language, initialGreeting });
      },
      onDecline: (reason) => {
        this.renderView();
      }
    });

    this.architectModal = new AgentArchitectModal({
      onAgentDeployed: (newAgent, shouldCallNow) => {
        this.renderAll();
        if (shouldCallNow) {
          this.openCallSimulator(newAgent);
        } else {
          this.navigateTo('studio');
          if (this.viewInstances.studio) {
            this.viewInstances.studio.selectedAgentId = newAgent.id;
            this.renderView();
          }
        }
      }
    });

    this.webWidgetModal = new WebWidgetModal({
      onLaunchCall: (agent) => this.openCallSimulator(agent)
    });

    this.init();
  }

  init() {
    const appRoot = document.getElementById('app');
    appRoot.className = 'app-container';

    appRoot.innerHTML = `
      <div id="header-mount"></div>
      <div class="app-body">
        <div id="sidebar-mount"></div>
        <main class="main-content" id="main-content-mount"></main>
      </div>
    `;

    // Instantiate Header & Sidebar
    this.header = new Header({
      onSimulateCall: (agent) => this.openCallSimulator(agent),
      onTriggerRing: (agent, options) => this.triggerIncomingCall(agent, options),
      onOpenWorkspaceModal: () => this.navigateTo('tenants'),
      onOpenArchitect: (prefilledPrompt = '') => this.architectModal.open(prefilledPrompt),
      onOpenEmbedModal: (agent) => this.webWidgetModal.open(agent),
      onOpenApiKeyModal: () => this.apiKeyModal.open()
    });

    this.sidebar = new Sidebar({
      initialView: this.currentView,
      onViewChange: (view) => {
        if (view === 'architect') {
          this.architectModal.open();
        } else {
          this.navigateTo(view);
        }
      }
    });

    // Instantiate Views
    this.viewInstances = {
      dashboard: new DashboardView({
        onNavigate: (view) => this.navigateTo(view),
        onInspectCall: (callId) => {
          this.currentView = 'call_logs';
          this.sidebar.currentView = 'call_logs';
          this.renderSidebar();
          const viewContainer = document.getElementById('main-content-mount');
          this.viewInstances.call_logs.selectedCallId = callId;
          this.viewInstances.call_logs.render(viewContainer);
        },
        onSimulateCall: (agent) => this.openCallSimulator(agent),
        onTriggerRing: (agent, options) => this.triggerIncomingCall(agent, options),
        onOpenArchitect: (prompt) => this.architectModal.open(prompt)
      }),
      studio: new AgentStudioView({
        onTestAgent: (agent) => this.openCallSimulator(agent, { language: agent.language, initialGreeting: agent.greeting }),
        onOpenArchitect: () => this.architectModal.open()
      }),
      telephony: new TelephonyView({
        onSimulateCall: (agent) => this.openCallSimulator(agent),
        onTriggerRing: (agent, options) => this.triggerIncomingCall(agent, options)
      }),
      outbound: new OutboundCampaignView(),
      tools: new ToolsIntegrationsView(),
      call_logs: new CallLogsView(),
      hosting: new HostingView({
        onLaunchCall: (agent) => this.openCallSimulator(agent),
        onOpenStudio: (agentId) => {
          this.navigateTo('studio');
          this.viewInstances.studio.selectedAgentId = agentId;
          this.renderView();
        }
      }),
      tenants: new TenantSettingsView({
        onWorkspaceSwitched: () => {
          this.renderAll();
        }
      })
    };

    // Render Initial UI
    this.renderAll();

    // Listen to Workspace changes & Storage updates
    window.addEventListener('workspace-changed', () => {
      this.renderAll();
    });

    window.addEventListener('storage-updated', () => {
      this.renderHeader();
      this.renderSidebar();
    });

    // Check direct URL params for automatic web-ring or direct call
    this.handleUrlRouting();
  }

  handleUrlRouting() {
    const params = new URLSearchParams(window.location.search);
    const ringParam = params.get('ring');
    const callParam = params.get('call');
    const langParam = params.get('lang');

    if (ringParam) {
      const agents = storage.getAgents();
      const agent = agents.find(a => 
        a.id === ringParam || 
        a.name.toLowerCase().includes(ringParam.toLowerCase())
      ) || agents[0];

      const language = langParam?.startsWith('hi') ? 'hi-IN' : (langParam?.startsWith('en') ? 'en-US' : (agent?.language || 'hi-IN'));

      setTimeout(() => {
        this.triggerIncomingCall(agent, {
          reason: 'Direct URL Web-Ring • Incoming Agent Call',
          language
        });
      }, 600);
    } else if (callParam) {
      const agents = storage.getAgents();
      const agent = agents.find(a => 
        a.id === callParam || 
        a.name.toLowerCase().includes(callParam.toLowerCase())
      ) || agents[0];

      const language = langParam?.startsWith('hi') ? 'hi-IN' : (langParam?.startsWith('en') ? 'en-US' : (agent?.language || 'hi-IN'));

      setTimeout(() => {
        this.openCallSimulator(agent, { language });
      }, 600);
    }
  }

  renderAll() {
    this.renderHeader();
    this.renderSidebar();
    this.renderView();
  }

  renderHeader() {
    const headerMount = document.getElementById('header-mount');
    if (headerMount) this.header.render(headerMount);
  }

  renderSidebar() {
    const sidebarMount = document.getElementById('sidebar-mount');
    if (sidebarMount) this.sidebar.render(sidebarMount);
  }

  renderView() {
    const mainMount = document.getElementById('main-content-mount');
    if (!mainMount) return;

    const currentInstance = this.viewInstances[this.currentView] || this.viewInstances.dashboard;
    currentInstance.render(mainMount);
    mainMount.scrollTop = 0;
  }

  navigateTo(view) {
    this.currentView = view;
    this.sidebar.currentView = view;
    this.renderView();
    this.renderSidebar();
  }

  openCallSimulator(agent = null, customOptions = {}) {
    const targetAgent = agent || storage.getAgents()[0];
    this.liveCallModal.open(targetAgent, customOptions);
  }

  triggerIncomingCall(agent = null, options = {}) {
    const targetAgent = agent || storage.getAgents()[0];
    this.incomingCallModal.show(targetAgent, options);
  }
}

// Initialize on DOM load
window.addEventListener('DOMContentLoaded', () => {
  const app = new App();
  window.__inspirusApp = app;
  window.triggerIncomingCall = (ag, opt) => app.triggerIncomingCall(ag, opt);
});
