import { LLMRequest } from '@/types';
import { ProviderCallResult, StreamCallback } from './index';
import { appendAdditionalParams } from './shared';

const BASE_URL = 'https://api.openai.com/v1/responses';
const REASONING_MODELS = ['gpt-5', 'o3', 'o3-mini', 'o4-mini'];

function isReasoningModel(model: string) {
  return REASONING_MODELS.some((prefix) => model.startsWith(prefix));
}

function mergeInstructions(base: string | undefined, extra: string) {
  if (!base?.trim()) {
    return extra;
  }

  if (base.toLowerCase().includes(extra.toLowerCase())) {
    return base;
  }

  return `${base.trim()}\n\n${extra}`;
}

function normalizeJsonLikeLiterals(input: string) {
  let output = '';
  let inString = false;
  let escaped = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];

    if (inString) {
      output += char;
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      output += char;
      continue;
    }

    const remaining = input.slice(index);
    if (/^True\b/.test(remaining)) {
      output += 'true';
      index += 3;
      continue;
    }
    if (/^False\b/.test(remaining)) {
      output += 'false';
      index += 4;
      continue;
    }
    if (/^None\b/.test(remaining)) {
      output += 'null';
      index += 3;
      continue;
    }

    output += char;
  }

  return output;
}

function removeTrailingCommas(input: string) {
  let output = '';
  let inString = false;
  let escaped = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];

    if (inString) {
      output += char;
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      output += char;
      continue;
    }

    if (char === ',') {
      let nextIndex = index + 1;
      while (nextIndex < input.length && /\s/.test(input[nextIndex])) {
        nextIndex += 1;
      }

      const nextChar = input[nextIndex];
      if (nextChar === '}' || nextChar === ']') {
        continue;
      }
    }

    output += char;
  }

  return output;
}

function parseJsonLike(input: string): unknown {
  try {
    return JSON.parse(input);
  } catch {
    const normalized = removeTrailingCommas(normalizeJsonLikeLiterals(input));
    return JSON.parse(normalized);
  }
}

function sanitizeSchemaName(value: unknown) {
  const normalized = String(value || 'response')
    .trim()
    .replace(/[^A-Za-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '');

  return normalized || 'response';
}

function normalizeJsonSchemaNode(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(normalizeJsonSchemaNode);
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  const record = value as Record<string, unknown>;
  const normalized: Record<string, unknown> = {};

  for (const [key, entryValue] of Object.entries(record)) {
    if (key === 'properties' || key === '$defs' || key === 'definitions' || key === 'patternProperties' || key === 'dependentSchemas') {
      if (entryValue && typeof entryValue === 'object' && !Array.isArray(entryValue)) {
        normalized[key] = Object.fromEntries(
          Object.entries(entryValue as Record<string, unknown>).map(([childKey, childValue]) => [
            childKey,
            normalizeJsonSchemaNode(childValue),
          ]),
        );
      } else {
        normalized[key] = entryValue;
      }
      continue;
    }

    normalized[key] = normalizeJsonSchemaNode(entryValue);
  }

  const type = normalized.type;
  const isObjectType = type === 'object' || (Array.isArray(type) && type.includes('object'));
  if (isObjectType || normalized.properties) {
    normalized.additionalProperties = false;
  }

  return normalized;
}

function normalizeJsonSchema(schema: unknown) {
  return normalizeJsonSchemaNode(schema) as Record<string, unknown>;
}

function buildStructuredOutputFormat(rawResponseFormat: string): Record<string, unknown> {
  const parsed = parseJsonLike(rawResponseFormat);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Response format must be a JSON object.');
  }

  const root = parsed as Record<string, unknown>;
  const wrappedJsonSchema = root.json_schema && typeof root.json_schema === 'object'
    ? root.json_schema as Record<string, unknown>
    : null;

  const schemaContainer = root.type === 'json_schema' && wrappedJsonSchema
    ? wrappedJsonSchema
    : wrappedJsonSchema || root;

  const schemaCandidate = schemaContainer.schema && typeof schemaContainer.schema === 'object'
    ? schemaContainer.schema
    : root.schema && typeof root.schema === 'object'
      ? root.schema
      : schemaContainer;

  const format: Record<string, unknown> = {
    type: 'json_schema',
    name: sanitizeSchemaName(schemaContainer.name),
    strict: schemaContainer.strict === undefined ? true : Boolean(schemaContainer.strict),
    schema: normalizeJsonSchema(schemaCandidate),
  };

  if (typeof schemaContainer.description === 'string' && schemaContainer.description.trim()) {
    format.description = schemaContainer.description.trim();
  }

  return format;
}

function extractResponseText(data: Record<string, unknown> | undefined): string {
  if (!data) return '';

  const directOutputText = data.output_text;
  if (typeof directOutputText === 'string') {
    return directOutputText;
  }

  const output = Array.isArray(data.output) ? data.output : [];
  const parts: string[] = [];

  for (const item of output) {
    if (!item || typeof item !== 'object') continue;
    const content = Array.isArray((item as Record<string, unknown>).content)
      ? ((item as Record<string, unknown>).content as Array<unknown>)
      : [];

    for (const chunk of content) {
      if (!chunk || typeof chunk !== 'object') continue;
      const record = chunk as Record<string, unknown>;
      if ((record.type === 'output_text' || record.type === 'text') && typeof record.text === 'string') {
        parts.push(record.text);
      }
    }
  }

  return parts.join('');
}

function extractUsage(data: Record<string, unknown> | undefined) {
  const usage = data?.usage;
  if (!usage || typeof usage !== 'object') {
    return { inputTokens: 0, outputTokens: 0 };
  }

  const usageRecord = usage as Record<string, unknown>;
  return {
    inputTokens: Number(usageRecord.input_tokens ?? 0),
    outputTokens: Number(usageRecord.output_tokens ?? 0),
  };
}

function buildBody(req: LLMRequest, stream: boolean) {
  const isReasoning = isReasoningModel(req.model);
  const handledKeys = [
    'max_tokens',
    'reasoning_effort',
    'temperature',
    'top_p',
    'frequency_penalty',
    'presence_penalty',
    'web_search',
  ];

  const body: Record<string, unknown> = {
    model: req.model,
    input: req.userPrompt,
    stream,
  };

  if (req.systemPrompt) {
    body.instructions = req.systemPrompt;
  }

  if (req.parameters.max_tokens !== undefined) {
    body.max_output_tokens = req.parameters.max_tokens;
  }

  if (req.parameters.reasoning_effort) {
    body.reasoning = { effort: req.parameters.reasoning_effort };
  }

  if (!isReasoning) {
    body.temperature = req.parameters.temperature ?? 0.7;
    if (req.parameters.top_p !== undefined) body.top_p = req.parameters.top_p;
    if (req.parameters.frequency_penalty !== undefined) body.frequency_penalty = req.parameters.frequency_penalty;
    if (req.parameters.presence_penalty !== undefined) body.presence_penalty = req.parameters.presence_penalty;
  }

  if (req.responseFormat) {
    try {
      body.text = {
        format: buildStructuredOutputFormat(req.responseFormat),
      };
      body.instructions = mergeInstructions(
        typeof body.instructions === 'string' ? body.instructions : undefined,
        'Return valid JSON that matches the requested schema.',
      );
    } catch {
      body.instructions = mergeInstructions(
        typeof body.instructions === 'string' ? body.instructions : undefined,
        'Return a valid JSON object.',
      );
    }
  }

  if (req.parameters.web_search === true) {
    body.tools = [{ type: 'web_search' }];
    body.tool_choice = 'required';
  }

  return appendAdditionalParams(body, req.parameters, handledKeys);
}

async function handleError(res: Response) {
  const err = await res.text();
  throw new Error(`OpenAI API error ${res.status}: ${err}`);
}

export async function callOpenAI(req: LLMRequest): Promise<ProviderCallResult> {
  const res = await fetch(BASE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify(buildBody(req, false)),
  });

  if (!res.ok) {
    await handleError(res);
  }

  const data = await res.json() as Record<string, unknown>;
  const usage = extractUsage(data);

  return {
    content: extractResponseText(data),
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
  };
}

function parseEventData(rawEvent: string) {
  const dataLines = rawEvent
    .split('\n')
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trimStart());

  if (dataLines.length === 0) {
    return null;
  }

  const data = dataLines.join('\n');
  if (!data || data === '[DONE]') {
    return null;
  }

  return JSON.parse(data) as Record<string, unknown>;
}

function syncFinalContent(
  content: string,
  finalContent: string,
  onChunk: StreamCallback,
) {
  if (!finalContent || finalContent === content) {
    return finalContent || content;
  }

  if (finalContent.startsWith(content)) {
    const delta = finalContent.slice(content.length);
    if (delta) onChunk({ type: 'delta', content: delta });
    return finalContent;
  }

  onChunk({ type: 'delta', content: finalContent });
  return finalContent;
}

export async function streamOpenAI(req: LLMRequest, onChunk: StreamCallback): Promise<ProviderCallResult> {
  const res = await fetch(BASE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify(buildBody(req, true)),
  });

  if (!res.ok) {
    await handleError(res);
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

    while (true) {
      const separatorIndex = buffer.indexOf('\n\n');
      if (separatorIndex < 0) break;

      const rawEvent = buffer.slice(0, separatorIndex);
      buffer = buffer.slice(separatorIndex + 2);

      const parsed = parseEventData(rawEvent);
      if (!parsed) continue;

      if (parsed.type === 'response.output_text.delta' && typeof parsed.delta === 'string') {
        content += parsed.delta;
        onChunk({ type: 'delta', content: parsed.delta });
        continue;
      }

      if (parsed.type === 'response.completed' && parsed.response && typeof parsed.response === 'object') {
        const response = parsed.response as Record<string, unknown>;
        content = syncFinalContent(content, extractResponseText(response), onChunk);
        const usage = extractUsage(response);
        inputTokens = usage.inputTokens;
        outputTokens = usage.outputTokens;
        continue;
      }

      if (parsed.type === 'response.failed' && parsed.response && typeof parsed.response === 'object') {
        const response = parsed.response as Record<string, unknown>;
        const error = response.error;
        if (error && typeof error === 'object' && typeof (error as Record<string, unknown>).message === 'string') {
          throw new Error((error as Record<string, unknown>).message as string);
        }
        throw new Error('OpenAI response failed.');
      }

      if (parsed.type === 'error') {
        const error = parsed.error;
        if (error && typeof error === 'object' && typeof (error as Record<string, unknown>).message === 'string') {
          throw new Error((error as Record<string, unknown>).message as string);
        }
        throw new Error('OpenAI stream error.');
      }
    }
  }

  onChunk({ type: 'done' });
  return { content, inputTokens, outputTokens };
}
