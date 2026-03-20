import { LLMRequest, StreamChunk } from '@/types';
import { ProviderCallResult, StreamCallback } from './index';
import { appendAdditionalParams } from './shared';

const BASE_URL = 'https://api.perplexity.ai/v1/agent';

// Preset IDs map to our model IDs
const PRESET_MAP: Record<string, string> = {
  'pplx-fast-search': 'fast-search',
  'pplx-pro-search': 'pro-search',
  'pplx-deep-research': 'deep-research',
  'pplx-advanced-deep-research': 'advanced-deep-research',
};

function buildBody(req: LLMRequest) {
  const handledKeys = ['max_tokens', 'reasoning_steps'];
  const preset = PRESET_MAP[req.model];

  const body: Record<string, unknown> = {
    input: req.userPrompt,
    tools: [{ type: 'web_search' }],
  };

  if (preset) {
    body.preset = preset;
  } else {
    // Custom model (e.g., "openai/gpt-5.4" via Agent API)
    body.model = req.model;
  }

  if (req.systemPrompt) {
    body.instructions = req.systemPrompt;
  }

  if (req.parameters.max_tokens) {
    body.max_output_tokens = req.parameters.max_tokens;
  }

  if (req.parameters.reasoning_steps !== undefined) {
    body.reasoning_steps = req.parameters.reasoning_steps;
  }

  return appendAdditionalParams(body, req.parameters, handledKeys);
}

function getHeaders() {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`,
  };
}

export async function callPerplexityAgent(req: LLMRequest): Promise<ProviderCallResult> {
  const res = await fetch(BASE_URL, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(buildBody(req)),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Perplexity Agent API error ${res.status}: ${err}`);
  }

  const data = await res.json();

  // Agent API response format: { output: [...], output_text: "...", usage: {...} }
  const content = data.output_text
    ?? data.output?.filter((o: { type: string }) => o.type === 'message')
        .flatMap((o: { content: Array<{ text: string }> }) => o.content)
        .map((c: { text: string }) => c.text)
        .join('')
    ?? '';

  return {
    content,
    inputTokens: data.usage?.input_tokens ?? 0,
    outputTokens: data.usage?.output_tokens ?? 0,
  };
}

export async function streamPerplexityAgent(req: LLMRequest, onChunk: StreamCallback): Promise<ProviderCallResult> {
  const body = buildBody(req);
  body.stream = true;

  const res = await fetch(BASE_URL, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Perplexity Agent API error ${res.status}: ${err}`);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  let content = '';
  let inputTokens = 0;
  let outputTokens = 0;
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data: ')) continue;
      const data = trimmed.slice(6);
      if (data === '[DONE]') continue;

      try {
        const parsed = JSON.parse(data);

        // Agent API streams response.output_text.delta or response.completed
        if (parsed.type === 'response.output_text.delta' && parsed.delta) {
          content += parsed.delta;
          onChunk({ type: 'delta', content: parsed.delta });
        }

        // Also handle chat-completions-style delta for compatibility
        if (parsed.choices?.[0]?.delta?.content) {
          const delta = parsed.choices[0].delta.content;
          content += delta;
          onChunk({ type: 'delta', content: delta });
        }

        // Usage info
        if (parsed.type === 'response.completed' && parsed.response?.usage) {
          inputTokens = parsed.response.usage.input_tokens ?? inputTokens;
          outputTokens = parsed.response.usage.output_tokens ?? outputTokens;
        }
        if (parsed.usage) {
          inputTokens = parsed.usage.input_tokens ?? parsed.usage.prompt_tokens ?? inputTokens;
          outputTokens = parsed.usage.output_tokens ?? parsed.usage.completion_tokens ?? outputTokens;
        }
      } catch { /* skip */ }
    }
  }

  onChunk({ type: 'done' });
  return { content, inputTokens, outputTokens };
}
