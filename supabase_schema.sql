-- ==============================================================================
-- ⚡ INSPIRUS VOICE AI — SUPABASE DATABASE SCHEMA & SEED DATA
-- Run this SQL script in your Supabase Dashboard: SQL Editor -> New Query -> Run
-- ==============================================================================

-- 1. Create Workspaces Table
CREATE TABLE IF NOT EXISTS public.workspaces (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    industry TEXT,
    tier TEXT DEFAULT 'Enterprise Tier',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create Agents Table
CREATE TABLE IF NOT EXISTS public.agents (
    id TEXT PRIMARY KEY,
    workspace_id TEXT REFERENCES public.workspaces(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    role TEXT,
    avatar TEXT DEFAULT '🤖',
    badge TEXT DEFAULT 'Enterprise',
    gender TEXT DEFAULT 'Female',
    status TEXT DEFAULT 'Active',
    voice_provider TEXT DEFAULT 'ElevenLabs Turbo v2.5',
    voice_name TEXT DEFAULT 'Rachel (Empathetic & Calm)',
    voice_id TEXT DEFAULT '21m00Tcm4TlvDq8ikWAM',
    language TEXT DEFAULT 'en-US',
    supported_languages JSONB DEFAULT '["en-US", "hi-IN", "es-ES"]'::jsonb,
    auto_language_detect BOOLEAN DEFAULT TRUE,
    speaking_rate NUMERIC DEFAULT 1.0,
    pitch NUMERIC DEFAULT 0,
    stability NUMERIC DEFAULT 0.75,
    greeting TEXT,
    system_prompt TEXT,
    tone TEXT DEFAULT 'Empathetic, reassuring, clear, warm',
    max_duration_seconds INTEGER DEFAULT 600,
    silence_timeout_ms INTEGER DEFAULT 4000,
    barge_in_allowed BOOLEAN DEFAULT TRUE,
    sentiment_threshold_for_escalation NUMERIC DEFAULT 0.35,
    tools_attached JSONB DEFAULT '["book_calendar_appointment", "transfer_to_human_agent"]'::jsonb,
    total_calls_handled INTEGER DEFAULT 0,
    resolution_rate NUMERIC DEFAULT 92.5,
    avg_call_duration TEXT DEFAULT '2m 45s',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create Call Logs & CDR Table
CREATE TABLE IF NOT EXISTS public.call_logs (
    id TEXT PRIMARY KEY,
    workspace_id TEXT,
    agent_id TEXT,
    agent_name TEXT,
    caller_name TEXT DEFAULT 'Direct Caller',
    caller_number TEXT DEFAULT 'WhatsApp Voice Call',
    direction TEXT DEFAULT 'Inbound',
    inbound_number TEXT DEFAULT 'WhatsApp Live Gateway',
    status TEXT DEFAULT 'Completed',
    resolution TEXT DEFAULT 'Resolved by AI',
    duration_seconds INTEGER DEFAULT 0,
    duration_formatted TEXT DEFAULT '0m 00s',
    sentiment TEXT DEFAULT 'Positive',
    sentiment_score NUMERIC DEFAULT 0.94,
    language TEXT DEFAULT 'en-US',
    latency_avg_ms INTEGER DEFAULT 280,
    cost_usd NUMERIC DEFAULT 0.00,
    transcript JSONB DEFAULT '[]'::jsonb,
    tools_executed JSONB DEFAULT '[]'::jsonb,
    crm_synced BOOLEAN DEFAULT TRUE,
    crm_target TEXT DEFAULT 'WhatsApp Channel',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Create Telephony Config Table (Active Agent Assignment)
CREATE TABLE IF NOT EXISTS public.telephony_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Enable Row Level Security (RLS) & Grant Policies for Anon & Service Role
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telephony_settings ENABLE ROW LEVEL SECURITY;

-- Allow read & write access with anon and service role
CREATE POLICY "Public Read Workspaces" ON public.workspaces FOR SELECT USING (true);
CREATE POLICY "Public Write Workspaces" ON public.workspaces FOR ALL USING (true);

CREATE POLICY "Public Read Agents" ON public.agents FOR SELECT USING (true);
CREATE POLICY "Public Write Agents" ON public.agents FOR ALL USING (true);

CREATE POLICY "Public Read Call Logs" ON public.call_logs FOR SELECT USING (true);
CREATE POLICY "Public Write Call Logs" ON public.call_logs FOR ALL USING (true);

CREATE POLICY "Public Read Telephony Settings" ON public.telephony_settings FOR SELECT USING (true);
CREATE POLICY "Public Write Telephony Settings" ON public.telephony_settings FOR ALL USING (true);

-- Enable Realtime replication for dynamic live updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.agents;
ALTER PUBLICATION supabase_realtime ADD TABLE public.call_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.telephony_settings;

-- ==============================================================================
-- 6. Seed Initial Data
-- ==============================================================================

-- Workspaces
INSERT INTO public.workspaces (id, name, industry, tier)
VALUES 
    ('ws-dentalcare', 'Lumina Dental Studio', 'Healthcare & Aesthetics', 'Enterprise Tier'),
    ('ws-legal', 'Vanguard Litigation Group', 'Legal & Financial', 'Scale Tier')
ON CONFLICT (id) DO NOTHING;

-- Initial Active Agents
INSERT INTO public.agents (
    id, workspace_id, name, role, avatar, badge, gender, status,
    voice_name, language, greeting, system_prompt
) VALUES 
(
    'agent-maya',
    'ws-dentalcare',
    'Maya — Patient Care Coordinator',
    'Inbound Patient Triage & Appointment Scheduling',
    '👩‍⚕️',
    'Healthcare Grade',
    'Female',
    'Active',
    'Rachel (Empathetic & Calm)',
    'en-US',
    'Hello! Thank you for calling DentalCare Plus. My name is Maya, your AI care coordinator. Are you calling to book a new appointment, reschedule, or do you have a dental emergency?',
    'You are Maya, an empathetic, highly professional Patient Care Coordinator at DentalCare Plus Clinics. Answer caller questions directly about clinic hours, dental treatments, and appointment booking.'
),
(
    'agent-saiesh',
    'ws-dentalcare',
    'Saiesh — Polished Assistant',
    'Executive Concierge & Scheduling',
    '👨‍💼',
    'Executive Grade',
    'Male',
    'Active',
    'Guy (Authoritative & Warm)',
    'en-US',
    'Hello! Thank you for calling. My name is Saiesh. How can I assist you with your inquiries or appointments today?',
    'You are Saiesh, a polite, professional, and confident executive assistant. Answer inquiries clearly, help callers schedule consultations, and maintain a courteous tone.'
),
(
    'agent-carlos',
    'ws-dentalcare',
    'Carlos — Spanish Billing & Insurance Specialist',
    'Bilingual Claims & Complex Invoicing',
    '👨‍💼',
    'Bilingual Tier',
    'Male',
    'Active',
    'Mateo (Warm Latin Spanish)',
    'es-ES',
    '¡Hola! Gracias por llamar a DentalCare. Mi nombre es Carlos. ¿En qué le puedo asistir hoy?',
    'You are Carlos, a patient financial advisor and bilingual specialist. Answer caller questions on billing, insurance coverage, and procedures.'
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    role = EXCLUDED.role,
    greeting = EXCLUDED.greeting,
    system_prompt = EXCLUDED.system_prompt;

-- Set Default WhatsApp Assigned Agent
INSERT INTO public.telephony_settings (key, value)
VALUES ('inspirus_whatsapp_agent_id', 'agent-maya')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
