import {
  initialWorkspaces,
  initialAgents,
  initialPhoneNumbers,
  initialCampaigns,
  initialTools,
  initialCallLogs,
  voiceModelsCatalog
} from '../data/initialData.js';
import {
  isSupabaseConfigured,
  getAgentsFromSupabase,
  saveAgentToSupabase,
  getCallLogsFromSupabase,
  saveCallLogToSupabase,
  getTelephonyAgentFromSupabase,
  setTelephonyAgentInSupabase
} from './supabaseClient.js';

const STORAGE_KEYS = {
  ACTIVE_WORKSPACE_ID: 'inspirus_active_workspace_id',
  WORKSPACES: 'inspirus_workspaces_v1',
  AGENTS: 'inspirus_agents_v1',
  PHONE_NUMBERS: 'inspirus_phone_numbers_v1',
  CAMPAIGNS: 'inspirus_campaigns_v1',
  TOOLS: 'inspirus_tools_v1',
  CALL_LOGS: 'inspirus_call_logs_v1',
  CRM_SETTINGS: 'inspirus_crm_settings_v1',
  WHATSAPP_ASSIGNED_AGENT_ID: 'inspirus_whatsapp_agent_id'
};

class StorageService {
  constructor() {
    this.init();
    if (isSupabaseConfigured()) {
      this.syncFromSupabase().catch(() => {});
    }
  }

  async syncFromSupabase() {
    try {
      console.log('⚡ [Supabase] Synchronizing cloud database state...');
      const [remoteAgents, remoteLogs, remoteAssignedId] = await Promise.all([
        getAgentsFromSupabase(),
        getCallLogsFromSupabase(),
        getTelephonyAgentFromSupabase()
      ]);

      if (remoteAgents && remoteAgents.length > 0) {
        localStorage.setItem(STORAGE_KEYS.AGENTS, JSON.stringify(remoteAgents));
        window.dispatchEvent(new CustomEvent('storage-updated', { detail: { type: 'agents' } }));
        console.log(`✅ [Supabase] Synced ${remoteAgents.length} agents from cloud database.`);
      } else if (remoteAgents && remoteAgents.length === 0) {
        // First sync to fresh DB: push existing initial agents to Supabase
        const local = this.getAllAgents();
        for (const ag of local.slice(0, 5)) {
          saveAgentToSupabase(ag).catch(() => {});
        }
      }

      if (remoteLogs && remoteLogs.length > 0) {
        localStorage.setItem(STORAGE_KEYS.CALL_LOGS, JSON.stringify(remoteLogs));
        window.dispatchEvent(new CustomEvent('storage-updated', { detail: { type: 'call_logs' } }));
        console.log(`✅ [Supabase] Synced ${remoteLogs.length} call logs from cloud database.`);
      }

      if (remoteAssignedId) {
        localStorage.setItem(STORAGE_KEYS.WHATSAPP_ASSIGNED_AGENT_ID, remoteAssignedId);
        window.dispatchEvent(new CustomEvent('storage-updated', { detail: { type: 'whatsapp_agent', agentId: remoteAssignedId } }));
      }
    } catch (err) {
      console.warn('[Supabase Sync Warning]', err.message);
    }
  }

  init() {
    if (!localStorage.getItem(STORAGE_KEYS.WORKSPACES)) {
      localStorage.setItem(STORAGE_KEYS.WORKSPACES, JSON.stringify(initialWorkspaces));
    }
    if (!localStorage.getItem(STORAGE_KEYS.ACTIVE_WORKSPACE_ID)) {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_WORKSPACE_ID, 'ws-dentalcare');
    }
    if (!localStorage.getItem(STORAGE_KEYS.AGENTS)) {
      localStorage.setItem(STORAGE_KEYS.AGENTS, JSON.stringify(initialAgents));
    }
    if (!localStorage.getItem(STORAGE_KEYS.PHONE_NUMBERS)) {
      localStorage.setItem(STORAGE_KEYS.PHONE_NUMBERS, JSON.stringify(initialPhoneNumbers));
    }
    if (!localStorage.getItem(STORAGE_KEYS.CAMPAIGNS)) {
      localStorage.setItem(STORAGE_KEYS.CAMPAIGNS, JSON.stringify(initialCampaigns));
    }
    if (!localStorage.getItem(STORAGE_KEYS.TOOLS)) {
      localStorage.setItem(STORAGE_KEYS.TOOLS, JSON.stringify(initialTools));
    }
    if (!localStorage.getItem(STORAGE_KEYS.CALL_LOGS)) {
      localStorage.setItem(STORAGE_KEYS.CALL_LOGS, JSON.stringify(initialCallLogs));
    }
    if (!localStorage.getItem(STORAGE_KEYS.CRM_SETTINGS)) {
      localStorage.setItem(STORAGE_KEYS.CRM_SETTINGS, JSON.stringify({
        hubspot: { connected: true, portalId: "4920182", syncDeals: true, lastSync: "10 mins ago" },
        salesforce: { connected: false, orgId: "", syncDeals: false, lastSync: "Never" },
        zendesk: { connected: true, subdomain: "dentalcare-help", syncTickets: true, lastSync: "1 hour ago" },
        twilio: { connected: true, sid: "AC9a4f28019e481b9487c88383eef001", webhookStatus: "Healthy (200 OK)" }
      }));
    }
  }

  // Workspaces
  getWorkspaces() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.WORKSPACES)) || initialWorkspaces;
    } catch {
      return initialWorkspaces;
    }
  }

  getActiveWorkspaceId() {
    return localStorage.getItem(STORAGE_KEYS.ACTIVE_WORKSPACE_ID) || 'ws-dentalcare';
  }

  setActiveWorkspaceId(id) {
    localStorage.setItem(STORAGE_KEYS.ACTIVE_WORKSPACE_ID, id);
    window.dispatchEvent(new CustomEvent('workspace-changed', { detail: { workspaceId: id } }));
  }

  getActiveWorkspace() {
    const activeId = this.getActiveWorkspaceId();
    const list = this.getWorkspaces();
    return list.find(w => w.id === activeId) || list[0] || initialWorkspaces[0];
  }

  saveWorkspace(ws) {
    const list = this.getWorkspaces();
    const idx = list.findIndex(w => w.id === ws.id);
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...ws };
    } else {
      list.push(ws);
    }
    localStorage.setItem(STORAGE_KEYS.WORKSPACES, JSON.stringify(list));
    window.dispatchEvent(new CustomEvent('storage-updated', { detail: { type: 'workspaces' } }));
    return ws;
  }

  // Agents
  getAgents(workspaceId = null) {
    const wsId = workspaceId || this.getActiveWorkspaceId();
    try {
      const all = JSON.parse(localStorage.getItem(STORAGE_KEYS.AGENTS)) || initialAgents;
      return all.filter(a => a.workspaceId === wsId);
    } catch {
      return initialAgents.filter(a => a.workspaceId === wsId);
    }
  }

  getAllAgents() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.AGENTS)) || initialAgents;
    } catch {
      return initialAgents;
    }
  }

  getAgentById(id) {
    const all = this.getAllAgents();
    return all.find(a => a.id === id);
  }

  saveAgent(agent) {
    const all = this.getAllAgents();
    const idx = all.findIndex(a => a.id === agent.id);
    if (idx >= 0) {
      all[idx] = { ...all[idx], ...agent, updatedAt: new Date().toISOString() };
    } else {
      if (!agent.id) agent.id = `agent-${Date.now()}`;
      if (!agent.workspaceId) agent.workspaceId = this.getActiveWorkspaceId();
      all.push({ ...agent, createdAt: new Date().toISOString() });
    }
    localStorage.setItem(STORAGE_KEYS.AGENTS, JSON.stringify(all));
    window.dispatchEvent(new CustomEvent('storage-updated', { detail: { type: 'agents', agentId: agent.id } }));
    saveAgentToSupabase(agent).catch(() => {});
    return agent;
  }

  deleteAgent(id) {
    let all = this.getAllAgents();
    all = all.filter(a => a.id !== id);
    localStorage.setItem(STORAGE_KEYS.AGENTS, JSON.stringify(all));
    window.dispatchEvent(new CustomEvent('storage-updated', { detail: { type: 'agents' } }));
  }

  getWhatsAppAssignedAgent() {
    try {
      const id = localStorage.getItem(STORAGE_KEYS.WHATSAPP_ASSIGNED_AGENT_ID);
      if (id) {
        const found = this.getAgentById(id);
        if (found) return found;
      }
      const all = this.getAllAgents();
      // Check for user-customized agent first (e.g. saiesh - most recently created)
      const customAgents = all.filter(a => a.id.startsWith('agent-custom') || a.id.startsWith('agent-gen'));
      if (customAgents.length > 0) return customAgents[customAgents.length - 1];
      const wsAgents = this.getAgents();
      return wsAgents[0] || all[0];
    } catch {
      return this.getAllAgents()[0];
    }
  }

  setWhatsAppAssignedAgent(agentId) {
    localStorage.setItem(STORAGE_KEYS.WHATSAPP_ASSIGNED_AGENT_ID, agentId);
    window.dispatchEvent(new CustomEvent('storage-updated', { detail: { type: 'whatsapp_agent', agentId } }));
    setTelephonyAgentInSupabase(agentId).catch(() => {});
  }

  // Phone Numbers
  getPhoneNumbers(workspaceId = null) {
    const wsId = workspaceId || this.getActiveWorkspaceId();
    try {
      const all = JSON.parse(localStorage.getItem(STORAGE_KEYS.PHONE_NUMBERS)) || initialPhoneNumbers;
      return all.filter(p => p.workspaceId === wsId);
    } catch {
      return initialPhoneNumbers.filter(p => p.workspaceId === wsId);
    }
  }

  savePhoneNumber(numberObj) {
    const all = JSON.parse(localStorage.getItem(STORAGE_KEYS.PHONE_NUMBERS)) || initialPhoneNumbers;
    const idx = all.findIndex(p => p.id === numberObj.id);
    if (idx >= 0) {
      all[idx] = { ...all[idx], ...numberObj };
    } else {
      if (!numberObj.id) numberObj.id = `num-${Date.now()}`;
      if (!numberObj.workspaceId) numberObj.workspaceId = this.getActiveWorkspaceId();
      all.push(numberObj);
    }
    localStorage.setItem(STORAGE_KEYS.PHONE_NUMBERS, JSON.stringify(all));
    window.dispatchEvent(new CustomEvent('storage-updated', { detail: { type: 'phone_numbers' } }));
    return numberObj;
  }

  // Outbound Campaigns
  getCampaigns(workspaceId = null) {
    const wsId = workspaceId || this.getActiveWorkspaceId();
    try {
      const all = JSON.parse(localStorage.getItem(STORAGE_KEYS.CAMPAIGNS)) || initialCampaigns;
      return all.filter(c => c.workspaceId === wsId);
    } catch {
      return initialCampaigns.filter(c => c.workspaceId === wsId);
    }
  }

  saveCampaign(campaign) {
    const all = JSON.parse(localStorage.getItem(STORAGE_KEYS.CAMPAIGNS)) || initialCampaigns;
    const idx = all.findIndex(c => c.id === campaign.id);
    if (idx >= 0) {
      all[idx] = { ...all[idx], ...campaign };
    } else {
      if (!campaign.id) campaign.id = `camp-${Date.now()}`;
      if (!campaign.workspaceId) campaign.workspaceId = this.getActiveWorkspaceId();
      all.push(campaign);
    }
    localStorage.setItem(STORAGE_KEYS.CAMPAIGNS, JSON.stringify(all));
    window.dispatchEvent(new CustomEvent('storage-updated', { detail: { type: 'campaigns' } }));
    return campaign;
  }

  // Tools & Function Calling
  getTools(workspaceId = null) {
    const wsId = workspaceId || this.getActiveWorkspaceId();
    try {
      const all = JSON.parse(localStorage.getItem(STORAGE_KEYS.TOOLS)) || initialTools;
      return all.filter(t => t.workspaceId === wsId || t.workspaceId === 'global');
    } catch {
      return initialTools.filter(t => t.workspaceId === wsId || t.workspaceId === 'global');
    }
  }

  saveTool(tool) {
    const all = JSON.parse(localStorage.getItem(STORAGE_KEYS.TOOLS)) || initialTools;
    const idx = all.findIndex(t => t.id === tool.id);
    if (idx >= 0) {
      all[idx] = { ...all[idx], ...tool };
    } else {
      if (!tool.id) tool.id = `tool-${Date.now()}`;
      if (!tool.workspaceId) tool.workspaceId = this.getActiveWorkspaceId();
      all.push(tool);
    }
    localStorage.setItem(STORAGE_KEYS.TOOLS, JSON.stringify(all));
    window.dispatchEvent(new CustomEvent('storage-updated', { detail: { type: 'tools' } }));
    return tool;
  }

  // Call Logs
  getCallLogs(workspaceId = null) {
    const wsId = workspaceId || this.getActiveWorkspaceId();
    try {
      const all = JSON.parse(localStorage.getItem(STORAGE_KEYS.CALL_LOGS)) || initialCallLogs;
      return all.filter(c => c.workspaceId === wsId);
    } catch {
      return initialCallLogs.filter(c => c.workspaceId === wsId);
    }
  }

  addCallLog(log) {
    const all = JSON.parse(localStorage.getItem(STORAGE_KEYS.CALL_LOGS)) || initialCallLogs;
    if (!log.id) log.id = `call-${Date.now()}`;
    if (!log.workspaceId) log.workspaceId = this.getActiveWorkspaceId();
    if (!log.startedAt) log.startedAt = new Date().toISOString();
    all.unshift(log);
    localStorage.setItem(STORAGE_KEYS.CALL_LOGS, JSON.stringify(all));
    window.dispatchEvent(new CustomEvent('storage-updated', { detail: { type: 'call_logs' } }));
    saveCallLogToSupabase(log).catch(() => {});
    return log;
  }

  // CRM settings
  getCrmSettings() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.CRM_SETTINGS)) || {};
    } catch {
      return {};
    }
  }

  saveCrmSettings(settings) {
    localStorage.setItem(STORAGE_KEYS.CRM_SETTINGS, JSON.stringify(settings));
    window.dispatchEvent(new CustomEvent('storage-updated', { detail: { type: 'crm_settings' } }));
  }

  // Reset to sample state
  resetAll() {
    localStorage.clear();
    this.init();
    window.location.reload();
  }
}

export const storage = new StorageService();
export { voiceModelsCatalog };
