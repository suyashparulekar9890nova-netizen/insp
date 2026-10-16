// AI Agent Architect: Transforms Owner's Business Story + User-Selected Name & Adaptive Personality into a deployable Voice Agent
import { storage } from './storage.js';
import { VoicePipeline } from './voicePipeline.js';

export class AgentArchitect {
  /**
   * Generates a voice agent based on Owner's info, why they need it, and their chosen personality
   * @param {Object} ownerContext
   *   - businessDescription: What the owner does (e.g. "I'm a solo criminal defense attorney in Miami")
   *   - whyNeeded: Why they need an agent / phone struggles (e.g. "I'm in court all day and miss frantic calls from people needing bail")
   *   - tasksToAutomate: What tasks the agent should take off their hands (e.g. "Capture arrest location, charge type, verify court date, quote retainer, emergency dispatch")
   *   - agentName: User-decided name (e.g. "Julian", "Elena")
   *   - basePersonality: User-chosen personality archetype
   *   - customPersonalityDetails: User's extra personality guidance
   *   - voiceModel: Selected voice model
   */
  static generateAgentFromOwnerProfile(ownerContext, workspaceId = null) {
    const wsId = workspaceId || storage.getActiveWorkspaceId();

    const {
      businessDescription = '',
      whyNeeded = '',
      tasksToAutomate = '',
      agentName = 'Nova',
      basePersonality = 'Empathetic & Calming Guardian',
      customPersonalityDetails = '',
      voiceModel = 'Rachel (Warm & Empathetic)'
    } = ownerContext;

    // Determine Avatar & Voice configuration based on personality selection
    let avatar = '🎙️';
    let voiceProvider = 'ElevenLabs Turbo v2.5';
    let voiceId = '21m00Tcm4TlvDq8ikWAM';
    let speakingRate = 1.0;
    let pitch = 0.0;
    let category = 'Owner-Customized Voice Agent';

    if (basePersonality.includes('Empathetic') || basePersonality.includes('Guardian') || basePersonality.includes('Calming')) {
      avatar = '🛡️';
      voiceProvider = 'ElevenLabs Turbo v2.5';
      voiceId = '21m00Tcm4TlvDq8ikWAM';
      speakingRate = 0.98;
    } else if (basePersonality.includes('Executive') || basePersonality.includes('Polished') || basePersonality.includes('Confidant')) {
      avatar = '🏛️';
      voiceProvider = 'OpenAI Realtime';
      voiceId = 'openai-echo';
      speakingRate = 1.0;
    } else if (basePersonality.includes('Efficiency') || basePersonality.includes('Dispatcher') || basePersonality.includes('Rapid')) {
      avatar = '⚡';
      voiceProvider = 'Deepgram Aura';
      voiceId = 'aura-orion-en';
      speakingRate = 1.08;
    } else if (basePersonality.includes('Friendly') || basePersonality.includes('Host') || basePersonality.includes('Warm')) {
      avatar = '✨';
      voiceProvider = 'OpenAI Realtime';
      voiceId = 'openai-nova';
      speakingRate = 1.05;
    } else {
      avatar = '🤖';
    }

    // Synthesize the initial greeting tailored to the owner's craft and base personality
    const greeting = `Hello! Thank you for calling. My name is ${agentName}. I work directly with the owner to handle your inquiries. How can I assist you right now?`;

    // Construct the System Prompt with the Adaptive Customer Personality Matrix
    const systemPrompt = `You are ${agentName}, the trusted voice agent representing the business owner.

## WHO THE BUSINESS OWNER IS & WHAT THEY DO:
"${businessDescription}"

## WHY THE OWNER ENLISTED YOU (THEIR PAIN POINTS & STRUGGLES):
"${whyNeeded}"
The owner cannot always be by the phone because they are busy delivering their craft. Your role is to protect their time while treating every caller with the utmost respect.

## KEY TASKS & WORKFLOWS TO AUTOMATE:
"${tasksToAutomate}"
Guide callers through these exact tasks step by step. Collect necessary details (caller full name, contact number, key specifics) and confirm appointments or bookings cleanly.

## BASE PERSONALITY & DEMEANOR:
- Archetype: ${basePersonality}
- Nuances: ${customPersonalityDetails || 'Professional, attentive, solution-oriented'}

## ADAPTIVE PERSONALITY PROTOCOL (CRITICAL REQUIREMENT):
While remaining true to your base personality, you MUST actively monitor the caller's emotional state on the line and adapt your demeanor accordingly:
1. IF CALLER IS PANICKED / ANXIOUS:
   - Lower your speaking cadence. Speak with grounding calm, warmth, and steady assurance.
   - Use reassuring affirmations: "Take a breath, you reached the right place, I am handling this for you right now."
2. IF CALLER IS RUSHED / IMPATIENT:
   - Eliminate pleasantries and conversational filler. Deliver direct, high-value answers in under 12 words.
   - Move swiftly to the immediate next action: "Understood. Give me your phone number and I will lock that slot right now."
3. IF CALLER IS ANGRY / FRUSTRATED:
   - Never be defensive or robotic. Validate their experience with sincere empathy: "I completely understand why that is frustrating, let me fix this immediately."
   - Prioritize resolution or trigger 'transfer_to_human_agent' if unresolvable.
4. IF CALLER IS CHEERFUL / CASUAL:
   - Mirror their warmth, conversational lightness, and friendly rapport.

## COMMUNICATION RULES:
- Keep all spoken turns under 2 to 3 sentences so phone dialogue flows naturally.
- Never read out code or markdown formatting.
- When an emergency or unresolvable issue occurs, execute 'transfer_to_human_agent'.`;

    // Recommend tools based on owner's tasks
    const tasksLower = tasksToAutomate.toLowerCase();
    const tools = ['transfer_to_human_agent'];
    if (tasksLower.includes('book') || tasksLower.includes('schedule') || tasksLower.includes('appointment') || tasksLower.includes('calendar') || tasksLower.includes('slot') || tasksLower.includes('visit')) {
      tools.push('book_calendar_appointment');
    }
    if (tasksLower.includes('track') || tasksLower.includes('order') || tasksLower.includes('status') || tasksLower.includes('load') || tasksLower.includes('delivery') || tasksLower.includes('dispatch')) {
      tools.push('check_order_status');
    }
    if (tasksLower.includes('lead') || tasksLower.includes('crm') || tasksLower.includes('deal') || tasksLower.includes('quote') || tasksLower.includes('retainer')) {
      tools.push('hubspot_create_deal');
    }

    return {
      id: `agent-custom-${Date.now()}`,
      workspaceId: wsId,
      name: `${agentName} — ${basePersonality.split(' ')[0]} Assistant`,
      avatar,
      gender: VoicePipeline.getAgentGender({ name: agentName, voiceName: voiceModel, avatar }) === 'female' ? 'Female' : 'Male',
      badge: 'Adaptive Persona',
      category: 'Owner-Customized Voice Agent',
      role: `Custom Voice Agent for: ${businessDescription.slice(0, 50)}...`,
      ownerContext: {
        businessDescription,
        whyNeeded,
        tasksToAutomate,
        agentName,
        basePersonality,
        customPersonalityDetails
      },
      voiceProvider,
      voiceName: voiceModel,
      voiceId,
      language: 'en-US',
      supportedLanguages: ['en-US', 'es-US'],
      autoLanguageDetect: true,
      speakingRate,
      pitch,
      stability: 0.85,
      greeting,
      systemPrompt,
      maxDurationSeconds: 600,
      silenceTimeoutMs: 3800,
      bargeInAllowed: true,
      sentimentThresholdForEscalation: 0.35,
      toolsAttached: tools,
      totalCallsHandled: 0,
      resolutionRate: 94.0,
      avgCallDuration: '2m 10s',
      createdAt: new Date().toISOString()
    };
  }

  /**
   * Sample Owner Context Presets for quick 1-click inspiration
   */
  static getOwnerPresets() {
    return [
      {
        label: 'Solo Defense Attorney',
        icon: '⚖️',
        businessDescription: 'I am a solo criminal defense attorney in Miami specializing in DUI, bail hearings, and urgent court representation.',
        whyNeeded: 'I am in court trials or confidential client meetings for 6 hours a day. When potential clients get arrested, their family calls frantically. If I do not pick up immediately, they call the next lawyer on Google and I lose a $5,000 retainer.',
        tasksToAutomate: 'Calm the distressed family down, capture the defendant full name, jail/booking facility, charges, verify if a bond hearing has been scheduled, quote our consultation policy, and send me an urgent text alert for immediate callback.',
        suggestedName: 'Elena',
        suggestedPersonality: 'Empathetic & Calming Guardian'
      },
      {
        label: 'Boutique Wedding Bakery',
        icon: '🎂',
        businessDescription: 'We are a boutique custom bakery in Brooklyn creating bespoke multi-tier wedding cakes and artisanal dessert bars.',
        whyNeeded: 'During baking and piping hours my hands are covered in flour and melted chocolate. People call during morning rush asking if we do gluten-free tastings or what our calendar availability is for June weddings, and ringing phones ruin delicate cake decorating.',
        tasksToAutomate: 'Greet callers warmly, answer standard wedding pricing ($800 minimum), explain our seasonal tasting boxes, capture their event date and guest count, and book a private design consultation on our calendar.',
        suggestedName: 'Amelie',
        suggestedPersonality: 'Warm & Friendly Community Host'
      },
      {
        label: 'Emergency 24-Hour Plumber',
        icon: '🚰',
        businessDescription: 'I run a licensed residential plumbing company with 3 dispatch vans handling burst pipes, water heaters, and sewer backups.',
        whyNeeded: 'I am under crawlspaces or driving between jobs when urgent calls ring at 2 AM. Homeowners are frantic because water is pouring through their ceiling, and my receptionist cannot work 24/7.',
        tasksToAutomate: 'Determine if there is active flooding, instruct them how to turn off the main water shutoff valve, quote our $99 diagnostic dispatch fee, capture their exact street address, and dispatch our on-call van immediately.',
        suggestedName: 'Garrick',
        suggestedPersonality: 'High-Efficiency Rapid Dispatcher'
      },
      {
        label: 'Private Wealth Family Office',
        icon: '💼',
        businessDescription: 'We provide multi-family wealth advisory, tax-advantaged estate transitions, and private equity access for high-net-worth clients.',
        whyNeeded: 'Our ultra-high-net-worth clients and their family accountants expect discreet, pristine service. We need a front-of-house concierge who can screen prospective investors and book private briefings with managing partners without sounding robotic or intrusive.',
        tasksToAutomate: 'Discreetly verify caller identity, screen investable asset tier ($2M+ minimum), capture their primary objective (estate, trusts, alternative liquidity), and schedule a private Zoom or boardroom consultation with Senior Partner Arthur.',
        suggestedName: 'Julian',
        suggestedPersonality: 'Polished Executive Confidant'
      }
    ];
  }
}
