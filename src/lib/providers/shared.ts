import { JSONValue, LLMParameters, ProviderRequestDebug } from '@/types';

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

export function createRequestDebug(
  url: string,
  headers: Record<string, string>,
  body: Record<string, unknown>,
): ProviderRequestDebug {
  return {
    method: 'POST',
    url,
    headers,
    body,
    code: buildFetchCodeSnippet(url, headers, body),
  };
}

function buildFetchCodeSnippet(
  url: string,
  headers: Record<string, string>,
  body: Record<string, unknown>,
) {
  const headersJson = JSON.stringify(headers, null, 2);
  const bodyJson = JSON.stringify(body, null, 2);

  return [
    `const response = await fetch(${JSON.stringify(url)}, {`,
    `  method: 'POST',`,
    `  headers: ${headersJson},`,
    `  body: JSON.stringify(${bodyJson}),`,
    `});`,
    ``,
    `const data = await response.json();`,
    `console.log(data);`,
  ].join('\n');
}
