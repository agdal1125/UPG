'use client';

import { useState, useEffect } from 'react';
import { TestRun, TestResult } from '@/types';
import { PROVIDER_COLORS, PROVIDER_LABELS, getModelInfo } from '@/lib/pricing';
import { formatCost, formatLatency, formatTokens } from '@/lib/utils';

interface RunSummary extends TestRun {
  resultCount: number;
  avgLatencyMs: number;
  totalCostUsd: number;
}

interface RunDetail extends TestRun {
  results: TestResult[];
}

export default function HistoryPage() {
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [selectedRun, setSelectedRun] = useState<RunDetail | null>(null);
  const [page, setPage] = useState(0);
  const LIMIT = 20;

  const loadRuns = () => {
    fetch(`/api/history?limit=${LIMIT}&offset=${page * LIMIT}`)
      .then(r => r.json())
      .then(data => {
        setRuns(data.runs || []);
        setTotal(data.total || 0);
      })
      .catch(() => {});
  };

  useEffect(() => { loadRuns(); }, [page]);

  const loadDetail = async (runId: string) => {
    const res = await fetch(`/api/history?runId=${runId}`);
    if (!res.ok) return;
    const data = await res.json();
    setSelectedRun(data);
  };

  const deleteRun = async (runId: string) => {
    await fetch(`/api/history?runId=${runId}`, { method: 'DELETE' });
    if (selectedRun?.id === runId) setSelectedRun(null);
    loadRuns();
  };

  const exportCsv = () => {
    if (!selectedRun?.results) return;
    const headers = ['Provider', 'Model', 'Status', 'Input Tokens', 'Output Tokens', 'Cost USD', 'Latency ms', 'Response'];
    const rows = selectedRun.results.map(r => [
      r.provider, r.model, r.status,
      r.inputTokens, r.outputTokens,
      r.costUsd, r.latencyMs,
      `"${(r.response || '').replace(/"/g, '""')}"`,
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `test-run-${selectedRun.id.slice(0, 8)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Aggregate stats for dashboard
  const totalCost = runs.reduce((s, r) => s + (r.totalCostUsd || 0), 0);
  const totalRuns = total;

  return (
    <div style={{ maxWidth: 1400 }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20 }}>Test History</h2>

      {/* Stats bar */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
        <div className="card" style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: 24, fontWeight: 700 }}>{totalRuns}</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Total Runs</div>
        </div>
        <div className="card" style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--accent-amber)' }}>{formatCost(totalCost)}</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Total Cost (page)</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selectedRun ? '1fr 1fr' : '1fr', gap: 16 }}>
        {/* Runs list */}
        <div>
          {runs.length === 0 ? (
            <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: 40 }}>
              No test runs yet.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {runs.map(run => (
                <div
                  key={run.id}
                  className="card"
                  style={{
                    cursor: 'pointer',
                    border: selectedRun?.id === run.id ? '1px solid var(--accent-blue)' : undefined,
                  }}
                  onClick={() => loadDetail(run.id)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>
                        {run.userPrompt?.slice(0, 60)}...
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                        {new Date(run.createdAt).toLocaleString()} | {run.resultCount} models
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 12, color: 'var(--accent-amber)' }}>
                        {formatCost(run.totalCostUsd || 0)}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                        ~{formatLatency(run.avgLatencyMs || 0)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {/* Pagination */}
              {total > LIMIT && (
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 12 }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>
                    Prev
                  </button>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)', alignSelf: 'center' }}>
                    Page {page + 1} of {Math.ceil(total / LIMIT)}
                  </span>
                  <button className="btn btn-secondary btn-sm" onClick={() => setPage(p => p + 1)} disabled={(page + 1) * LIMIT >= total}>
                    Next
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Detail panel */}
        {selectedRun && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ margin: 0, fontSize: 16 }}>Run Detail</h3>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-secondary btn-sm" onClick={exportCsv}>Export CSV</button>
                <button className="btn btn-danger btn-sm" onClick={() => deleteRun(selectedRun.id)}>Delete</button>
                <button className="btn btn-secondary btn-sm" onClick={() => setSelectedRun(null)}>Close</button>
              </div>
            </div>

            {/* Prompts used */}
            <div className="card" style={{ marginBottom: 12, fontSize: 12 }}>
              <div style={{ marginBottom: 8 }}>
                <span style={{ fontWeight: 600, color: 'var(--accent-blue)' }}>System:</span>
                <div className="code-block" style={{ marginTop: 4, maxHeight: 100, overflow: 'auto', fontSize: 11 }}>
                  {selectedRun.systemPrompt || '(none)'}
                </div>
              </div>
              <div>
                <span style={{ fontWeight: 600, color: 'var(--accent-green)' }}>User:</span>
                <div className="code-block" style={{ marginTop: 4, maxHeight: 100, overflow: 'auto', fontSize: 11 }}>
                  {selectedRun.userPrompt}
                </div>
              </div>
            </div>

            {/* Results */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {selectedRun.results?.map(result => {
                const model = getModelInfo(result.model);
                return (
                  <div key={result.id} className={`card provider-${result.provider}`}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontWeight: 600, color: PROVIDER_COLORS[result.provider], fontSize: 13 }}>
                        {model?.name || result.model}
                      </span>
                      <span className="badge" style={{
                        background: result.status === 'success' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                        color: result.status === 'success' ? 'var(--accent-green)' : 'var(--accent-red)',
                      }}>
                        {result.status}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 16, fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6 }}>
                      <span>In: {formatTokens(result.inputTokens)}</span>
                      <span>Out: {formatTokens(result.outputTokens)}</span>
                      <span style={{ color: 'var(--accent-amber)' }}>{formatCost(result.costUsd)}</span>
                      <span style={{ color: 'var(--accent-green)' }}>{formatLatency(result.latencyMs)}</span>
                    </div>
                    <div className="code-block" style={{ maxHeight: 200, overflow: 'auto', fontSize: 11 }}>
                      {result.response || result.error || '(empty)'}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
