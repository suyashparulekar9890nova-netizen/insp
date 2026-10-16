import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) || '';
const SUPABASE_ANON_KEY = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY) || '';

export const isSupabaseConfigured = () => {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY && SUPABASE_URL.startsWith('https://'));
};

export const supabase = isSupabaseConfigured()
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

/**
 * Fetch all agents from Supabase
 */
export async function getAgentsFromSupabase(workspaceId = null) {
  if (!supabase) return null;
  try {
    let query = supabase.from('agents').select('*').order('created_at', { ascending: false });
    if (workspaceId) {
      query = query.eq('workspace_id', workspaceId);
    }
    const { data, error } = await query;
    if (error) {
      console.warn('[Supabase] Failed to fetch agents:', error.message);
      return null;
    }
    return (data || []).map(mapDbAgentToApp);
  } catch (e) {
    console.warn('[Supabase Error]', e.message);
    return null;
  }
}

/**
 * Upsert agent into Supabase
 */
export async function saveAgentToSupabase(agent) {
  if (!supabase || !agent) return null;
  try {
    const row = mapAppAgentToDb(agent);
    const { data, error } = await supabase.from('agents').upsert(row).select().single();
    if (error) {
      console.warn('[Supabase] Failed to save agent:', error.message);
      return null;
    }
    return mapDbAgentToApp(data);
  } catch (e) {
    console.warn('[Supabase Error]', e.message);
    return null;
  }
}

/**
 * Fetch call logs from Supabase
 */
export async function getCallLogsFromSupabase(workspaceId = null) {
  if (!supabase) return null;
  try {
    let query = supabase.from('call_logs').select('*').order('created_at', { ascending: false }).limit(50);
    if (workspaceId) {
      query = query.eq('workspace_id', workspaceId);
    }
    const { data, error } = await query;
    if (error) {
      console.warn('[Supabase] Failed to fetch call logs:', error.message);
      return null;
    }
    return (data || []).map(mapDbLogToApp);
  } catch (e) {
    console.warn('[Supabase Error]', e.message);
    return null;
  }
}

/**
 * Add a call log to Supabase
 */
export async function saveCallLogToSupabase(log) {
  if (!supabase || !log) return null;
  try {
    const row = mapAppLogToDb(log);
    const { data, error } = await supabase.from('call_logs').insert(row).select().single();
    if (error) {
      console.warn('[Supabase] Failed to insert call log:', error.message);
      return null;
    }
    return mapDbLogToApp(data);
  } catch (e) {
    console.warn('[Supabase Error]', e.message);
    return null;
  }
}

/**
 * Get assigned telephony agent ID from Supabase
 */
export async function getTelephonyAgentFromSupabase() {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('telephony_settings')
      .select('value')
      .eq('key', 'inspirus_whatsapp_agent_id')
      .maybeSingle();
    if (error || !data) return null;
    return data.value;
  } catch (e) {
    return null;
  }
}

/**
 * Set assigned telephony agent ID in Supabase
 */
export async function setTelephonyAgentInSupabase(agentId) {
  if (!supabase || !agentId) return;
  try {
    await supabase.from('telephony_settings').upsert({
      key: 'inspirus_whatsapp_agent_id',
      value: agentId,
      updated_at: new Date().toISOString()
    });
  } catch (e) {}
}

// Helpers to map between DB snake_case and App camelCase
function mapDbAgentToApp(row) {
  if (!row) return null;
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    name: row.name,
    role: row.role,
    avatar: row.avatar,
    badge: row.badge,
    gender: row.gender,
    status: row.status,
    voiceProvider: row.voice_provider,
    voiceName: row.voice_name,
    voiceId: row.voice_id,
    language: row.language,
    supportedLanguages: row.supported_languages,
    autoLanguageDetect: row.auto_language_detect,
    speakingRate: Number(row.speaking_rate || 1.0),
    pitch: Number(row.pitch || 0),
    stability: Number(row.stability || 0.75),
    greeting: row.greeting,
    systemPrompt: row.system_prompt,
    tone: row.tone,
    maxDurationSeconds: row.max_duration_seconds,
    silenceTimeoutMs: row.silence_timeout_ms,
    bargeInAllowed: row.barge_in_allowed,
    toolsAttached: row.tools_attached || [],
    totalCallsHandled: row.total_calls_handled || 0,
    resolutionRate: Number(row.resolution_rate || 90.0),
    avgCallDuration: row.avg_call_duration || '2m 45s',
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapAppAgentToDb(app) {
  return {
    id: app.id,
    workspace_id: app.workspaceId || 'ws-dentalcare',
    name: app.name,
    role: app.role,
    avatar: app.avatar || '🤖',
    badge: app.badge || 'Active',
    gender: app.gender || 'Female',
    status: app.status || 'Active',
    voice_provider: app.voiceProvider || 'ElevenLabs Turbo v2.5',
    voice_name: app.voiceName || 'Rachel (Empathetic & Calm)',
    voice_id: app.voiceId || '21m00Tcm4TlvDq8ikWAM',
    language: app.language || 'en-US',
    supported_languages: app.supportedLanguages || ['en-US', 'hi-IN'],
    auto_language_detect: app.autoLanguageDetect ?? true,
    speaking_rate: app.speakingRate ?? 1.0,
    pitch: app.pitch ?? 0,
    stability: app.stability ?? 0.75,
    greeting: app.greeting,
    system_prompt: app.systemPrompt,
    tone: app.tone,
    max_duration_seconds: app.maxDurationSeconds || 600,
    silence_timeout_ms: app.silenceTimeoutMs || 4000,
    barge_in_allowed: app.bargeInAllowed ?? true,
    tools_attached: app.toolsAttached || [],
    total_calls_handled: app.totalCallsHandled || 0,
    resolution_rate: app.resolutionRate || 92.5,
    avg_call_duration: app.avgCallDuration || '2m 45s'
  };
}

function mapDbLogToApp(row) {
  if (!row) return null;
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    agentId: row.agent_id,
    agentName: row.agent_name,
    callerName: row.caller_name,
    callerNumber: row.caller_number,
    direction: row.direction,
    inboundNumber: row.inbound_number,
    status: row.status,
    resolution: row.resolution,
    durationSeconds: row.duration_seconds,
    durationFormatted: row.duration_formatted,
    sentiment: row.sentiment,
    sentimentScore: Number(row.sentiment_score || 0.9),
    language: row.language,
    latencyAvgMs: row.latency_avg_ms,
    costUsd: Number(row.cost_usd || 0.00),
    transcript: row.transcript || [],
    toolsExecuted: row.tools_executed || [],
    crmSynced: row.crm_synced ?? true,
    crmTarget: row.crm_target || 'WhatsApp Channel',
    startedAt: row.created_at,
    createdAt: row.created_at
  };
}

function mapAppLogToDb(app) {
  return {
    id: app.id || `call-${Date.now()}`,
    workspace_id: app.workspaceId || 'ws-dentalcare',
    agent_id: app.agentId,
    agent_name: app.agentName,
    caller_name: app.callerName || 'Direct Caller',
    caller_number: app.callerNumber || 'WhatsApp Voice Call',
    direction: app.direction || 'Inbound',
    inbound_number: app.inboundNumber || 'WhatsApp Live Gateway',
    status: app.status || 'Completed',
    resolution: app.resolution || 'Resolved by AI',
    duration_seconds: app.durationSeconds || 0,
    duration_formatted: app.durationFormatted || '0m 00s',
    sentiment: app.sentiment || 'Positive',
    sentiment_score: app.sentimentScore || 0.94,
    language: app.language || 'en-US',
    latency_avg_ms: app.latencyAvgMs || 280,
    cost_usd: app.costUsd || 0.00,
    transcript: app.transcript || [],
    tools_executed: app.toolsExecuted || [],
    crm_synced: app.crmSynced ?? true,
    crm_target: app.crmTarget || 'WhatsApp Channel'
  };
}
