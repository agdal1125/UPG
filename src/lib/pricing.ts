import { ModelInfo, Provider, ParamDef } from '@/types';

// Parameter definitions - each model references these by key
export const PARAM_DEFS: Record<string, ParamDef> = {
  temperature:       { key: 'temperature',       label: 'Temperature',       type: 'range',  min: 0, max: 2, step: 0.05, default: 0.7 },
  top_p:             { key: 'top_p',             label: 'Top P',             type: 'range',  min: 0, max: 1, step: 0.05, default: 1.0 },
  top_k:             { key: 'top_k',             label: 'Top K',             type: 'number', min: 1, max: 100, step: 1, default: 40 },
  frequency_penalty: { key: 'frequency_penalty', label: 'Freq. Penalty',     type: 'range',  min: -2, max: 2, step: 0.1, default: 0 },
  presence_penalty:  { key: 'presence_penalty',  label: 'Presence Penalty',  type: 'range',  min: -2, max: 2, step: 0.1, default: 0 },
  reasoning_effort:  { key: 'reasoning_effort',  label: 'Reasoning Effort',  type: 'select', default: 'medium', options: [
    { label: 'Low', value: 'low' },
    { label: 'Medium', value: 'medium' },
    { label: 'High', value: 'high' },
  ]},
  web_search:        { key: 'web_search',        label: 'Force Web Search',  type: 'checkbox', default: false },
};

// Common param sets per provider
const OPENAI_CHAT_PARAMS   = ['temperature', 'top_p', 'frequency_penalty', 'presence_penalty', 'web_search'];
const OPENAI_REASON_PARAMS = ['reasoning_effort', 'web_search'];
const ANTHROPIC_PARAMS     = ['temperature', 'top_p', 'top_k'];
const GEMINI_PARAMS        = ['temperature', 'top_p', 'top_k'];
const PERPLEXITY_PARAMS    = ['temperature', 'top_p', 'frequency_penalty', 'presence_penalty'];
const PPLX_AGENT_PARAMS: string[] = [];

export const MODELS: ModelInfo[] = [
  // OpenAI - GPT-5.4 family (flagship)
  { id: 'gpt-5.4',      name: 'GPT-5.4',      provider: 'openai', inputPrice: 5.0,  outputPrice: 15.0, contextWindow: 1047576, supportsStreaming: true, supportsJsonMode: true, supportedParams: OPENAI_CHAT_PARAMS },
  { id: 'gpt-5.4-mini', name: 'GPT-5.4 Mini', provider: 'openai', inputPrice: 1.5,  outputPrice: 6.0,  contextWindow: 1047576, supportsStreaming: true, supportsJsonMode: true, supportedParams: OPENAI_CHAT_PARAMS },
  { id: 'gpt-5.4-nano', name: 'GPT-5.4 Nano', provider: 'openai', inputPrice: 0.5,  outputPrice: 2.0,  contextWindow: 1047576, supportsStreaming: true, supportsJsonMode: true, supportedParams: OPENAI_CHAT_PARAMS },
  // OpenAI - GPT-4.1 family
  { id: 'gpt-4.1',      name: 'GPT-4.1',      provider: 'openai', inputPrice: 2.0,  outputPrice: 8.0,  contextWindow: 1047576, supportsStreaming: true, supportsJsonMode: true, supportedParams: OPENAI_CHAT_PARAMS },
  { id: 'gpt-4.1-mini', name: 'GPT-4.1 Mini', provider: 'openai', inputPrice: 0.4,  outputPrice: 1.6,  contextWindow: 1047576, supportsStreaming: true, supportsJsonMode: true, supportedParams: OPENAI_CHAT_PARAMS },
  { id: 'gpt-4.1-nano', name: 'GPT-4.1 Nano', provider: 'openai', inputPrice: 0.1,  outputPrice: 0.4,  contextWindow: 1047576, supportsStreaming: true, supportsJsonMode: true, supportedParams: OPENAI_CHAT_PARAMS },
  // OpenAI - GPT-4o family
  { id: 'gpt-4o',       name: 'GPT-4o',       provider: 'openai', inputPrice: 2.5,  outputPrice: 10.0, contextWindow: 128000,  supportsStreaming: true, supportsJsonMode: true, supportedParams: OPENAI_CHAT_PARAMS },
  { id: 'gpt-4o-mini',  name: 'GPT-4o Mini',  provider: 'openai', inputPrice: 0.15, outputPrice: 0.6,  contextWindow: 128000,  supportsStreaming: true, supportsJsonMode: true, supportedParams: OPENAI_CHAT_PARAMS },
  // OpenAI - o-series (reasoning)
  { id: 'o4-mini', name: 'o4-mini', provider: 'openai', inputPrice: 1.1, outputPrice: 4.4, contextWindow: 200000, supportsStreaming: true, supportsJsonMode: true, supportedParams: OPENAI_REASON_PARAMS },
  { id: 'o3',      name: 'o3',      provider: 'openai', inputPrice: 2.0, outputPrice: 8.0, contextWindow: 200000, supportsStreaming: true, supportsJsonMode: true, supportedParams: OPENAI_REASON_PARAMS },
  { id: 'o3-mini', name: 'o3-mini', provider: 'openai', inputPrice: 1.1, outputPrice: 4.4, contextWindow: 200000, supportsStreaming: true, supportsJsonMode: true, supportedParams: OPENAI_REASON_PARAMS },

  // Anthropic Claude
  { id: 'claude-opus-4-6-20250626',   name: 'Claude Opus 4.6',   provider: 'anthropic', inputPrice: 5.0, outputPrice: 25.0, contextWindow: 200000, maxTokens: 32000, supportsStreaming: true, supportsJsonMode: true, supportedParams: ANTHROPIC_PARAMS },
  { id: 'claude-sonnet-4-5-20250514', name: 'Claude Sonnet 4.5', provider: 'anthropic', inputPrice: 3.0, outputPrice: 15.0, contextWindow: 200000, maxTokens: 16000, supportsStreaming: true, supportsJsonMode: true, supportedParams: ANTHROPIC_PARAMS },
  { id: 'claude-haiku-4-5-20251001',  name: 'Claude Haiku 4.5',  provider: 'anthropic', inputPrice: 1.0, outputPrice: 5.0,  contextWindow: 200000, maxTokens: 8192,  supportsStreaming: true, supportsJsonMode: true, supportedParams: ANTHROPIC_PARAMS },

  // Google Gemini
  { id: 'gemini-2.5-pro',   name: 'Gemini 2.5 Pro',   provider: 'gemini', inputPrice: 1.25, outputPrice: 10.0, contextWindow: 1048576, supportsStreaming: true, supportsJsonMode: true, supportedParams: GEMINI_PARAMS },
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', provider: 'gemini', inputPrice: 0.15, outputPrice: 0.6,  contextWindow: 1048576, supportsStreaming: true, supportsJsonMode: true, supportedParams: GEMINI_PARAMS },
  { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', provider: 'gemini', inputPrice: 0.1,  outputPrice: 0.4,  contextWindow: 1048576, supportsStreaming: true, supportsJsonMode: true, supportedParams: GEMINI_PARAMS },

  // Perplexity
  { id: 'sonar-pro',           name: 'Sonar Pro',           provider: 'perplexity', inputPrice: 3.0, outputPrice: 15.0, contextWindow: 200000,  supportsStreaming: true,  supportsJsonMode: true,  supportedParams: PERPLEXITY_PARAMS },
  { id: 'sonar-reasoning-pro', name: 'Sonar Reasoning Pro', provider: 'perplexity', inputPrice: 3.0, outputPrice: 15.0, contextWindow: 128000,  supportsStreaming: true,  supportsJsonMode: true,  supportedParams: PERPLEXITY_PARAMS },
  { id: 'sonar',               name: 'Sonar',               provider: 'perplexity', inputPrice: 1.0, outputPrice: 1.0,  contextWindow: 128000,  supportsStreaming: true,  supportsJsonMode: true,  supportedParams: PERPLEXITY_PARAMS },
  { id: 'sonar-deep-research', name: 'Sonar Deep Research', provider: 'perplexity', inputPrice: 2.0, outputPrice: 8.0,  contextWindow: 128000,  supportsStreaming: false, supportsJsonMode: false, supportedParams: [] },

  // Perplexity Agent API (Presets)
  { id: 'pplx-fast-search',            name: 'Fast Search',            provider: 'perplexity-agent', inputPrice: 1.0, outputPrice: 1.0,  contextWindow: 128000,  supportsStreaming: true,  supportsJsonMode: false, supportedParams: PPLX_AGENT_PARAMS },
  { id: 'pplx-pro-search',             name: 'Pro Search',             provider: 'perplexity-agent', inputPrice: 3.0, outputPrice: 15.0, contextWindow: 128000,  supportsStreaming: true,  supportsJsonMode: false, supportedParams: PPLX_AGENT_PARAMS },
  { id: 'pplx-deep-research',          name: 'Deep Research',          provider: 'perplexity-agent', inputPrice: 2.0, outputPrice: 8.0,  contextWindow: 128000,  supportsStreaming: true,  supportsJsonMode: false, supportedParams: PPLX_AGENT_PARAMS },
  { id: 'pplx-advanced-deep-research', name: 'Advanced Deep Research', provider: 'perplexity-agent', inputPrice: 5.0, outputPrice: 25.0, contextWindow: 128000,  supportsStreaming: true,  supportsJsonMode: false, supportedParams: PPLX_AGENT_PARAMS },
  // Perplexity Agent API (Direct Models)
  // Models with tiered/cache pricing are represented with a single base uncached rate here.
  { id: 'perplexity/sonar',                     name: 'Sonar',                     provider: 'perplexity-agent', inputPrice: 1.0,  outputPrice: 1.0,  supportsStreaming: true, supportsJsonMode: false, supportedParams: PPLX_AGENT_PARAMS },
  { id: 'anthropic/claude-opus-4-6',            name: 'Claude Opus 4.6',           provider: 'perplexity-agent', inputPrice: 15.0, outputPrice: 75.0, supportsStreaming: true, supportsJsonMode: false, supportedParams: PPLX_AGENT_PARAMS },
  { id: 'anthropic/claude-opus-4-5',            name: 'Claude Opus 4.5',           provider: 'perplexity-agent', inputPrice: 15.0, outputPrice: 75.0, supportsStreaming: true, supportsJsonMode: false, supportedParams: PPLX_AGENT_PARAMS },
  { id: 'anthropic/claude-sonnet-4-6',          name: 'Claude Sonnet 4.6',         provider: 'perplexity-agent', inputPrice: 3.0,  outputPrice: 15.0, supportsStreaming: true, supportsJsonMode: false, supportedParams: PPLX_AGENT_PARAMS },
  { id: 'anthropic/claude-sonnet-4-5',          name: 'Claude Sonnet 4.5',         provider: 'perplexity-agent', inputPrice: 3.0,  outputPrice: 15.0, supportsStreaming: true, supportsJsonMode: false, supportedParams: PPLX_AGENT_PARAMS },
  { id: 'anthropic/claude-haiku-4-5',           name: 'Claude Haiku 4.5',          provider: 'perplexity-agent', inputPrice: 1.0,  outputPrice: 5.0,  supportsStreaming: true, supportsJsonMode: false, supportedParams: PPLX_AGENT_PARAMS },
  { id: 'openai/gpt-5.4',                       name: 'GPT-5.4',                   provider: 'perplexity-agent', inputPrice: 2.5,  outputPrice: 15.0, supportsStreaming: true, supportsJsonMode: false, supportedParams: PPLX_AGENT_PARAMS },
  { id: 'openai/gpt-5.2',                       name: 'GPT-5.2',                   provider: 'perplexity-agent', inputPrice: 2.0,  outputPrice: 8.0,  supportsStreaming: true, supportsJsonMode: false, supportedParams: PPLX_AGENT_PARAMS },
  { id: 'openai/gpt-5.1',                       name: 'GPT-5.1',                   provider: 'perplexity-agent', inputPrice: 1.25, outputPrice: 10.0, supportsStreaming: true, supportsJsonMode: false, supportedParams: PPLX_AGENT_PARAMS },
  { id: 'openai/gpt-5-mini',                    name: 'GPT-5 Mini',                provider: 'perplexity-agent', inputPrice: 0.25, outputPrice: 2.0,  supportsStreaming: true, supportsJsonMode: false, supportedParams: PPLX_AGENT_PARAMS },
  { id: 'google/gemini-3.1-pro-preview',        name: 'Gemini 3.1 Pro Preview',    provider: 'perplexity-agent', inputPrice: 3.0,  outputPrice: 15.0, supportsStreaming: true, supportsJsonMode: false, supportedParams: PPLX_AGENT_PARAMS },
  { id: 'google/gemini-3-flash-preview',        name: 'Gemini 3 Flash Preview',    provider: 'perplexity-agent', inputPrice: 0.3,  outputPrice: 0.4,  supportsStreaming: true, supportsJsonMode: false, supportedParams: PPLX_AGENT_PARAMS },
  { id: 'google/gemini-2.5-pro',                name: 'Gemini 2.5 Pro',            provider: 'perplexity-agent', inputPrice: 1.25, outputPrice: 10.0, supportsStreaming: true, supportsJsonMode: false, supportedParams: PPLX_AGENT_PARAMS },
  { id: 'google/gemini-2.5-flash',              name: 'Gemini 2.5 Flash',          provider: 'perplexity-agent', inputPrice: 0.3,  outputPrice: 2.5,  supportsStreaming: true, supportsJsonMode: false, supportedParams: PPLX_AGENT_PARAMS },
  { id: 'nvidia/nemotron-3-super-120b-a12b',    name: 'Nemotron Super 120B',       provider: 'perplexity-agent', inputPrice: 0.12, outputPrice: 0.3,  supportsStreaming: true, supportsJsonMode: false, supportedParams: PPLX_AGENT_PARAMS },
  { id: 'xai/grok-4-1-fast-non-reasoning',      name: 'Grok 4.1 Fast',             provider: 'perplexity-agent', inputPrice: 5.0,  outputPrice: 25.0, supportsStreaming: true, supportsJsonMode: false, supportedParams: PPLX_AGENT_PARAMS },
];

export function getModelsByProvider(provider: Provider): ModelInfo[] {
  return MODELS.filter(m => m.provider === provider);
}

export function getModelInfo(modelId: string): ModelInfo | undefined {
  return MODELS.find(m => m.id === modelId);
}

export function calculateCost(modelId: string, inputTokens: number, outputTokens: number): number {
  const model = getModelInfo(modelId);
  if (!model) return 0;
  return (inputTokens / 1_000_000) * model.inputPrice + (outputTokens / 1_000_000) * model.outputPrice;
}

export function getDefaultParams(modelId: string): Record<string, number | string | boolean> {
  const model = getModelInfo(modelId);
  if (!model) return {};
  const params: Record<string, number | string | boolean> = {};
  for (const key of model.supportedParams) {
    const def = PARAM_DEFS[key];
    if (def) params[key] = def.default;
  }
  return params;
}

export const PROVIDER_LABELS: Record<Provider, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  gemini: 'Google Gemini',
  perplexity: 'Perplexity',
  'perplexity-agent': 'Perplexity Agentic API',
};

export const PROVIDER_COLORS: Record<Provider, string> = {
  openai: '#10a37f',
  anthropic: '#d97706',
  gemini: '#4285f4',
  perplexity: '#22d3ee',
  'perplexity-agent': '#a78bfa',
};
