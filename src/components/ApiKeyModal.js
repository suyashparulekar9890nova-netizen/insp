import { LLMService } from '../services/llmService.js';
import { Toast } from './Toast.js';

export class ApiKeyModal {
  constructor() {
    this.container = null;
  }

  open() {
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.id = 'api-key-modal-root';
      document.body.appendChild(this.container);
    }

    this.render();
  }

  render() {
    const config = LLMService.getConfig();

    this.container.innerHTML = `
      <div class="call-modal-overlay open" id="api-key-modal-backdrop">
        <div class="call-modal-content" style="max-width: 580px;">
          <!-- Header -->
          <div class="call-modal-header" style="background: linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(6, 182, 212, 0.15)); border-bottom: 1px solid var(--border-medium);">
            <div style="display: flex; align-items: center; gap: 0.65rem;">
              <span style="font-size: 1.4rem;">🔑</span>
              <div>
                <h3 style="font-size: 1.1rem; font-weight: 800; color: #fff;">
                  LLM API Key Settings
                </h3>
                <div style="font-size: 0.75rem; color: var(--text-muted);">
                  Enable 100% spontaneous, unscripted voice responses matching your agent's persona
                </div>
              </div>
            </div>
            <button class="btn-secondary" id="btn-close-apikey-modal" style="padding: 0.2rem 0.5rem;">✕</button>
          </div>

          <!-- Body -->
          <form id="form-api-key" style="padding: 1.5rem;">
            <!-- Provider Selection -->
            <div class="form-group">
              <label class="form-label">LLM Provider</label>
              <select class="form-select" id="field-api-provider">
                <option value="xai" ${config.provider === 'xai' ? 'selected' : ''}>xAI Grok (grok-2-latest, grok-beta)</option>
                <option value="groq" ${config.provider === 'groq' ? 'selected' : ''}>Groq Cloud (openai/gpt-oss-120b, qwen3.8-27b, Ultra-Fast)</option>
                <option value="gemini" ${config.provider === 'gemini' ? 'selected' : ''}>Google Gemini (Gemini 1.5 Flash)</option>
                <option value="openai" ${config.provider === 'openai' ? 'selected' : ''}>OpenAI (GPT-4o-mini / GPT-4o)</option>
                <option value="custom" ${config.provider === 'custom' ? 'selected' : ''}>Custom OpenAI-Compatible / Proxy (grok2api, Together, Ollama)</option>
              </select>
            </div>

            <!-- Model Selection -->
            <div class="form-group" id="group-model-select">
              <label class="form-label">Model Name</label>
              <input type="text" class="form-input" id="field-api-model" value="${config.model || (config.provider === 'xai' ? 'grok-2-latest' : (config.provider === 'groq' ? 'qwen/qwen3.8-27b' : 'gemini-1.5-flash'))}" placeholder="e.g. qwen/qwen3.8-27b or openai/gpt-oss-120b" required />
              <div class="form-hint" id="hint-model-presets">
                ${config.provider === 'xai' ? 'Recommended: <code>grok-2-latest</code> or <code>grok-beta</code>.' : (config.provider === 'groq' ? 'Recommended: <code>qwen/qwen3.8-27b</code> or <code>openai/gpt-oss-120b</code> for sub-100ms voice generation.' : 'Recommended: <code>gemini-1.5-flash</code> for conversational phone latency.')}
              </div>
            </div>

            <!-- Custom Endpoint (if custom provider) -->
            <div class="form-group" id="group-custom-endpoint" style="display: ${config.provider === 'custom' ? 'block' : 'none'};">
              <label class="form-label">Custom Base Endpoint URL</label>
              <input type="url" class="form-input" id="field-api-endpoint" value="${config.customEndpoint || ''}" placeholder="https://api.x.ai/v1/chat/completions or http://localhost:8000/v1/chat/completions" />
              <div class="form-hint">Use this if you are proxying Grok via a local gateway or grok2api reverse proxy.</div>
            </div>

            <!-- API Key Input with Auto-Detection -->
            <div class="form-group">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem;">
                <label class="form-label" style="margin-bottom: 0;">API Key</label>
                <a href="${config.provider === 'xai' ? 'https://console.x.ai' : (config.provider === 'groq' ? 'https://console.groq.com/keys' : 'https://aistudio.google.com/app/apikey')}" target="_blank" rel="noopener noreferrer" id="link-get-api-key" style="font-size: 0.74rem; color: var(--cyan-400); text-decoration: underline;">
                  ${config.provider === 'xai' ? 'Get xAI Key →' : (config.provider === 'groq' ? 'Get Free Groq Key →' : 'Get Free Gemini Key →')}
                </a>
              </div>
              <div style="position: relative;">
                <input type="password" class="form-input" id="field-api-key" value="${config.apiKey || ''}" placeholder="Paste your key here (e.g. grok_... or xai-... or gsk_...)" required style="padding-right: 70px; font-family: var(--font-mono);" />
                <button type="button" class="btn-secondary" id="btn-toggle-key-visibility" style="position: absolute; right: 6px; top: 6px; padding: 0.2rem 0.5rem; font-size: 0.72rem;">
                  Show
                </button>
              </div>
              <div id="api-key-detected-badge" style="font-size: 0.74rem; color: var(--emerald-400); margin-top: 0.3rem; font-weight: 600;">
                ${config.apiKey?.startsWith('grok_') || config.apiKey?.startsWith('xai-') ? '✓ xAI Grok Key Active' : (config.apiKey?.startsWith('gsk_') ? '✓ Groq API Key Detected' : (config.apiKey?.startsWith('AIza') ? '✓ Google Gemini API Key Detected' : (config.apiKey?.startsWith('sk-') ? '✓ OpenAI API Key Detected' : '')))}
              </div>
              <div class="form-hint">Loaded from your environment (.env) or stored securely in your browser's private storage.</div>
            </div>

            <!-- Test Connection Result Box -->
            <div id="api-test-result" style="display: none; padding: 0.65rem 0.85rem; border-radius: var(--radius-md); font-size: 0.76rem; margin-bottom: 1rem;"></div>

            <!-- Actions -->
            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 1.25rem; border-top: 1px solid var(--border-subtle); padding-top: 1rem;">
              <button type="button" class="btn-secondary" id="btn-test-api-key">
                🧪 Test Connection
              </button>
              <div style="display: flex; gap: 0.6rem;">
                <button type="button" class="btn-secondary" id="btn-cancel-apikey">Cancel</button>
                <button type="submit" class="btn-primary">Save & Enable Live AI</button>
              </div>
            </div>
          </form>
        </div>
      </div>
    `;

    this.attachEvents();
  }

  attachEvents() {
    const close = () => { if (this.container) this.container.innerHTML = ''; };

    this.container.querySelector('#btn-close-apikey-modal').addEventListener('click', close);
    this.container.querySelector('#btn-cancel-apikey').addEventListener('click', close);

    const providerSelect = this.container.querySelector('#field-api-provider');
    const modelInput = this.container.querySelector('#field-api-model');
    const modelHint = this.container.querySelector('#hint-model-presets');
    const endpointGroup = this.container.querySelector('#group-custom-endpoint');
    const getKeyLink = this.container.querySelector('#link-get-api-key');
    const keyInput = this.container.querySelector('#field-api-key');
    const keyBadge = this.container.querySelector('#api-key-detected-badge');

    // Auto-detect key vendor when user types or pastes
    keyInput.addEventListener('input', () => {
      const val = keyInput.value.trim();
      if (val.startsWith('grok_') || val.startsWith('xai-')) {
        providerSelect.value = 'xai';
        modelInput.value = 'grok-2-latest';
        modelHint.innerHTML = 'Recommended: <code>grok-2-latest</code> or <code>grok-beta</code> for conversational reasoning.';
        endpointGroup.style.display = 'none';
        getKeyLink.href = 'https://console.x.ai';
        getKeyLink.textContent = 'Get xAI Key →';
        getKeyLink.style.display = 'inline';
        keyBadge.textContent = '✓ xAI Grok Key Detected';
      } else if (val.startsWith('gsk_')) {
        providerSelect.value = 'groq';
        modelInput.value = 'llama-3.3-70b-versatile';
        modelHint.innerHTML = 'Recommended: <code>llama-3.3-70b-versatile</code> for sub-100ms voice generation.';
        endpointGroup.style.display = 'none';
        getKeyLink.href = 'https://console.groq.com/keys';
        getKeyLink.textContent = 'Get Free Groq Key →';
        getKeyLink.style.display = 'inline';
        keyBadge.textContent = '✓ Groq API Key Detected';
      } else if (val.startsWith('AIza')) {
        providerSelect.value = 'gemini';
        modelInput.value = 'gemini-1.5-flash';
        modelHint.innerHTML = 'Recommended: <code>gemini-1.5-flash</code> for conversational phone latency.';
        endpointGroup.style.display = 'none';
        getKeyLink.href = 'https://aistudio.google.com/app/apikey';
        getKeyLink.textContent = 'Get Free Gemini Key →';
        getKeyLink.style.display = 'inline';
        keyBadge.textContent = '✓ Google Gemini API Key Detected';
      } else if (val.startsWith('sk-')) {
        providerSelect.value = 'openai';
        modelInput.value = 'gpt-4o-mini';
        modelHint.innerHTML = 'Recommended: <code>gpt-4o-mini</code> for fast responses.';
        endpointGroup.style.display = 'none';
        getKeyLink.href = 'https://platform.openai.com/api-keys';
        getKeyLink.textContent = 'Get OpenAI Key →';
        getKeyLink.style.display = 'inline';
        keyBadge.textContent = '✓ OpenAI API Key Detected';
      } else {
        keyBadge.textContent = '';
      }
    });

    providerSelect.addEventListener('change', () => {
      const p = providerSelect.value;
      if (p === 'xai') {
        modelInput.value = 'grok-2-latest';
        modelHint.innerHTML = 'Recommended: <code>grok-2-latest</code> or <code>grok-beta</code>.';
        endpointGroup.style.display = 'none';
        getKeyLink.href = 'https://console.x.ai';
        getKeyLink.textContent = 'Get xAI Key →';
        getKeyLink.style.display = 'inline';
      } else if (p === 'gemini') {
        modelInput.value = 'gemini-1.5-flash';
        modelHint.innerHTML = 'Recommended: <code>gemini-1.5-flash</code> for conversational phone latency.';
        endpointGroup.style.display = 'none';
        getKeyLink.href = 'https://aistudio.google.com/app/apikey';
        getKeyLink.textContent = 'Get Free Gemini Key →';
        getKeyLink.style.display = 'inline';
      } else if (p === 'groq') {
        modelInput.value = 'llama-3.3-70b-versatile';
        modelHint.innerHTML = 'Recommended: <code>llama-3.3-70b-versatile</code> for sub-100ms generation.';
        endpointGroup.style.display = 'none';
        getKeyLink.href = 'https://console.groq.com/keys';
        getKeyLink.textContent = 'Get Free Groq Key →';
        getKeyLink.style.display = 'inline';
      } else if (p === 'openai') {
        modelInput.value = 'gpt-4o-mini';
        modelHint.innerHTML = 'Recommended: <code>gpt-4o-mini</code> for fast responses.';
        endpointGroup.style.display = 'none';
        getKeyLink.href = 'https://platform.openai.com/api-keys';
        getKeyLink.textContent = 'Get OpenAI Key →';
        getKeyLink.style.display = 'inline';
      } else {
        modelInput.value = 'grok-2-latest';
        modelHint.innerHTML = 'Specify any OpenAI-compatible or Grok proxy endpoint and model name.';
        endpointGroup.style.display = 'block';
        getKeyLink.style.display = 'none';
      }
    });

    // Toggle visibility
    const toggleBtn = this.container.querySelector('#btn-toggle-key-visibility');
    toggleBtn.addEventListener('click', () => {
      if (keyInput.type === 'password') {
        keyInput.type = 'text';
        toggleBtn.textContent = 'Hide';
      } else {
        keyInput.type = 'password';
        toggleBtn.textContent = 'Show';
      }
    });

    // Test Key button
    const testBtn = this.container.querySelector('#btn-test-api-key');
    const testResult = this.container.querySelector('#api-test-result');

    testBtn.addEventListener('click', async () => {
      const testConfig = {
        provider: providerSelect.value,
        apiKey: keyInput.value.trim(),
        model: modelInput.value.trim(),
        customEndpoint: this.container.querySelector('#field-api-endpoint')?.value.trim()
      };

      testResult.style.display = 'block';
      testResult.style.background = 'rgba(99, 102, 241, 0.1)';
      testResult.style.border = '1px solid rgba(99, 102, 241, 0.3)';
      testResult.style.color = 'var(--cyan-400)';
      testResult.textContent = `Connecting to ${testConfig.provider.toUpperCase()} (${testConfig.model})...`;

      try {
        const result = await LLMService.testConnection(testConfig);
        testResult.style.background = 'rgba(16, 185, 129, 0.15)';
        testResult.style.border = '1px solid rgba(16, 185, 129, 0.4)';
        testResult.style.color = 'var(--emerald-400)';
        testResult.textContent = `✓ ${result.message}`;
        Toast.success('API Key connection successful!');
      } catch (err) {
        testResult.style.background = 'rgba(244, 63, 94, 0.15)';
        testResult.style.border = '1px solid rgba(244, 63, 94, 0.4)';
        testResult.style.color = 'var(--rose-500)';
        testResult.textContent = `✗ Connection failed: ${err.message}`;
        Toast.error(`Test failed: ${err.message}`);
      }
    });

    // Save Form
    const form = this.container.querySelector('#form-api-key');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const newConfig = {
        provider: providerSelect.value,
        apiKey: keyInput.value.trim(),
        model: modelInput.value.trim(),
        customEndpoint: this.container.querySelector('#field-api-endpoint')?.value.trim()
      };

      const saved = LLMService.saveConfig(newConfig);
      Toast.success(`Live spontaneous responses enabled using ${saved.provider.toUpperCase()} (${saved.model})!`);
      close();
    });
  }
}
