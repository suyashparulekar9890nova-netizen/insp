import { storage, voiceModelsCatalog } from '../services/storage.js';
import { VoicePipeline } from '../services/voicePipeline.js';
import { Toast } from './Toast.js';

export class AgentStudioView {
  constructor(options = {}) {
    this.selectedAgentId = null;
    this.activeStudioTab = 'form'; // 'form' or 'canvas'
    this.onTestAgent = options.onTestAgent || (() => {});
    this.onOpenArchitect = options.onOpenArchitect || (() => {});
  }

  render(container) {
    const agents = storage.getAgents();
    if (!this.selectedAgentId && agents.length > 0) {
      this.selectedAgentId = agents[0].id;
    }

    const agent = storage.getAgentById(this.selectedAgentId) || agents[0];
    const tools = storage.getTools();

    container.innerHTML = `
      <div class="view-header">
        <div class="view-title-group">
          <h1>Low/No-Code Agent Builder Studio</h1>
          <p>Visually configure voice personas, system prompts, ElevenLabs/Deepgram voices, multilingual switching, and conversation rules</p>
        </div>
        <div style="display: flex; gap: 0.65rem;">
          <button class="btn-secondary" id="btn-studio-open-architect" style="background: rgba(99, 102, 241, 0.15); border-color: rgba(99, 102, 241, 0.4); color: #fff;">
            <span>✨</span>
            <span>AI Agent Architect</span>
          </button>
          <button class="btn-secondary" id="btn-create-new-agent">+ Blank Agent</button>
          <button class="btn-primary" id="btn-studio-test-agent">📞 Test Call "${agent?.name?.split('—')[0]?.trim() || 'Agent'}"</button>
        </div>
      </div>

      <div class="studio-layout">
        <!-- Left: Agent List Selector -->
        <div class="agent-selector-list">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem;">
            <div style="font-size: 0.75rem; text-transform: uppercase; color: var(--text-dim); font-weight: 700;">
              Workspace Agents (${agents.length})
            </div>
            <span style="font-size: 0.7rem; color: var(--emerald-400); font-weight: 600;">● All Hosted</span>
          </div>
          ${agents.map(ag => `
            <div class="agent-card-item ${ag.id === agent?.id ? 'selected' : ''}" data-agent-id="${ag.id}">
              <div class="agent-item-top">
                <div class="agent-avatar-icon">${ag.avatar || '🤖'}</div>
                <div>
                  <div class="agent-name-title">${ag.name}</div>
                  <span class="agent-badge-tag">${ag.badge || 'Ready'}</span>
                </div>
              </div>
              <div style="font-size: 0.74rem; color: var(--text-muted); margin-top: 0.3rem;">
                ${ag.role}
              </div>
            </div>
          `).join('')}
        </div>

        <!-- Right: Studio Editor -->
        <div class="card-panel" style="margin-bottom: 0;">
          <!-- Tabs: Form Studio vs Visual Flow Canvas -->
          <div class="tabs-nav">
            <button class="tab-btn ${this.activeStudioTab === 'form' ? 'active' : ''}" id="tab-studio-form">Form Studio Editor</button>
            <button class="tab-btn ${this.activeStudioTab === 'canvas' ? 'active' : ''}" id="tab-studio-canvas">Visual Flow / State Canvas</button>
          </div>

          ${this.activeStudioTab === 'form' ? this.renderFormStudio(agent, tools) : this.renderVisualCanvas(agent)}
        </div>
      </div>
    `;

    this.attachEvents(container, agent);
  }

  renderFormStudio(agent, tools) {
    if (!agent) {
      return `<div style="padding: 2rem; text-align: center; color: var(--text-dim);">No agent selected. Create one to get started.</div>`;
    }

    return `
      <form id="agent-builder-form">
        <!-- Basic Info Section -->
        <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 1rem; margin-bottom: 1rem;">
          <div class="form-group">
            <label class="form-label">Agent Name & Role Description</label>
            <input type="text" class="form-input" id="field-agent-name" value="${agent.name}" placeholder="e.g. Maya — Patient Care Coordinator" required />
          </div>
          <div class="form-group">
            <label class="form-label">Persona Avatar / Emoji</label>
            <input type="text" class="form-input" id="field-agent-avatar" value="${agent.avatar || '👩‍⚕️'}" placeholder="Emoji or Icon" />
          </div>
        </div>

        <!-- System Prompt & Instructions -->
        <div class="form-group">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.4rem;">
            <label class="form-label" style="margin-bottom: 0;">System Prompt & Knowledge Instructions</label>
            <div style="font-size: 0.74rem; color: var(--cyan-400);">Click variable to inject:</div>
          </div>
          <textarea class="form-textarea" id="field-agent-prompt" rows="7">${agent.systemPrompt}</textarea>
          <div class="variable-pills">
            <span class="var-pill" data-var="{{caller_name}}">{{caller_name}}</span>
            <span class="var-pill" data-var="{{caller_phone}}">{{caller_phone}}</span>
            <span class="var-pill" data-var="{{appointment_date}}">{{appointment_date}}</span>
            <span class="var-pill" data-var="{{tracking_number}}">{{tracking_number}}</span>
            <span class="var-pill" data-var="{{company_name}}">{{company_name}}</span>
            <span class="var-pill" data-var="{{handoff_number}}">{{handoff_number}}</span>
          </div>
          <div class="form-hint">Defines the bot's objective, rules of engagement, tone of voice, and boundary guardrails.</div>
        </div>

        <!-- Greeting Message -->
        <div class="form-group">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.4rem;">
            <label class="form-label" style="margin-bottom: 0;">Initial Greeting (First Turn Speech)</label>
            <button type="button" class="btn-secondary" id="btn-audition-greeting" style="font-size: 0.74rem; padding: 0.2rem 0.6rem;">
              🔊 Audition Voice
            </button>
          </div>
          <input type="text" class="form-input" id="field-agent-greeting" value="${agent.greeting}" placeholder="Spoken immediately when telephony call connects" required />
        </div>

        <!-- Voice & Audio Configuration Row -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem; background: var(--bg-darkest); padding: 1rem; border-radius: var(--radius-md); border: 1px solid var(--border-subtle);">
          <div class="form-group" style="margin-bottom: 0.6rem;">
            <label class="form-label">Voice Model & Accent</label>
            <select class="form-select" id="field-agent-voice">
              ${voiceModelsCatalog.map(v => `
                <option value="${v.name}" ${v.name.includes(agent.voiceName?.split(' ')[0]) ? 'selected' : ''}>
                  ${v.provider} • ${v.name} (${v.latency})
                </option>
              `).join('')}
            </select>
          </div>

          <div class="form-group" style="margin-bottom: 0.6rem;">
            <label class="form-label">Persona Voice Gender</label>
            <select class="form-select" id="field-agent-gender">
              <option value="Male" ${(agent.gender || VoicePipeline.getAgentGender(agent) || '').toLowerCase() === 'male' ? 'selected' : ''}>👨 Male (Strict Baritone / Deep)</option>
              <option value="Female" ${(agent.gender || VoicePipeline.getAgentGender(agent) || '').toLowerCase() === 'female' ? 'selected' : ''}>👩 Female (Strict Melodic / Clear)</option>
            </select>
          </div>

          <div class="form-group" style="margin-bottom: 0.6rem;">
            <label class="form-label">Primary Language</label>
            <select class="form-select" id="field-agent-lang">
              <option value="en-US" ${agent.language === 'en-US' ? 'selected' : ''}>English (United States)</option>
              <option value="en-GB" ${agent.language === 'en-GB' ? 'selected' : ''}>English (United Kingdom)</option>
              <option value="es-US" ${agent.language === 'es-US' ? 'selected' : ''}>Spanish (Latin America / US)</option>
              <option value="es-ES" ${agent.language === 'es-ES' ? 'selected' : ''}>Spanish (Spain)</option>
              <option value="fr-FR" ${agent.language === 'fr-FR' ? 'selected' : ''}>French (France)</option>
              <option value="de-DE" ${agent.language === 'de-DE' ? 'selected' : ''}>German (Germany)</option>
              <option value="hi-IN" ${agent.language === 'hi-IN' ? 'selected' : ''}>Hindi (India)</option>
              <option value="pt-BR" ${agent.language === 'pt-BR' ? 'selected' : ''}>Portuguese (Brazil)</option>
              <option value="ja-JP" ${agent.language === 'ja-JP' ? 'selected' : ''}>Japanese (Japan)</option>
            </select>
          </div>

          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label">Speaking Rate (Speed): <span id="label-speaking-rate">${agent.speakingRate || 1.0}x</span></label>
            <div class="slider-container">
              <input type="range" class="slider-input" id="field-speaking-rate" min="0.8" max="1.3" step="0.05" value="${agent.speakingRate || 1.0}" />
            </div>
          </div>

          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label">Pitch Tuning: <span id="label-pitch">${agent.pitch || 0.0}</span></label>
            <div class="slider-container">
              <input type="range" class="slider-input" id="field-pitch" min="-0.2" max="0.2" step="0.02" value="${agent.pitch || 0.0}" />
            </div>
          </div>
        </div>

        <!-- Conversation Rules & Guardrails -->
        <div style="margin-bottom: 1.25rem;">
          <div style="font-size: 0.82rem; font-weight: 700; color: var(--text-main); margin-bottom: 0.6rem;">
            Conversation Rules & Call Safety Guardrails
          </div>

          <div class="toggle-wrapper">
            <div class="toggle-info">
              <h4>Barge-In / Live Caller Interruption</h4>
              <p>Allows human callers to interrupt the bot mid-sentence; halts audio synthesis instantly</p>
            </div>
            <label class="switch">
              <input type="checkbox" id="field-barge-in" ${agent.bargeInAllowed !== false ? 'checked' : ''} />
              <span class="slider-round"></span>
            </label>
          </div>

          <div class="toggle-wrapper">
            <div class="toggle-info">
              <h4>Automatic Multilingual Language Detection</h4>
              <p>Seamlessly transitions speech and responses when the caller starts speaking another language</p>
            </div>
            <label class="switch">
              <input type="checkbox" id="field-auto-lang" ${agent.autoLanguageDetect ? 'checked' : ''} />
              <span class="slider-round"></span>
            </label>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-top: 0.6rem;">
            <div class="form-group">
              <label class="form-label">Max Call Duration (seconds)</label>
              <input type="number" class="form-input" id="field-max-duration" value="${agent.maxDurationSeconds || 600}" />
            </div>
            <div class="form-group">
              <label class="form-label">Silence Timeout (milliseconds)</label>
              <input type="number" class="form-input" id="field-silence-timeout" value="${agent.silenceTimeoutMs || 4000}" />
            </div>
          </div>
        </div>

        <!-- Tools / Function Calling Attachments -->
        <div class="form-group">
          <label class="form-label">Active Function Calling Tools</label>
          <div style="display: flex; flex-direction: column; gap: 0.45rem;">
            ${tools.map(tool => `
              <label style="display: flex; align-items: center; gap: 0.65rem; background: var(--bg-darkest); border: 1px solid var(--border-subtle); padding: 0.6rem 0.85rem; border-radius: var(--radius-md); cursor: pointer;">
                <input type="checkbox" class="tool-checkbox" value="${tool.name}" ${(agent.toolsAttached || []).includes(tool.name) ? 'checked' : ''} />
                <div style="flex: 1;">
                  <div style="font-family: var(--font-mono); font-size: 0.82rem; font-weight: 700; color: var(--emerald-400);">${tool.name}</div>
                  <div style="font-size: 0.72rem; color: var(--text-muted);">${tool.description}</div>
                </div>
              </label>
            `).join('')}
          </div>
        </div>

        <!-- Actions -->
        <div style="display: flex; justify-content: flex-end; gap: 0.75rem; border-top: 1px solid var(--border-subtle); padding-top: 1rem;">
          <button type="submit" class="btn-primary" id="btn-save-agent">
            <span>💾</span>
            <span>Save Agent Settings</span>
          </button>
        </div>
      </form>
    `;
  }

  renderVisualCanvas(agent) {
    return `
      <div class="flow-canvas-container">
        <div style="display: flex; flex-direction: column; align-items: center; gap: 0.75rem;">
          <div class="flow-step-node active-node">
            <div class="flow-step-header">
              <span>📞 Step 1: Telephony / WebRTC Inbound</span>
            </div>
            <div style="font-size: 0.82rem; color: var(--text-light);">
              Inbound DID or Web Voice Widget initiates real-time bi-directional audio WebSocket.
            </div>
          </div>

          <div class="flow-arrow-down">↓</div>

          <div class="flow-step-node">
            <div class="flow-step-header">
              <span>🔊 Step 2: First-Turn Greeting</span>
            </div>
            <div style="font-size: 0.82rem; color: var(--text-light); font-style: italic;">
              "${agent.greeting}"
            </div>
          </div>

          <div class="flow-arrow-down">↓</div>

          <div class="flow-step-node">
            <div class="flow-step-header">
              <span>👂 Step 3: Natural Multi-Turn Voice Pipeline</span>
            </div>
            <div style="font-size: 0.82rem; color: var(--text-light);">
              Deepgram STT (92ms) → LLM Reasoning (165ms) → Cartesia/ElevenLabs TTS (120ms) with Barge-In detection.
            </div>
          </div>

          <div class="flow-arrow-down">↓</div>

          <div style="display: flex; gap: 1.5rem;">
            <div class="flow-step-node" style="border-color: var(--emerald-500);">
              <div class="flow-step-header" style="color: var(--emerald-400);">
                <span>⚡ Step 4A: Real-Time Function Calling</span>
              </div>
              <div style="font-size: 0.8rem; color: var(--text-light);">
                Invokes tools (e.g. <code>${(agent.toolsAttached || []).slice(0, 2).join('</code>, <code>') || 'crm_sync'}</code>) & speaks results.
              </div>
            </div>

            <div class="flow-step-node" style="border-color: var(--rose-500);">
              <div class="flow-step-header" style="color: var(--rose-500);">
                <span>👥 Step 4B: Warm Human Handoff</span>
              </div>
              <div style="font-size: 0.8rem; color: var(--text-light);">
                If sentiment drops or user requests help → routes live audio to operator with AI Whisper Summary packet.
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  attachEvents(container, agent) {
    // Select agent from list
    const agentCards = container.querySelectorAll('.agent-card-item');
    agentCards.forEach(card => {
      card.addEventListener('click', () => {
        this.selectedAgentId = card.getAttribute('data-agent-id');
        this.render(container);
      });
    });

    // Open Architect from studio
    const architectBtn = container.querySelector('#btn-studio-open-architect');
    if (architectBtn) {
      architectBtn.addEventListener('click', () => {
        this.onOpenArchitect();
      });
    }

    // Create blank agent button
    const createBtn = container.querySelector('#btn-create-new-agent');
    if (createBtn) {
      createBtn.addEventListener('click', () => {
        const newAgent = {
          id: `agent-${Date.now()}`,
          workspaceId: storage.getActiveWorkspaceId(),
          name: 'Nova — Inbound Concierge',
          role: 'General Inbound Customer Reception',
          avatar: '🤖',
          badge: 'New Bot',
          status: 'Active',
          voiceProvider: 'ElevenLabs Turbo',
          voiceName: 'Nova (Energetic & Friendly)',
          voiceId: 'openai-nova',
          language: 'en-US',
          speakingRate: 1.0,
          pitch: 0.0,
          stability: 0.8,
          greeting: 'Hello! Thanks for reaching out. How can I help you today?',
          systemPrompt: 'You are an intelligent, polite AI assistant. Assist callers with questions and route appropriately.',
          maxDurationSeconds: 600,
          silenceTimeoutMs: 4000,
          bargeInAllowed: true,
          toolsAttached: ['transfer_to_human_agent']
        };
        storage.saveAgent(newAgent);
        this.selectedAgentId = newAgent.id;
        Toast.success('Created new Voice Agent');
        this.render(container);
      });
    }

    // Tab buttons
    const tabForm = container.querySelector('#tab-studio-form');
    const tabCanvas = container.querySelector('#tab-studio-canvas');
    if (tabForm && tabCanvas) {
      tabForm.addEventListener('click', () => {
        this.activeStudioTab = 'form';
        this.render(container);
      });
      tabCanvas.addEventListener('click', () => {
        this.activeStudioTab = 'canvas';
        this.render(container);
      });
    }

    // Variable chip injector
    const varPills = container.querySelectorAll('.var-pill');
    const promptTextarea = container.querySelector('#field-agent-prompt');
    if (promptTextarea) {
      varPills.forEach(pill => {
        pill.addEventListener('click', () => {
          const varName = pill.getAttribute('data-var');
          promptTextarea.value += ` ${varName}`;
          promptTextarea.focus();
        });
      });
    }

    // Sliders
    const rateSlider = container.querySelector('#field-speaking-rate');
    const rateLabel = container.querySelector('#label-speaking-rate');
    if (rateSlider && rateLabel) {
      rateSlider.addEventListener('input', () => {
        rateLabel.textContent = `${rateSlider.value}x`;
      });
    }

    const pitchSlider = container.querySelector('#field-pitch');
    const pitchLabel = container.querySelector('#label-pitch');
    if (pitchSlider && pitchLabel) {
      pitchSlider.addEventListener('input', () => {
        pitchLabel.textContent = pitchSlider.value;
      });
    }

    // Audition Greeting audio button
    const auditionBtn = container.querySelector('#btn-audition-greeting');
    if (auditionBtn) {
      auditionBtn.addEventListener('click', () => {
        const greetingText = container.querySelector('#field-agent-greeting').value;
        const rate = parseFloat(rateSlider?.value || '1.0');
        const pitchVal = parseFloat(pitchSlider?.value || '0.0');
        const genderVal = container.querySelector('#field-agent-gender')?.value || VoicePipeline.getAgentGender(agent);
        const isMale = genderVal.toLowerCase().startsWith('m');
        const langVal = container.querySelector('#field-agent-lang')?.value || 'en-US';
        const isHindi = langVal.startsWith('hi');

        VoicePipeline.playVoiceAudition({
          text: greetingText,
          language: langVal,
          isMale,
          onStart: () => {
            const voiceLabel = isHindi 
              ? (isMale ? 'Madhur Neural Hindi (Male)' : 'Swara Neural Hindi (Female)') 
              : `${isMale ? 'Male' : 'Female'} Strict Voice`;
            Toast.info(`Auditioning ${voiceLabel} greeting...`);
          }
        });
      });
    }

    // Save Agent Form
    const form = container.querySelector('#agent-builder-form');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const checkedTools = [];
        container.querySelectorAll('.tool-checkbox:checked').forEach(cb => {
          checkedTools.push(cb.value);
        });

        const updatedAgent = {
          ...agent,
          name: container.querySelector('#field-agent-name').value,
          gender: container.querySelector('#field-agent-gender')?.value || 'Male',
          avatar: container.querySelector('#field-agent-avatar').value,
          systemPrompt: container.querySelector('#field-agent-prompt').value,
          greeting: container.querySelector('#field-agent-greeting').value,
          voiceName: container.querySelector('#field-agent-voice').value,
          language: container.querySelector('#field-agent-lang').value,
          speakingRate: parseFloat(rateSlider.value),
          pitch: parseFloat(pitchSlider.value),
          bargeInAllowed: container.querySelector('#field-barge-in').checked,
          autoLanguageDetect: container.querySelector('#field-auto-lang').checked,
          maxDurationSeconds: parseInt(container.querySelector('#field-max-duration').value, 10),
          silenceTimeoutMs: parseInt(container.querySelector('#field-silence-timeout').value, 10),
          toolsAttached: checkedTools
        };

        storage.saveAgent(updatedAgent);
        Toast.success(`Saved "${updatedAgent.name}"`);
        this.render(container);
      });
    }

    // Dynamic Language / Voice Auto-Sync
    const langSelect = container.querySelector('#field-agent-lang');
    const voiceSelect = container.querySelector('#field-agent-voice');
    const genderSelect = container.querySelector('#field-agent-gender');
    const greetingTextarea = container.querySelector('#field-agent-greeting');

    if (langSelect && voiceSelect) {
      langSelect.addEventListener('change', () => {
        const isHi = langSelect.value.startsWith('hi');
        const isM = (genderSelect?.value || 'Female').toLowerCase().startsWith('m');
        if (isHi) {
          const targetVoice = isM ? 'Madhur (Authentic Hindi Male)' : 'Swara (Authentic Hindi Female)';
          const matchOpt = Array.from(voiceSelect.options).find(o => o.value.includes(isM ? 'Madhur' : 'Swara'));
          if (matchOpt) voiceSelect.value = matchOpt.value;

          const currentG = greetingTextarea?.value || '';
          if (!currentG || currentG.startsWith('Hello') || !/[\u0900-\u097F]/.test(currentG)) {
            const firstName = container.querySelector('#field-agent-name')?.value?.split('—')[0]?.trim() || 'Maya';
            greetingTextarea.value = `नमस्ते! कॉल करने के लिए धन्यवाद। मेरा नाम ${firstName} है। बताइए मैं आपकी क्या सहायता कर सकती हूँ?`;
          }
          Toast.info('Switched agent voice to authentic Hindi Neural');
        }
      });
    }

    // Test Agent Call
    const testAgentBtn = container.querySelector('#btn-studio-test-agent');
    if (testAgentBtn) {
      testAgentBtn.addEventListener('click', () => {
        const currentLang = container.querySelector('#field-agent-lang')?.value || agent.language || 'en-US';
        const currentGreeting = container.querySelector('#field-agent-greeting')?.value || agent.greeting;
        const currentVoice = container.querySelector('#field-agent-voice')?.value || agent.voiceName;
        const currentGender = container.querySelector('#field-agent-gender')?.value || agent.gender;
        this.onTestAgent({
          ...agent,
          language: currentLang,
          greeting: currentGreeting,
          voiceName: currentVoice,
          gender: currentGender
        });
      });
    }
  }
}
