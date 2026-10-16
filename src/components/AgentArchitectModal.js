import { storage, voiceModelsCatalog } from '../services/storage.js';
import { AgentArchitect } from '../services/agentArchitect.js';
import { VoicePipeline } from '../services/voicePipeline.js';
import { Toast } from './Toast.js';

export class AgentArchitectModal {
  constructor(options = {}) {
    this.container = null;
    this.currentStep = 1; // 1: Owner Story, 2: Name & Personality, 3: Review & Deploy
    this.ownerData = {
      businessDescription: '',
      whyNeeded: '',
      tasksToAutomate: '',
      agentName: 'Elena',
      basePersonality: 'Empathetic & Calming Guardian',
      customPersonalityDetails: '',
      voiceModel: 'Rachel (Warm & Empathetic)'
    };
    this.generatedAgent = null;
    this.onAgentDeployed = options.onAgentDeployed || (() => {});
  }

  open(prefilledBusiness = '') {
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.id = 'agent-architect-modal-root';
      document.body.appendChild(this.container);
    }

    this.currentStep = 1;
    this.generatedAgent = null;
    if (prefilledBusiness) {
      this.ownerData.businessDescription = prefilledBusiness;
    }

    this.render();
  }

  render() {
    this.container.innerHTML = `
      <div class="call-modal-overlay open" id="architect-modal-backdrop">
        <div class="call-modal-content" style="width: 880px; max-width: 95vw; max-height: 92vh;">
          <!-- Header -->
          <div class="call-modal-header" style="background: linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(6, 182, 212, 0.15)); border-bottom: 1px solid var(--border-medium);">
            <div style="display: flex; align-items: center; gap: 0.75rem;">
              <div style="width: 42px; height: 42px; border-radius: var(--radius-md); background: linear-gradient(135deg, var(--indigo-500), var(--cyan-400)); display: flex; align-items: center; justify-content: center; font-size: 1.35rem; box-shadow: 0 0 15px var(--cyan-glow);">
                ✨
              </div>
              <div>
                <h3 style="font-size: 1.15rem; font-weight: 800; color: #fff;">
                  AI Voice Agent Architect
                </h3>
                <div style="font-size: 0.76rem; color: var(--text-muted);">
                  Step ${this.currentStep} of 2: ${this.currentStep === 1 ? 'Your Business & Operational Needs' : 'Agent Name & Adaptive Personality'}
                </div>
              </div>
            </div>
            <button class="btn-secondary" id="btn-close-architect" style="padding: 0.25rem 0.6rem;">✕</button>
          </div>

          <!-- Body -->
          <div style="padding: 1.5rem; overflow-y: auto; max-height: calc(92vh - 80px);" id="architect-step-content">
            ${this.currentStep === 1 ? this.renderStep1() : (this.currentStep === 2 ? this.renderStep2() : this.renderStep3())}
          </div>
        </div>
      </div>
    `;

    this.attachEvents();
  }

  renderStep1() {
    const presets = AgentArchitect.getOwnerPresets();

    return `
      <!-- Step 1: Owner Information Intake -->
      <div style="margin-bottom: 1.25rem;">
        <div style="font-size: 0.88rem; color: var(--text-light); line-height: 1.5; margin-bottom: 1rem; background: rgba(99, 102, 241, 0.08); border: 1px solid rgba(99, 102, 241, 0.25); padding: 0.85rem 1rem; border-radius: var(--radius-md);">
          💡 <strong>Tell us who you are and why you need an agent.</strong> Instead of giving a dry technical prompt, share what you do and what phone calls overwhelm you. The AI will design custom workflows around your life.
        </div>

        <!-- Question 1: What the owner does -->
        <div class="form-group">
          <label class="form-label" style="font-weight: 700; font-size: 0.85rem;">
            1. Who are you and what do you do? (Your craft, business, or practice)
          </label>
          <textarea class="form-textarea" id="field-owner-business" rows="3" placeholder="e.g. I am a solo criminal defense attorney in Miami handling DUI and urgent bond hearings..." style="font-size: 0.86rem; line-height: 1.45;">${this.ownerData.businessDescription}</textarea>
        </div>

        <!-- Question 2: Why needed / Pain points -->
        <div class="form-group">
          <label class="form-label" style="font-weight: 700; font-size: 0.85rem;">
            2. Why do you need an agent right now? (What is happening on the phones that frustrates you?)
          </label>
          <textarea class="form-textarea" id="field-owner-why" rows="3" placeholder="e.g. I am in court trials for 6 hours a day and miss frantic calls from families of arrested defendants. If I don't pick up immediately, they call another lawyer and I lose a $5,000 case..." style="font-size: 0.86rem; line-height: 1.45;">${this.ownerData.whyNeeded}</textarea>
        </div>

        <!-- Question 3: Tasks to automate -->
        <div class="form-group">
          <label class="form-label" style="font-weight: 700; font-size: 0.85rem;">
            3. What specific tasks should the agent take off your hands according to your description?
          </label>
          <textarea class="form-textarea" id="field-owner-tasks" rows="3" placeholder="e.g. Calm down the distressed family, capture the defendant name, jail location, and charges, verify court date, quote our consultation policy, and dispatch urgent alerts..." style="font-size: 0.86rem; line-height: 1.45;">${this.ownerData.tasksToAutomate}</textarea>
        </div>

        <!-- Quick Owner Presets for Inspiration -->
        <div style="margin-top: 1.25rem;">
          <div style="font-size: 0.74rem; text-transform: uppercase; color: var(--text-dim); font-weight: 700; margin-bottom: 0.5rem;">
            Or Click a Business Owner Profile to Pre-fill:
          </div>
          <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 0.65rem;">
            ${presets.map(p => `
              <div class="bp-chip-card owner-preset-chip" data-label="${p.label}" style="background: var(--bg-darkest); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 0.65rem; cursor: pointer; transition: all 0.15s ease;">
                <div style="display: flex; align-items: center; gap: 0.4rem; font-weight: 700; font-size: 0.82rem; color: var(--text-main);">
                  <span>${p.icon}</span>
                  <span>${p.label}</span>
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Next Button -->
        <div style="display: flex; justify-content: flex-end; margin-top: 1.5rem; border-top: 1px solid var(--border-subtle); padding-top: 1rem;">
          <button class="btn-primary" id="btn-next-to-step2" style="background: linear-gradient(135deg, var(--indigo-500), var(--cyan-400)); padding: 0.55rem 1.4rem;">
            <span>Next: Name & Adaptive Personality</span>
            <span>→</span>
          </button>
        </div>
      </div>
    `;
  }

  renderStep2() {
    const personalityArchetypes = [
      {
        id: 'Empathetic & Calming Guardian',
        icon: '🛡️',
        title: 'Empathetic & Calming Guardian',
        description: 'Warm, steady, reassuring. Ideal for distressed callers, healthcare, emergency legal, or crisis situations.'
      },
      {
        id: 'High-Efficiency Rapid Dispatcher',
        icon: '⚡',
        title: 'High-Efficiency Rapid Dispatcher',
        description: 'Crisp, authoritative, zero-fluff. Perfect for trades, freight logistics, towing, and urgent field dispatch.'
      },
      {
        id: 'Polished Executive Confidant',
        icon: '🏛️',
        title: 'Polished Executive Confidant',
        description: 'Refined, discreet, articulate. Tailored for family offices, luxury sales, and high-net-worth consulting.'
      },
      {
        id: 'Warm & Friendly Community Host',
        icon: '✨',
        title: 'Warm & Friendly Community Host',
        description: 'Enthusiastic, relational, cheerful. Great for boutique bakeries, dining, salon studios, and creative shops.'
      }
    ];

    return `
      <!-- Step 2: Name & Adaptive Personality Selection -->
      <div style="margin-bottom: 1.25rem;">
        <!-- Agent Name Input -->
        <div class="form-group">
          <label class="form-label" style="font-weight: 700; font-size: 0.85rem;">
            Agent Name (What should callers hear when the bot introduces itself?)
          </label>
          <input type="text" class="form-input" id="field-agent-chosen-name" value="${this.ownerData.agentName}" placeholder="e.g. Elena, Maya, Marcus, or Arthur" required style="font-size: 0.95rem; font-weight: 600;" />
        </div>

        <!-- Base Personality Archetype Selection -->
        <div class="form-group" style="margin-top: 1.25rem;">
          <label class="form-label" style="font-weight: 700; font-size: 0.85rem; margin-bottom: 0.3rem;">
            Base Personality Archetype
          </label>
          <div style="font-size: 0.75rem; color: var(--text-dim); margin-bottom: 0.75rem;">
            This personality forms the foundation of your agent's character and voice tone.
          </div>

          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 0.75rem;">
            ${personalityArchetypes.map(arch => `
              <div class="personality-card ${this.ownerData.basePersonality === arch.id ? 'selected' : ''}" data-personality="${arch.id}" style="background: var(--bg-darkest); border: 1px solid ${this.ownerData.basePersonality === arch.id ? 'var(--indigo-500)' : 'var(--border-subtle)'}; border-radius: var(--radius-md); padding: 0.85rem; cursor: pointer; transition: all 0.15s ease;">
                <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.35rem;">
                  <span style="font-size: 1.2rem;">${arch.icon}</span>
                  <strong style="font-size: 0.85rem; color: #fff;">${arch.title}</strong>
                </div>
                <div style="font-size: 0.74rem; color: var(--text-muted); line-height: 1.35;">
                  ${arch.description}
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Adaptive Dynamic Emotion Mirroring Highlight (Core Requirement) -->
        <div style="background: linear-gradient(135deg, rgba(16, 185, 129, 0.08), rgba(6, 182, 212, 0.08)); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: var(--radius-md); padding: 0.85rem 1rem; margin-top: 1.25rem;">
          <div style="display: flex; align-items: center; gap: 0.5rem; font-weight: 700; font-size: 0.85rem; color: var(--emerald-400); margin-bottom: 0.35rem;">
            <span>🧠</span>
            <span>Real-Time Customer Emotion Adaptation (Active)</span>
          </div>
          <div style="font-size: 0.76rem; color: var(--text-light); line-height: 1.45;">
            The agent's baseline personality will <strong>dynamically sense and adapt to the customer on the line</strong>:
            <ul style="margin-left: 1.2rem; margin-top: 0.35rem; color: var(--text-muted);">
              <li>If customer is <strong>Panicked / Anxious</strong> → agent slows down, speaks with steady, calming assurance.</li>
              <li>If customer is <strong>Rushed / Impatient</strong> → agent cuts pleasantries, delivering answers in &lt;10 words.</li>
              <li>If customer is <strong>Angry / Frustrated</strong> → agent validates their feelings without defensiveness and acts urgently.</li>
              <li>If customer is <strong>Cheerful / Friendly</strong> → agent mirrors warmth and natural rapport.</li>
            </ul>
          </div>
        </div>

        <!-- Custom Personality Nuance Input -->
        <div class="form-group" style="margin-top: 1rem;">
          <label class="form-label" style="font-size: 0.8rem;">
            Optional: Any custom nuances or specific phrases you want it to use?
          </label>
          <input type="text" class="form-input" id="field-custom-personality" value="${this.ownerData.customPersonalityDetails}" placeholder="e.g. Speak with quiet confidence, address callers respectfully by Sir/Ma'am, reassure them help is on the way" />
        </div>

        <!-- Voice Selection & Audio Audition -->
        <div style="background: var(--bg-darkest); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 0.85rem; margin-top: 1rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem;">
          <div style="flex: 1; min-width: 220px;">
            <label class="form-label" style="font-size: 0.78rem; margin-bottom: 0.25rem;">Voice Profile Model</label>
            <select class="form-select" id="field-owner-voice" style="font-size: 0.82rem; padding: 0.4rem 0.65rem;">
              ${voiceModelsCatalog.map(v => `
                <option value="${v.name}" ${v.name.includes(this.ownerData.voiceModel?.split(' ')[0]) ? 'selected' : ''}>
                  ${v.provider} • ${v.name}
                </option>
              `).join('')}
            </select>
          </div>
          <button type="button" class="btn-secondary" id="btn-audition-step2-voice" style="font-size: 0.76rem; padding: 0.4rem 0.85rem;">
            🔊 Audition Voice Audio
          </button>
        </div>

        <!-- Navigation Buttons -->
        <div style="display: flex; justify-content: space-between; margin-top: 1.5rem; border-top: 1px solid var(--border-subtle); padding-top: 1rem;">
          <button class="btn-secondary" id="btn-back-to-step1">
            ← Back to My Story
          </button>
          <button class="btn-primary" id="btn-generate-custom-agent" style="background: linear-gradient(135deg, var(--indigo-500), var(--cyan-400)); padding: 0.55rem 1.4rem;">
            <span>✨</span>
            <span>Synthesize & Host My Agent</span>
          </button>
        </div>
      </div>
    `;
  }

  renderStep3() {
    const agent = this.generatedAgent;

    return `
      <!-- Step 3: Synthesis Review & 1-Click Deployment -->
      <div style="background: var(--bg-card); border: 1px solid var(--border-medium); border-radius: var(--radius-lg); padding: 1.5rem; box-shadow: var(--shadow-lg);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
          <div style="display: flex; align-items: center; gap: 0.85rem;">
            <div style="font-size: 2.2rem; width: 56px; height: 56px; border-radius: var(--radius-md); background: var(--bg-elevated); display: flex; align-items: center; justify-content: center; border: 2px solid var(--indigo-500); box-shadow: 0 0 15px var(--indigo-glow);">
              ${agent.avatar}
            </div>
            <div>
              <div style="font-size: 1.25rem; font-weight: 800; color: #fff;">${agent.name}</div>
              <div style="font-size: 0.8rem; color: var(--cyan-400); margin-top: 0.15rem;">
                Base Persona: <strong>${agent.ownerContext.basePersonality}</strong>
              </div>
            </div>
          </div>
          <span class="badge-status success">✓ Ready to Host</span>
        </div>

        <!-- Spoken Greeting Box -->
        <div style="background: var(--bg-darkest); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 1rem; margin-bottom: 1rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem;">
            <span style="font-size: 0.74rem; text-transform: uppercase; color: var(--text-dim); font-weight: 700;">
              🔊 Spoken Phone Greeting (First Turn)
            </span>
            <button class="btn-secondary" id="btn-audition-step3" style="font-size: 0.72rem; padding: 0.2rem 0.6rem;">
              🔊 Play Voice Audition
            </button>
          </div>
          <div style="font-size: 0.85rem; color: var(--text-light); font-style: italic; line-height: 1.4;">
            "${agent.greeting}"
          </div>
        </div>

        <!-- Telemetry & Tools Grid -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 0.75rem; margin-bottom: 1rem;">
          <div style="background: var(--bg-darkest); padding: 0.75rem; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">
            <div style="font-size: 0.7rem; color: var(--text-dim);">Voice Provider</div>
            <div style="font-size: 0.85rem; font-weight: 700; color: var(--text-main);">${agent.voiceName}</div>
          </div>
          <div style="background: var(--bg-darkest); padding: 0.75rem; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">
            <div style="font-size: 0.7rem; color: var(--text-dim);">Adaptive Emotion Mirroring</div>
            <div style="font-size: 0.85rem; font-weight: 700; color: var(--emerald-400);">Enabled (Panicked/Rushed/Angry)</div>
          </div>
          <div style="background: var(--bg-darkest); padding: 0.75rem; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">
            <div style="font-size: 0.7rem; color: var(--text-dim);">Assigned Tools</div>
            <div style="font-size: 0.82rem; font-weight: 600; color: var(--cyan-400);">${agent.toolsAttached.join(', ')}</div>
          </div>
        </div>

        <!-- Collapsible System Prompt -->
        <details style="background: var(--bg-darkest); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 0.75rem; margin-bottom: 1.25rem;">
          <summary style="font-size: 0.78rem; font-weight: 700; color: var(--text-muted); cursor: pointer;">
            View Complete Synthesized System Prompt with Emotion Matrix (Click to Expand)
          </summary>
          <pre style="font-family: var(--font-mono); font-size: 0.74rem; color: var(--text-light); white-space: pre-wrap; margin-top: 0.6rem; max-height: 180px; overflow-y: auto; line-height: 1.5;">${agent.systemPrompt}</pre>
        </details>

        <!-- Actions -->
        <div style="display: flex; justify-content: flex-end; gap: 0.75rem; border-top: 1px solid var(--border-subtle); padding-top: 1rem;">
          <button class="btn-secondary" id="btn-save-custom-to-studio">
            💾 Save to Agent Studio
          </button>
          <button class="btn-primary" id="btn-deploy-custom-and-call" style="background: linear-gradient(135deg, var(--indigo-500), var(--cyan-400));">
            <span>⚡</span>
            <span>1-Click Deploy & Call Now</span>
          </button>
        </div>
      </div>
    `;
  }

  attachEvents() {
    const closeBtn = this.container.querySelector('#btn-close-architect');
    closeBtn.addEventListener('click', () => this.close());

    if (this.currentStep === 1) {
      // Step 1 event attachments
      const presets = AgentArchitect.getOwnerPresets();
      const presetChips = this.container.querySelectorAll('.owner-preset-chip');
      const bDesc = this.container.querySelector('#field-owner-business');
      const bWhy = this.container.querySelector('#field-owner-why');
      const bTasks = this.container.querySelector('#field-owner-tasks');

      presetChips.forEach(chip => {
        chip.addEventListener('click', () => {
          const label = chip.getAttribute('data-label');
          const p = presets.find(x => x.label === label);
          if (p) {
            bDesc.value = p.businessDescription;
            bWhy.value = p.whyNeeded;
            bTasks.value = p.tasksToAutomate;
            this.ownerData.businessDescription = p.businessDescription;
            this.ownerData.whyNeeded = p.whyNeeded;
            this.ownerData.tasksToAutomate = p.tasksToAutomate;
            this.ownerData.agentName = p.suggestedName;
            this.ownerData.basePersonality = p.suggestedPersonality;
            Toast.info(`Pre-filled "${p.label}" story!`);
          }
        });
      });

      const nextBtn = this.container.querySelector('#btn-next-to-step2');
      nextBtn.addEventListener('click', () => {
        this.ownerData.businessDescription = bDesc.value.trim();
        this.ownerData.whyNeeded = bWhy.value.trim();
        this.ownerData.tasksToAutomate = bTasks.value.trim();

        if (!this.ownerData.businessDescription) {
          Toast.error('Please describe what you or your business does.');
          return;
        }

        this.currentStep = 2;
        this.render();
      });
    } else if (this.currentStep === 2) {
      // Step 2 event attachments
      const nameInput = this.container.querySelector('#field-agent-chosen-name');
      const customNuanceInput = this.container.querySelector('#field-custom-personality');
      const voiceSelect = this.container.querySelector('#field-owner-voice');
      const backBtn = this.container.querySelector('#btn-back-to-step1');
      const generateBtn = this.container.querySelector('#btn-generate-custom-agent');
      const auditionBtn = this.container.querySelector('#btn-audition-step2-voice');

      backBtn.addEventListener('click', () => {
        this.currentStep = 1;
        this.render();
      });

      // Personality cards selection
      const cards = this.container.querySelectorAll('.personality-card');
      cards.forEach(card => {
        card.addEventListener('click', () => {
          cards.forEach(c => c.style.borderColor = 'var(--border-subtle)');
          card.style.borderColor = 'var(--indigo-500)';
          this.ownerData.basePersonality = card.getAttribute('data-personality');
        });
      });

      // Audition Voice in Step 2
      auditionBtn.addEventListener('click', () => {
        const chosenName = nameInput.value.trim() || 'Elena';
        const sampleLine = `Hello! Thank you for calling. My name is ${chosenName}, and I am here to assist you right now.`;
        const targetGender = VoicePipeline.getAgentGender({ name: chosenName, voiceName: voiceSelect.value });
        const isMale = targetGender === 'male';

        VoicePipeline.playVoiceAudition({
          text: sampleLine,
          language: 'en-US',
          isMale,
          onStart: () => {
            Toast.info(`Auditioning sample ${isMale ? 'Male' : 'Female'} voice greeting for "${chosenName}"...`);
          }
        });
      });

      generateBtn.addEventListener('click', () => {
        this.ownerData.agentName = nameInput.value.trim() || 'Elena';
        this.ownerData.customPersonalityDetails = customNuanceInput.value.trim();
        this.ownerData.voiceModel = voiceSelect.value;

        // Show generation loading state
        const content = this.container.querySelector('#architect-step-content');
        content.innerHTML = `
          <div style="padding: 2.5rem; text-align: center;">
            <div style="font-size: 2.8rem; margin-bottom: 0.85rem; animation: spinGlow 2s infinite linear;">⚡</div>
            <div style="font-size: 1.1rem; font-weight: 800; color: var(--cyan-400);">
              Synthesizing Voice Agent for "${this.ownerData.agentName}"...
            </div>
            <div style="font-size: 0.8rem; color: var(--text-dim); margin-top: 0.4rem;">
              Injecting Adaptive Customer Emotion Matrix (${this.ownerData.basePersonality}) & calibrating tools.
            </div>
          </div>
        `;

        setTimeout(() => {
          this.generatedAgent = AgentArchitect.generateAgentFromOwnerProfile(this.ownerData);
          this.currentStep = 3;
          this.render();
          Toast.success(`Successfully synthesized "${this.generatedAgent.name}"!`);
        }, 1200);
      });
    } else if (this.currentStep === 3) {
      // Step 3 event attachments
      const agent = this.generatedAgent;

      const auditionStep3Btn = this.container.querySelector('#btn-audition-step3');
      auditionStep3Btn.addEventListener('click', () => {
        const targetGender = VoicePipeline.getAgentGender(agent);
        const isMale = targetGender === 'male';
        const isHindi = (agent.language || '').startsWith('hi');

        VoicePipeline.playVoiceAudition({
          text: agent.greeting,
          language: agent.language,
          isMale,
          onStart: () => {
            const voiceLabel = isHindi 
              ? (isMale ? 'Madhur Neural Hindi (Male)' : 'Swara Neural Hindi (Female)') 
              : `${isMale ? 'Male' : 'Female'} Voice`;
            Toast.info(`Playing ${voiceLabel} greeting for ${agent.name}...`);
          }
        });
      });

      const saveBtn = this.container.querySelector('#btn-save-custom-to-studio');
      saveBtn.addEventListener('click', () => {
        storage.saveAgent(agent);
        Toast.success(`Voice agent "${agent.name}" saved to workspace studio!`);
        this.close();
        this.onAgentDeployed(agent, false);
      });

      const deployBtn = this.container.querySelector('#btn-deploy-custom-and-call');
      deployBtn.addEventListener('click', () => {
        storage.saveAgent(agent);

        // Auto-provision an inbound DID
        const randDid = `+1 (${Math.floor(200 + Math.random() * 700)}) ${Math.floor(200 + Math.random() * 800)}-${Math.floor(1000 + Math.random() * 9000)}`;
        const assignedNum = {
          id: `num-${Date.now()}`,
          workspaceId: agent.workspaceId,
          phoneNumber: randDid,
          type: 'Local Direct (Auto-Provisioned)',
          provider: 'Twilio SIP',
          label: `${agent.name.split('—')[0].trim()} Inbound Line`,
          assignedAgentId: agent.id,
          status: 'Active',
          capabilities: ['Voice', 'SMS'],
          inboundRouting: 'Direct to Bot',
          businessHours: '24/7 Always Open',
          monthlyCost: '$1.50/mo',
          totalCallsReceived: 0
        };
        storage.savePhoneNumber(assignedNum);

        Toast.success(`Deployed "${agent.name}" with DID ${assignedNum.phoneNumber}! Launching live voice call...`);
        this.close();
        this.onAgentDeployed(agent, true);
      });
    }
  }

  close() {
    if (this.container) {
      this.container.innerHTML = '';
    }
  }
}
