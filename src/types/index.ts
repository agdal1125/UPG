export type Provider = 'openai' | 'anthropic' | 'gemini' | 'perplexity' | 'perplexity-agent';
export type JSONValue = string | number | boolean | null | JSONValue[] | { [key: string]: JSONValue };

export interface ParamDef {
  key: string;
  label: string;
  type: 'range' | 'number' | 'select' | 'checkbox';
  min?: number;
  max?: number;
  step?: number;
  default: number | string | boolean;
  options?: { label: string; value: string }[];
}

export interface ModelInfo {
  id: string;
  name: string;
  provider: Provider;
  inputPrice: number;  // per 1M tokens USD
  outputPrice: number; // per 1M tokens USD
  maxTokens?: number;
  contextWindow?: number;
  supportsStreaming: boolean;
  supportsJsonMode: boolean;
  supportedParams: string[]; // keys into PARAM_DEFS
}

export interface LLMParameters {
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  reasoning_effort?: string;
  web_search?: boolean;
  top_k?: number;
  [key: string]: JSONValue | undefined;
}

export interface LLMRequest {
  provider: Provider;
  model: string;
  systemPrompt: string;
  userPrompt: string;
  parameters: LLMParameters;
  responseFormat?: string; // JSON Schema string
  stream?: boolean;
}

export interface LLMResponse {
  provider: Provider;
  model: string;
  content: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  latencyMs: number;
  status: 'success' | 'error';
  error?: string;
}

export interface PromptSet {
  id: string;
  name: string;
  systemPrompt: string;
  userPrompt: string;
  responseFormat?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TestRun {
  id: string;
  batchId?: string;
  batchLabel?: string;
  promptSetId?: string;
  promptLabel?: string;
  promptSource?: 'draft' | 'saved';
  promptOrder?: number;
  systemPrompt: string;
  userPrompt: string;
  responseFormat?: string;
  createdAt: string;
  memo?: string;
  results?: TestResult[];
}

export interface TestResult {
  id: string;
  runId: string;
  provider: Provider;
  model: string;
  parameters: string;
  response: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  latencyMs: number;
  status: 'pending' | 'streaming' | 'success' | 'error';
  error?: string;
  createdAt: string;
}

export interface StreamChunk {
  type: 'delta' | 'usage' | 'done' | 'error';
  content?: string;
  inputTokens?: number;
  outputTokens?: number;
  error?: string;
  model?: string;
  provider?: Provider;
}
