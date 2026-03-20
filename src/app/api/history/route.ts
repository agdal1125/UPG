import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { generateId } from '@/lib/utils';

function resolveBatchId(row: Record<string, unknown>) {
  const batchId = row.batch_id;
  if (typeof batchId === 'string' && batchId.trim()) {
    return batchId;
  }

  return String(row.id ?? '');
}

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
    batchId: resolveBatchId(row),
    batchLabel: row.batch_label ? String(row.batch_label) : undefined,
    promptSetId: row.prompt_set_id ? String(row.prompt_set_id) : undefined,
    promptLabel: row.prompt_label ? String(row.prompt_label) : undefined,
    promptSource: row.prompt_source ? String(row.prompt_source) : undefined,
    promptOrder: Number(row.prompt_order ?? 0),
    systemPrompt: String(row.system_prompt ?? ''),
    userPrompt: String(row.user_prompt ?? ''),
    responseFormat: row.response_format ? String(row.response_format) : undefined,
    createdAt: String(row.created_at ?? ''),
    memo: row.memo ? String(row.memo) : undefined,
  };
}

function mapBatchSummaryRow(row: Record<string, unknown>) {
  return {
    id: String(row.batch_id ?? ''),
    batchId: String(row.batch_id ?? ''),
    batchLabel: row.batch_label ? String(row.batch_label) : 'Untitled Batch',
    createdAt: String(row.created_at ?? ''),
    memo: row.memo ? String(row.memo) : undefined,
    promptCount: Number(row.prompt_count ?? 0),
    resultCount: Number(row.result_count ?? 0),
    modelCount: Number(row.model_count ?? 0),
    avgLatencyMs: Number(row.avg_latency_ms ?? 0),
    totalCostUsd: Number(row.total_cost_usd ?? 0),
  };
}

function getBatchRuns(db: ReturnType<typeof getDb>, batchId: string) {
  return db.prepare(`
    SELECT *
    FROM test_runs
    WHERE COALESCE(NULLIF(batch_id, ''), id) = ?
    ORDER BY prompt_order ASC, created_at ASC
  `).all(batchId) as Array<Record<string, unknown>>;
}

function getBatchResults(db: ReturnType<typeof getDb>, batchId: string) {
  return db.prepare(`
    SELECT tres.*
    FROM test_results tres
    JOIN test_runs tr ON tr.id = tres.run_id
    WHERE COALESCE(NULLIF(tr.batch_id, ''), tr.id) = ?
    ORDER BY tr.prompt_order ASC, tres.created_at ASC
  `).all(batchId) as Array<Record<string, unknown>>;
}

export async function GET(req: NextRequest) {
  const db = getDb();
  const { searchParams } = new URL(req.url);
  const batchId = searchParams.get('batchId');
  const runId = searchParams.get('runId');

  if (batchId || runId) {
    const targetBatchId = batchId || runId || '';
    const runs = getBatchRuns(db, targetBatchId);
    if (runs.length === 0) {
      return NextResponse.json({ error: 'batch not found' }, { status: 404 });
    }

    const results = getBatchResults(db, targetBatchId);
    const resultsByRunId = new Map<string, Array<ReturnType<typeof mapResultRow>>>();

    for (const row of results) {
      const mapped = mapResultRow(row);
      const bucket = resultsByRunId.get(mapped.runId) || [];
      bucket.push(mapped);
      resultsByRunId.set(mapped.runId, bucket);
    }

    const mappedRuns = runs.map((run) => ({
      ...mapRunRow(run),
      results: resultsByRunId.get(String(run.id ?? '')) || [],
    }));

    const summary = db.prepare(`
      SELECT
        COALESCE(NULLIF(tr.batch_id, ''), tr.id) AS batch_id,
        COALESCE(
          NULLIF(MAX(tr.batch_label), ''),
          NULLIF(MAX(tr.prompt_label), ''),
          NULLIF(MAX(tr.memo), ''),
          'Untitled Batch'
        ) AS batch_label,
        MAX(tr.created_at) AS created_at,
        MAX(tr.memo) AS memo,
        COUNT(DISTINCT tr.id) AS prompt_count,
        COUNT(tres.id) AS result_count,
        COUNT(DISTINCT tres.model) AS model_count,
        ROUND(AVG(tres.latency_ms)) AS avg_latency_ms,
        ROUND(SUM(tres.cost_usd), 6) AS total_cost_usd
      FROM test_runs tr
      LEFT JOIN test_results tres ON tres.run_id = tr.id
      WHERE COALESCE(NULLIF(tr.batch_id, ''), tr.id) = ?
      GROUP BY COALESCE(NULLIF(tr.batch_id, ''), tr.id)
    `).get(targetBatchId) as Record<string, unknown>;

    return NextResponse.json({
      ...mapBatchSummaryRow(summary),
      prompts: mappedRuns,
    });
  }

  const limit = parseInt(searchParams.get('limit') || '50', 10);
  const offset = parseInt(searchParams.get('offset') || '0', 10);

  const batches = db.prepare(`
    SELECT
      COALESCE(NULLIF(tr.batch_id, ''), tr.id) AS batch_id,
      COALESCE(
        NULLIF(MAX(tr.batch_label), ''),
        NULLIF(MAX(tr.prompt_label), ''),
        NULLIF(MAX(tr.memo), ''),
        'Untitled Batch'
      ) AS batch_label,
      MAX(tr.created_at) AS created_at,
      MAX(tr.memo) AS memo,
      COUNT(DISTINCT tr.id) AS prompt_count,
      COUNT(tres.id) AS result_count,
      COUNT(DISTINCT tres.model) AS model_count,
      ROUND(AVG(tres.latency_ms)) AS avg_latency_ms,
      ROUND(SUM(tres.cost_usd), 6) AS total_cost_usd
    FROM test_runs tr
    LEFT JOIN test_results tres ON tres.run_id = tr.id
    GROUP BY COALESCE(NULLIF(tr.batch_id, ''), tr.id)
    ORDER BY MAX(tr.created_at) DESC
    LIMIT ? OFFSET ?
  `).all(limit, offset) as Array<Record<string, unknown>>;

  const total = db.prepare(`
    SELECT COUNT(*) AS count
    FROM (
      SELECT COALESCE(NULLIF(batch_id, ''), id)
      FROM test_runs
      GROUP BY COALESCE(NULLIF(batch_id, ''), id)
    )
  `).get() as { count: number };

  const mappedBatches = batches.map(mapBatchSummaryRow);
  return NextResponse.json({
    batches: mappedBatches,
    runs: mappedBatches,
    total: total.count,
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const db = getDb();
  const runId = generateId();

  db.prepare(`
    INSERT INTO test_runs (
      id, batch_id, batch_label, prompt_set_id, prompt_label, prompt_source, prompt_order,
      system_prompt, user_prompt, response_format, memo
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    runId,
    body.batchId || null,
    body.batchLabel || null,
    body.promptSetId || null,
    body.promptLabel || null,
    body.promptSource || null,
    body.promptOrder || 0,
    body.systemPrompt,
    body.userPrompt,
    body.responseFormat || null,
    body.memo || null,
  );

  const insertResult = db.prepare(`
    INSERT INTO test_results (
      id, run_id, provider, model, parameters, response,
      input_tokens, output_tokens, cost_usd, latency_ms, status, error
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  if (body.results && Array.isArray(body.results)) {
    const insertMany = db.transaction((results: Array<Record<string, unknown>>) => {
      for (const result of results) {
        insertResult.run(
          generateId(),
          runId,
          result.provider,
          result.model,
          JSON.stringify(result.parameters || {}),
          result.response || '',
          result.inputTokens || 0,
          result.outputTokens || 0,
          result.costUsd || 0,
          result.latencyMs || 0,
          result.status || 'success',
          result.error || null,
        );
      }
    });

    insertMany(body.results);
  }

  return NextResponse.json({ id: runId, batchId: body.batchId || runId }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const batchId = searchParams.get('batchId');
  const runId = searchParams.get('runId');
  const targetBatchId = batchId || runId;

  if (!targetBatchId) {
    return NextResponse.json({ error: 'batchId or runId required' }, { status: 400 });
  }

  const db = getDb();
  db.prepare(`
    DELETE FROM test_runs
    WHERE COALESCE(NULLIF(batch_id, ''), id) = ?
  `).run(targetBatchId);

  return NextResponse.json({ ok: true });
}
