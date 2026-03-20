import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);
const PYTHON_COMMANDS = [
  ...(process.env.PYTHON_BIN ? [process.env.PYTHON_BIN] : []),
  'python3',
  'python',
];

type TemplateToken =
  | { type: 'text'; value: string }
  | { type: 'expr'; value: string; raw: string };

function parseTemplate(template: string): TemplateToken[] {
  const tokens: TemplateToken[] = [];
  let textBuffer = '';
  let index = 0;

  while (index < template.length) {
    const char = template[index];

    if (char === '{' && template[index + 1] === '{') {
      textBuffer += '{';
      index += 2;
      continue;
    }

    if (char === '}' && template[index + 1] === '}') {
      textBuffer += '}';
      index += 2;
      continue;
    }

    if (char !== '{') {
      textBuffer += char;
      index += 1;
      continue;
    }

    const startIndex = index;
    let expression = '';
    let depth = 1;
    let quote: '"' | "'" | null = null;
    let escaped = false;
    index += 1;

    while (index < template.length) {
      const currentChar = template[index];

      if (escaped) {
        expression += currentChar;
        escaped = false;
        index += 1;
        continue;
      }

      if (quote) {
        expression += currentChar;
        if (currentChar === '\\') {
          escaped = true;
        } else if (currentChar === quote) {
          quote = null;
        }
        index += 1;
        continue;
      }

      if (currentChar === '"' || currentChar === "'") {
        quote = currentChar;
        expression += currentChar;
        index += 1;
        continue;
      }

      if (currentChar === '{') {
        depth += 1;
        expression += currentChar;
        index += 1;
        continue;
      }

      if (currentChar === '}') {
        depth -= 1;
        if (depth === 0) {
          index += 1;
          break;
        }
        expression += currentChar;
        index += 1;
        continue;
      }

      expression += currentChar;
      index += 1;
    }

    if (depth !== 0) {
      textBuffer += template.slice(startIndex);
      break;
    }

    if (textBuffer) {
      tokens.push({ type: 'text', value: textBuffer });
      textBuffer = '';
    }

    tokens.push({
      type: 'expr',
      value: expression,
      raw: `{${expression}}`,
    });
  }

  if (textBuffer) {
    tokens.push({ type: 'text', value: textBuffer });
  }

  return tokens;
}

function shouldEvaluateExpression(expression: string): boolean {
  const trimmed = expression.trim();
  if (!trimmed) return false;
  if (/^['"[{]/.test(trimmed)) return false;
  return true;
}

async function evaluateExpressions(expressions: string[]): Promise<Map<string, string>> {
  if (expressions.length === 0) {
    return new Map();
  }

  const payload = Buffer.from(JSON.stringify(expressions), 'utf8').toString('base64');
  const pythonScript = `
import base64
import datetime as dt
import json
import os
import sys
import uuid

expressions = json.loads(base64.b64decode(sys.argv[1]).decode('utf-8'))
safe_globals = {"__builtins__": {}}
safe_locals = {
    "datetime": dt.datetime,
    "date": dt.date,
    "time": dt.time,
    "timedelta": dt.timedelta,
    "timezone": dt.timezone,
    "now": dt.datetime.now(),
    "today": dt.date.today(),
    "uuid4": uuid.uuid4,
    "str": str,
    "int": int,
    "float": float,
    "bool": bool,
    "len": len,
    "min": min,
    "max": max,
    "round": round,
    "json": json,
    "os": os,
}

results = []
for expression in expressions:
    try:
        value = eval(expression, safe_globals, safe_locals)
        results.append({"ok": True, "value": str(value)})
    except Exception as exc:
        results.append({"ok": False, "error": f"{type(exc).__name__}: {exc}"})

print(json.dumps({"results": results}, ensure_ascii=False))
`;

  let stdout = '';
  let lastError: unknown = null;

  for (const command of PYTHON_COMMANDS) {
    try {
      const result = await execFileAsync(command, ['-c', pythonScript, payload], {
        maxBuffer: 1024 * 1024,
      });
      stdout = result.stdout;
      lastError = null;
      break;
    } catch (error) {
      lastError = error;
    }
  }

  if (!stdout) {
    throw lastError instanceof Error
      ? lastError
      : new Error('Python runtime not found for prompt template rendering.');
  }

  const parsed = JSON.parse(stdout) as {
    results: Array<{ ok: boolean; value?: string }>;
  };

  const resolved = new Map<string, string>();
  expressions.forEach((expression, index) => {
    const result = parsed.results[index];
    if (result?.ok && result.value !== undefined) {
      resolved.set(expression, result.value);
    }
  });

  return resolved;
}

async function renderTemplate(template: string): Promise<string> {
  const tokens = parseTemplate(template);
  const evaluatedExpressions = await evaluateExpressions(Array.from(new Set(
    tokens
      .filter((token): token is Extract<TemplateToken, { type: 'expr' }> => token.type === 'expr')
      .map((token) => token.value.trim())
      .filter(shouldEvaluateExpression)
  )));

  return renderTokens(tokens, evaluatedExpressions);
}

function renderTokens(tokens: TemplateToken[], evaluatedExpressions: Map<string, string>) {
  return tokens.map((token) => {
    if (token.type === 'text') {
      return token.value;
    }

    const normalizedExpression = token.value.trim();
    return evaluatedExpressions.get(normalizedExpression) ?? token.raw;
  }).join('');
}

export async function renderPromptTemplates(prompts: {
  systemPrompt: string;
  userPrompt: string;
}) {
  const systemTokens = parseTemplate(prompts.systemPrompt || '');
  const userTokens = parseTemplate(prompts.userPrompt || '');
  const expressions = Array.from(new Set(
    [...systemTokens, ...userTokens]
      .filter((token): token is Extract<TemplateToken, { type: 'expr' }> => token.type === 'expr')
      .map((token) => token.value.trim())
      .filter(shouldEvaluateExpression)
  ));
  const evaluatedExpressions = await evaluateExpressions(expressions);

  return {
    systemPrompt: renderTokens(systemTokens, evaluatedExpressions),
    userPrompt: renderTokens(userTokens, evaluatedExpressions),
  };
}
