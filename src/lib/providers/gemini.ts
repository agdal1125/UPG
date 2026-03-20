import { LLMRequest, StreamChunk } from '@/types';
import { ProviderCallResult, StreamCallback } from './index';
import { createRequestDebug, getAdditionalParams } from './shared';

const GEMINI_TOP_LEVEL_KEYS = new Set([
  'cachedContent',
  'safetySettings',
  'tools',
  'toolConfig',
  'labels',
]);

function getBaseUrl(model: string, stream: boolean, apiKey = process.env.GEMINI_API_KEY || '') {
  const action = stream ? 'streamGenerateContent?alt=sse&' : 'generateContent?';
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:${action}key=${apiKey}`;
}

function buildBody(req: LLMRequest) {
  const handledKeys = ['temperature', 'max_tokens', 'top_p', 'top_k'];
  const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];

  if (req.systemPrompt) {
    // Gemini uses system_instruction for system prompts
  }

  contents.push({
    role: 'user',
    parts: [{ text: req.userPrompt }],
  });

  const body: Record<string, unknown> = {
    contents,
    generationConfig: {
      temperature: req.parameters.temperature ?? 0.7,
      ...(req.parameters.top_p !== undefined ? { topP: req.parameters.top_p } : {}),
      ...(req.parameters.top_k !== undefined ? { topK: req.parameters.top_k } : {}),
    },
  };

  if (req.parameters.max_tokens !== undefined) {
    (body.generationConfig as Record<string, unknown>).maxOutputTokens = req.parameters.max_tokens;
  }

  if (req.systemPrompt) {
    body.system_instruction = { parts: [{ text: req.systemPrompt }] };
  }

  if (req.responseFormat) {
    try {
      const schema = JSON.parse(req.responseFormat);
      (body.generationConfig as Record<string, unknown>).responseMimeType = 'application/json';
      (body.generationConfig as Record<string, unknown>).responseSchema = schema;
    } catch {
      (body.generationConfig as Record<string, unknown>).responseMimeType = 'application/json';
    }
  }

  const extraParams = getAdditionalParams(req.parameters, handledKeys);
  for (const [key, value] of Object.entries(extraParams)) {
    if (GEMINI_TOP_LEVEL_KEYS.has(key)) {
      body[key] = value;
      continue;
    }
    (body.generationConfig as Record<string, unknown>)[key] = value;
  }

  return body;
}

export function buildGeminiRequestDebug(req: LLMRequest) {
  return createRequestDebug(
    getBaseUrl(req.model, true, '$GEMINI_API_KEY'),
    {
      'Content-Type': 'application/json',
    },
    buildBody(req),
  );
}

export async function callGemini(req: LLMRequest): Promise<ProviderCallResult> {
  const res = await fetch(getBaseUrl(req.model, false), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(buildBody(req)),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  const content = data.candidates?.[0]?.content?.parts?.map((p: { text: string }) => p.text).join('') ?? '';

  return {
    content,
    inputTokens: data.usageMetadata?.promptTokenCount ?? 0,
    outputTokens: data.usageMetadata?.candidatesTokenCount ?? 0,
  };
}

export async function streamGemini(req: LLMRequest, onChunk: StreamCallback): Promise<ProviderCallResult> {
  const res = await fetch(getBaseUrl(req.model, true), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(buildBody(req)),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${err}`);
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
        const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          content += text;
          onChunk({ type: 'delta', content: text });
        }
        if (parsed.usageMetadata) {
          inputTokens = parsed.usageMetadata.promptTokenCount ?? inputTokens;
          outputTokens = parsed.usageMetadata.candidatesTokenCount ?? outputTokens;
        }
      } catch { /* skip */ }
    }
  }

  onChunk({ type: 'done' });
  return { content, inputTokens, outputTokens };
}
