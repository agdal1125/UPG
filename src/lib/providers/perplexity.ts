import { LLMRequest, StreamChunk } from '@/types';
import { ProviderCallResult, StreamCallback } from './index';
import { appendAdditionalParams, createRequestDebug } from './shared';

const BASE_URL = 'https://api.perplexity.ai/chat/completions';

function buildBody(req: LLMRequest, stream: boolean) {
  const handledKeys = [
    'temperature',
    'max_tokens',
    'top_p',
    'frequency_penalty',
    'presence_penalty',
  ];
  const body: Record<string, unknown> = {
    model: req.model,
    messages: [
      ...(req.systemPrompt ? [{ role: 'system', content: req.systemPrompt }] : []),
      { role: 'user', content: req.userPrompt },
    ],
    stream,
    temperature: req.parameters.temperature ?? 0.7,
  };

  if (req.parameters.max_tokens !== undefined) {
    body.max_tokens = req.parameters.max_tokens;
  }

  if (req.parameters.top_p !== undefined) body.top_p = req.parameters.top_p;
  if (req.parameters.frequency_penalty !== undefined) body.frequency_penalty = req.parameters.frequency_penalty;
  if (req.parameters.presence_penalty !== undefined) body.presence_penalty = req.parameters.presence_penalty;

  if (req.responseFormat) {
    try {
      const schema = JSON.parse(req.responseFormat);
      body.response_format = { type: 'json_schema', json_schema: { name: 'response', schema } };
    } catch {
      body.response_format = { type: 'json_object' };
    }
  }

  return appendAdditionalParams(body, req.parameters, handledKeys);
}

export function buildPerplexityRequestDebug(req: LLMRequest) {
  return createRequestDebug(
    BASE_URL,
    {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer $PERPLEXITY_API_KEY',
    },
    buildBody(req, true),
  );
}

export async function callPerplexity(req: LLMRequest): Promise<ProviderCallResult> {
  const res = await fetch(BASE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`,
    },
    body: JSON.stringify(buildBody(req, false)),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Perplexity API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return {
    content: data.choices?.[0]?.message?.content ?? '',
    inputTokens: data.usage?.prompt_tokens ?? 0,
    outputTokens: data.usage?.completion_tokens ?? 0,
  };
}

export async function streamPerplexity(req: LLMRequest, onChunk: StreamCallback): Promise<ProviderCallResult> {
  const res = await fetch(BASE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`,
    },
    body: JSON.stringify(buildBody(req, true)),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Perplexity API error ${res.status}: ${err}`);
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
        const delta = parsed.choices?.[0]?.delta?.content;
        if (delta) {
          content += delta;
          onChunk({ type: 'delta', content: delta });
        }
        if (parsed.usage) {
          inputTokens = parsed.usage.prompt_tokens ?? inputTokens;
          outputTokens = parsed.usage.completion_tokens ?? outputTokens;
        }
      } catch { /* skip */ }
    }
  }

  onChunk({ type: 'done' });
  return { content, inputTokens, outputTokens };
}
