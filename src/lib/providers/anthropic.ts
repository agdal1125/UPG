import { LLMRequest, StreamChunk } from '@/types';
import { ProviderCallResult, StreamCallback } from './index';
import { appendAdditionalParams, createRequestDebug } from './shared';

const BASE_URL = 'https://api.anthropic.com/v1/messages';

function buildBody(req: LLMRequest, stream: boolean) {
  const handledKeys = ['max_tokens', 'temperature', 'top_p', 'top_k'];
  const body: Record<string, unknown> = {
    model: req.model,
    system: req.systemPrompt || undefined,
    messages: [{ role: 'user', content: req.userPrompt }],
    // Anthropic requires max_tokens, so we keep a backend fallback even though the UI no longer forces it.
    max_tokens: req.parameters.max_tokens ?? 4096,
    stream,
  };

  if (req.parameters.temperature !== undefined) body.temperature = req.parameters.temperature;
  if (req.parameters.top_p !== undefined) body.top_p = req.parameters.top_p;
  if (req.parameters.top_k !== undefined) body.top_k = req.parameters.top_k;

  return appendAdditionalParams(body, req.parameters, handledKeys);
}

function getHeaders() {
  return {
    'Content-Type': 'application/json',
    'x-api-key': process.env.ANTHROPIC_API_KEY || '',
    'anthropic-version': '2023-06-01',
  };
}

export function buildAnthropicRequestDebug(req: LLMRequest) {
  return createRequestDebug(
    BASE_URL,
    {
      'Content-Type': 'application/json',
      'x-api-key': '$ANTHROPIC_API_KEY',
      'anthropic-version': '2023-06-01',
    },
    buildBody(req, true),
  );
}

export async function callAnthropic(req: LLMRequest): Promise<ProviderCallResult> {
  const res = await fetch(BASE_URL, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(buildBody(req, false)),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Anthropic API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  const content = data.content?.map((c: { type: string; text: string }) => c.text).join('') ?? '';

  return {
    content,
    inputTokens: data.usage?.input_tokens ?? 0,
    outputTokens: data.usage?.output_tokens ?? 0,
  };
}

export async function streamAnthropic(req: LLMRequest, onChunk: StreamCallback): Promise<ProviderCallResult> {
  const res = await fetch(BASE_URL, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(buildBody(req, true)),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Anthropic API error ${res.status}: ${err}`);
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

      try {
        const parsed = JSON.parse(trimmed.slice(6));

        if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
          content += parsed.delta.text;
          onChunk({ type: 'delta', content: parsed.delta.text });
        }

        if (parsed.type === 'message_start' && parsed.message?.usage) {
          inputTokens = parsed.message.usage.input_tokens ?? 0;
        }

        if (parsed.type === 'message_delta' && parsed.usage) {
          outputTokens = parsed.usage.output_tokens ?? 0;
        }
      } catch { /* skip malformed */ }
    }
  }

  onChunk({ type: 'done' });
  return { content, inputTokens, outputTokens };
}
