import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { generateId } from '@/lib/utils';

function mapResultRow(row: Record<string, unknown>) {
  return {
    id: String(row.id ?? ''),
    runId: String(row.run_id ?? ''),
    provider: row.provider,
    model: String(row.model ?? ''),
    parameters: String(row.parameters ?? '{}'),
    response: String(row.response ?? ''),
    inputTokens: Number(row.input_tokens ?? 0),
    outputTokens: Number(row.output_tokens ?? 0),
    costUsd: Number(row.cost_usd ?? 0),
    latencyMs: Number(row.latency_ms ?? 0),
    status: row.status,
    error: row.error ? String(row.error) : undefined,
    createdAt: String(row.created_at ?? ''),
  };
}

function mapRunRow(row: Record<string, unknown>) {
  return {
    id: String(row.id ?? ''),
    promptSetId: row.prompt_set_id ? String(row.prompt_set_id) : undefined,
    systemPrompt: String(row.system_prompt ?? ''),
    userPrompt: String(row.user_prompt ?? ''),
    responseFormat: row.response_format ? String(row.response_format) : undefined,
    createdAt: String(row.created_at ?? ''),
    memo: row.memo ? String(row.memo) : undefined,
  };
}

function mapRunSummaryRow(row: Record<string, unknown>) {
  return {
    ...mapRunRow(row),
    resultCount: Number(row.result_count ?? 0),
    avgLatencyMs: Number(row.avg_latency_ms ?? 0),
    totalCostUsd: Number(row.total_cost_usd ?? 0),
  };
}

export async function GET(req: NextRequest) {
  const db = getDb();
  const { searchParams } = new URL(req.url);
  const runId = searchParams.get('runId');

  if (runId) {
    const run = db.prepare('SELECT * FROM test_runs WHERE id = ?').get(runId) as Record<string, unknown> | undefined;
    const results = db.prepare('SELECT * FROM test_results WHERE run_id = ? ORDER BY created_at').all(runId) as Array<Record<string, unknown>>;

    if (!run) {
      return NextResponse.json({ error: 'run not found' }, { status: 404 });
    }

    return NextResponse.json({
      ...mapRunRow(run),
      results: results.map(mapResultRow),
    });
  }

  const limit = parseInt(searchParams.get('limit') || '50');
  const offset = parseInt(searchParams.get('offset') || '0');

  const runs = db.prepare(`
    SELECT tr.*,
      COUNT(tres.id) as result_count,
      ROUND(AVG(tres.latency_ms)) as avg_latency_ms,
      ROUND(SUM(tres.cost_usd), 6) as total_cost_usd
    FROM test_runs tr
    LEFT JOIN test_results tres ON tres.run_id = tr.id
    GROUP BY tr.id
    ORDER BY tr.created_at DESC
    LIMIT ? OFFSET ?
  `).all(limit, offset) as Array<Record<string, unknown>>;

  const total = db.prepare('SELECT COUNT(*) as count FROM test_runs').get() as { count: number };

  return NextResponse.json({ runs: runs.map(mapRunSummaryRow), total: total.count });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const db = getDb();
  const runId = generateId();

  db.prepare(`
    INSERT INTO test_runs (id, prompt_set_id, system_prompt, user_prompt, response_format, memo)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(runId, body.promptSetId || null, body.systemPrompt, body.userPrompt, body.responseFormat || null, body.memo || null);

  // Insert individual results
  const insertResult = db.prepare(`
    INSERT INTO test_results (id, run_id, provider, model, parameters, response, input_tokens, output_tokens, cost_usd, latency_ms, status, error)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  if (body.results && Array.isArray(body.results)) {
    const insertMany = db.transaction((results: Array<Record<string, unknown>>) => {
      for (const r of results) {
        insertResult.run(
          generateId(), runId,
          r.provider, r.model, JSON.stringify(r.parameters || {}),
          r.response || '', r.inputTokens || 0, r.outputTokens || 0,
          r.costUsd || 0, r.latencyMs || 0,
          r.status || 'success', r.error || null
        );
      }
    });
    insertMany(body.results);
  }

  return NextResponse.json({ id: runId }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const runId = searchParams.get('runId');
  if (!runId) return NextResponse.json({ error: 'runId required' }, { status: 400 });

  const db = getDb();
  db.prepare('DELETE FROM test_results WHERE run_id = ?').run(runId);
  db.prepare('DELETE FROM test_runs WHERE id = ?').run(runId);
  return NextResponse.json({ ok: true });
}
