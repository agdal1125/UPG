'use client';

import { useEffect, useRef, useState } from 'react';
import ResultPanel from '@/components/playground/ResultPanel';
import { ensureAuthorizedResponse } from '@/lib/auth-client';
import { formatCost, formatLatency } from '@/lib/utils';
import { ResultEntry } from '@/store/playground';
import { TestResult, TestRun } from '@/types';

interface BatchSummary {
  id: string;
  batchId: string;
  batchLabel: string;
  createdAt: string;
  memo?: string;
  promptCount: number;
  resultCount: number;
  modelCount: number;
  avgLatencyMs: number;
  totalCostUsd: number;
}

interface BatchPrompt extends TestRun {
  results: TestResult[];
}

interface BatchDetail extends BatchSummary {
  prompts: BatchPrompt[];
}

function toResultEntry(prompt: BatchPrompt, result: TestResult): ResultEntry {
  let parsedParameters: ResultEntry['parameters'] = {};

  try {
    parsedParameters = JSON.parse(result.parameters || '{}') as ResultEntry['parameters'];
  } catch {
    parsedParameters = {};
  }

  return {
    id: result.id,
    promptKey: prompt.batchId || prompt.id,
    promptLabel: prompt.promptLabel || prompt.userPrompt.slice(0, 40) || 'Prompt',
    promptSetId: prompt.promptSetId,
    promptSource: prompt.promptSource === 'saved' ? 'saved' : 'draft',
    provider: result.provider,
    model: result.model,
    parameters: parsedParameters,
    requestMethod: result.requestMethod,
    requestUrl: result.requestUrl,
    requestHeaders: result.requestHeaders,
    requestBody: result.requestBody,
    requestCode: result.requestCode,
    content: result.response,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
    costUsd: result.costUsd,
    latencyMs: result.latencyMs,
    status: result.status,
    error: result.error,
  };
}

export default function HistoryPage() {
  const [batches, setBatches] = useState<BatchSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [selectedBatch, setSelectedBatch] = useState<BatchDetail | null>(null);
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const LIMIT = 20;

  const loadBatches = async (preserveSelected = true) => {
    const response = await fetch(`/api/history?limit=${LIMIT}&offset=${page * LIMIT}`);
    if (!response.ok) {
      return;
    }

    const data = await response.json();
    const nextBatches = (data.batches || []) as BatchSummary[];
    setBatches(nextBatches);
    setTotal(data.total || 0);

    if (!preserveSelected && nextBatches[0]) {
      setSelectedBatchId(nextBatches[0].batchId);
      return;
    }

    if (preserveSelected && selectedBatchId && nextBatches.some((batch) => batch.batchId === selectedBatchId)) {
      return;
    }

    if (nextBatches[0]) {
      setSelectedBatchId(nextBatches[0].batchId);
    } else {
      setSelectedBatchId(null);
      setSelectedBatch(null);
    }
  };

  useEffect(() => {
    loadBatches(false).catch(() => {});
  }, [page]);

  useEffect(() => {
    if (!selectedBatchId) {
      setSelectedBatch(null);
      return;
    }

    fetch(`/api/history?batchId=${encodeURIComponent(selectedBatchId)}`)
      .then((response) => response.ok ? response.json() : null)
      .then((data) => {
        if (data) {
          setSelectedBatch(data as BatchDetail);
        }
      })
      .catch(() => {});
  }, [selectedBatchId]);

  const deleteBatch = async (batchId: string) => {
    const response = await fetch(`/api/history?batchId=${encodeURIComponent(batchId)}`, { method: 'DELETE' });
    if (!(await ensureAuthorizedResponse(response, 'Deleting history requires authentication. Unlock protected actions now?'))) {
      return;
    }
    if (!response.ok) return;

    if (selectedBatchId === batchId) {
      setSelectedBatchId(null);
      setSelectedBatch(null);
    }

    await loadBatches(false);
  };

  const exportBatchCsv = () => {
    if (!selectedBatch?.prompts?.length) return;

    const headers = [
      'Prompt Label',
      'Provider',
      'Model',
      'Status',
      'Input Tokens',
      'Output Tokens',
      'Cost USD',
      'Latency ms',
      'Response',
    ];

    const rows = selectedBatch.prompts.flatMap((prompt) => (
      prompt.results.map((result) => [
        `"${(prompt.promptLabel || '').replace(/"/g, '""')}"`,
        result.provider,
        result.model,
        result.status,
        result.inputTokens,
        result.outputTokens,
        result.costUsd,
        result.latencyMs,
        `"${(result.response || '').replace(/"/g, '""')}"`,
      ])
    ));

    const csv = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `history-batch-${selectedBatch.batchId.slice(0, 8)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportBackup = async () => {
    const response = await fetch('/api/backup');
    if (!(await ensureAuthorizedResponse(response, 'Exporting backups requires authentication. Unlock protected actions now?'))) {
      return;
    }
    if (!response.ok) return;

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `upg-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const importBackup = async (file: File) => {
    const text = await file.text();
    const data = JSON.parse(text);
    const replaceExisting = window.confirm(
      'Click OK to replace existing prompts/history with this backup. Click Cancel to merge it.'
    );

    const response = await fetch('/api/backup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        replaceExisting,
        data,
      }),
    });

    if (!(await ensureAuthorizedResponse(response, 'Importing backups requires authentication. Unlock protected actions now?'))) {
      return;
    }

    if (!response.ok) {
      const errorPayload = await response.json().catch(() => null);
      window.alert(errorPayload?.error || 'Failed to import backup.');
      return;
    }

    await loadBatches(false);
  };

  const totalCost = batches.reduce((sum, batch) => sum + (batch.totalCostUsd || 0), 0);
  const totalBatches = total;

  return (
    <div style={{ maxWidth: 1600, display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>History</h2>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
            Review past NxN batches and back them up as JSON on the free tier.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-secondary btn-sm" onClick={exportBackup}>Export Backup JSON</button>
          <button className="btn btn-secondary btn-sm" onClick={() => fileInputRef.current?.click()}>Import Backup JSON</button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            style={{ display: 'none' }}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                importBackup(file).catch(() => {});
              }
              event.currentTarget.value = '';
            }}
          />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 16 }}>
        <div className="card" style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: 24, fontWeight: 700 }}>{totalBatches}</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Total Batches</div>
        </div>
        <div className="card" style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--accent-amber)' }}>{formatCost(totalCost)}</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Total Cost (page)</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 20, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {batches.length === 0 ? (
            <div className="card" style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: 40 }}>
              No saved history yet.
            </div>
          ) : (
            <>
              {batches.map((batch) => {
                const isActive = selectedBatchId === batch.batchId;
                return (
                  <button
                    key={batch.batchId}
                    className="card"
                    onClick={() => setSelectedBatchId(batch.batchId)}
                    style={{
                      textAlign: 'left',
                      cursor: 'pointer',
                      border: isActive ? '1px solid var(--accent-blue)' : '1px solid var(--border-color)',
                      background: isActive ? 'rgba(59, 130, 246, 0.08)' : undefined,
                    }}
                  >
                    <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>{batch.batchLabel}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 8 }}>
                      {new Date(batch.createdAt).toLocaleString()}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, fontSize: 11, color: 'var(--text-secondary)' }}>
                      <span>{batch.promptCount} prompts</span>
                      <span>{batch.modelCount} models</span>
                      <span>{batch.resultCount} results</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, fontSize: 11 }}>
                      <span style={{ color: 'var(--accent-amber)' }}>{formatCost(batch.totalCostUsd)}</span>
                      <span style={{ color: 'var(--accent-green)' }}>{formatLatency(batch.avgLatencyMs)}</span>
                    </div>
                  </button>
                );
              })}

              {total > LIMIT && (
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 8 }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => setPage((current) => Math.max(0, current - 1))} disabled={page === 0}>
                    Prev
                  </button>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)', alignSelf: 'center' }}>
                    Page {page + 1} of {Math.ceil(total / LIMIT)}
                  </span>
                  <button className="btn btn-secondary btn-sm" onClick={() => setPage((current) => current + 1)} disabled={(page + 1) * LIMIT >= total}>
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        <div>
          {!selectedBatch ? (
            <div className="card" style={{ minHeight: 240, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
              Select a batch to inspect its NxN results.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 18 }}>{selectedBatch.batchLabel}</h3>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6 }}>
                    {new Date(selectedBatch.createdAt).toLocaleString()} · {selectedBatch.promptCount} prompts · {selectedBatch.modelCount} models · {selectedBatch.resultCount} results
                  </div>
                  {selectedBatch.memo && (
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                      {selectedBatch.memo}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button className="btn btn-secondary btn-sm" onClick={exportBatchCsv}>Export CSV</button>
                  <button className="btn btn-danger btn-sm" onClick={() => deleteBatch(selectedBatch.batchId)}>Delete Batch</button>
                </div>
              </div>

              {selectedBatch.prompts.map((prompt) => (
                <section key={prompt.id} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.1 }}>
                      {prompt.promptLabel || prompt.userPrompt.slice(0, 60) || 'Prompt'}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                      {prompt.promptSource === 'saved' ? 'Saved prompt' : 'Draft prompt'} · {prompt.results.length} results
                    </div>
                  </div>

                  <div className="result-grid">
                    {prompt.results.map((result) => (
                      <ResultPanel
                        key={result.id}
                        result={toResultEntry(prompt, result)}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
