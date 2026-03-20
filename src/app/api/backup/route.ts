import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

type BackupPayload = {
  version: 1;
  exportedAt: string;
  promptSets: Array<Record<string, unknown>>;
  testRuns: Array<Record<string, unknown>>;
  testResults: Array<Record<string, unknown>>;
};

function normalizeArray(value: unknown) {
  return Array.isArray(value) ? value as Array<Record<string, unknown>> : [];
}

export async function GET() {
  const db = getDb();
  const payload: BackupPayload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    promptSets: db.prepare('SELECT * FROM prompt_sets ORDER BY updated_at DESC').all() as Array<Record<string, unknown>>,
    testRuns: db.prepare('SELECT * FROM test_runs ORDER BY created_at DESC').all() as Array<Record<string, unknown>>,
    testResults: db.prepare('SELECT * FROM test_results ORDER BY created_at DESC').all() as Array<Record<string, unknown>>,
  };

  return NextResponse.json(payload, {
    headers: {
      'Cache-Control': 'no-store',
      'Content-Disposition': `attachment; filename="upg-backup-${payload.exportedAt.replace(/[:.]/g, '-')}.json"`,
    },
  });
}

export async function POST(req: NextRequest) {
  const db = getDb();
  const body = await req.json() as {
    replaceExisting?: boolean;
    data?: BackupPayload;
  };

  const data = body.data;
  if (!data || typeof data !== 'object') {
    return NextResponse.json({ error: 'backup payload required' }, { status: 400 });
  }

  const promptSets = normalizeArray(data.promptSets);
  const testRuns = normalizeArray(data.testRuns);
  const testResults = normalizeArray(data.testResults);

  const importAll = db.transaction(() => {
    if (body.replaceExisting) {
      db.prepare('DELETE FROM test_results').run();
      db.prepare('DELETE FROM test_runs').run();
      db.prepare('DELETE FROM prompt_sets').run();
    }

    const upsertPrompt = db.prepare(`
      INSERT OR REPLACE INTO prompt_sets (
        id, name, system_prompt, user_prompt, response_format, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const upsertRun = db.prepare(`
      INSERT OR REPLACE INTO test_runs (
        id, batch_id, batch_label, prompt_set_id, prompt_label, prompt_source, prompt_order,
        system_prompt, user_prompt, response_format, created_at, memo
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const upsertResult = db.prepare(`
      INSERT OR REPLACE INTO test_results (
        id, run_id, provider, model, parameters, request_method, request_url, request_headers, request_body, request_code,
        response, input_tokens, output_tokens, cost_usd, latency_ms, status, error, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const prompt of promptSets) {
      upsertPrompt.run(
        prompt.id,
        prompt.name ?? 'Untitled',
        prompt.system_prompt ?? '',
        prompt.user_prompt ?? '',
        prompt.response_format ?? null,
        prompt.created_at ?? new Date().toISOString(),
        prompt.updated_at ?? new Date().toISOString(),
      );
    }

    for (const run of testRuns) {
      upsertRun.run(
        run.id,
        run.batch_id ?? null,
        run.batch_label ?? null,
        run.prompt_set_id ?? null,
        run.prompt_label ?? null,
        run.prompt_source ?? null,
        run.prompt_order ?? 0,
        run.system_prompt ?? '',
        run.user_prompt ?? '',
        run.response_format ?? null,
        run.created_at ?? new Date().toISOString(),
        run.memo ?? null,
      );
    }

    for (const result of testResults) {
      upsertResult.run(
        result.id,
        result.run_id,
        result.provider,
        result.model,
        result.parameters ?? '{}',
        result.request_method ?? null,
        result.request_url ?? null,
        result.request_headers ?? null,
        result.request_body ?? null,
        result.request_code ?? null,
        result.response ?? '',
        result.input_tokens ?? 0,
        result.output_tokens ?? 0,
        result.cost_usd ?? 0,
        result.latency_ms ?? 0,
        result.status ?? 'success',
        result.error ?? null,
        result.created_at ?? new Date().toISOString(),
      );
    }
  });

  importAll();

  return NextResponse.json({
    ok: true,
    imported: {
      promptSets: promptSets.length,
      testRuns: testRuns.length,
      testResults: testResults.length,
    },
  });
}
