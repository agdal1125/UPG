import { JSONValue, LLMParameters } from '@/types';

export function getAdditionalParams(
  parameters: LLMParameters,
  handledKeys: string[]
): Record<string, JSONValue> {
  const handled = new Set(handledKeys);
  const extraParams: Record<string, JSONValue> = {};

  for (const [key, value] of Object.entries(parameters)) {
    if (handled.has(key) || value === undefined) continue;
    extraParams[key] = value;
  }

  return extraParams;
}

export function appendAdditionalParams(
  body: Record<string, unknown>,
  parameters: LLMParameters,
  handledKeys: string[]
): Record<string, unknown> {
  const extraParams = getAdditionalParams(parameters, handledKeys);

  for (const [key, value] of Object.entries(extraParams)) {
    body[key] = value;
  }

  return body;
}
