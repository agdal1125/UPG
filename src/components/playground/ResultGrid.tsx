'use client';

import { usePlaygroundStore } from '@/store/playground';
import ResultPanel from './ResultPanel';
import { formatCost, formatLatency } from '@/lib/utils';

export default function ResultGrid() {
  const { results } = usePlaygroundStore();

  if (results.length === 0) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 200,
        color: 'var(--text-secondary)',
        fontSize: 14,
      }}>
        Select prompts and models, then run to see results here.
      </div>
    );
  }

  const successResults = results.filter((result) => result.status === 'success');
  const totalCost = successResults.reduce((sum, result) => sum + result.costUsd, 0);
  const avgLatency = successResults.length > 0
    ? successResults.reduce((sum, result) => sum + result.latencyMs, 0) / successResults.length
    : 0;

  const groupedResults = results.reduce<Array<{ key: string; label: string; source: 'draft' | 'saved'; results: typeof results }>>(
    (groups, result) => {
      const existingGroup = groups.find((group) => group.key === result.promptKey);
      if (existingGroup) {
        existingGroup.results.push(result);
        return groups;
      }

      groups.push({
        key: result.promptKey,
        label: result.promptLabel,
        source: result.promptSource,
        results: [result],
      });
      return groups;
    },
    [],
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {successResults.length > 0 && (
        <div style={{
          display: 'flex',
          gap: 24,
          fontSize: 12,
          padding: '8px 12px',
          background: 'var(--bg-tertiary)',
          borderRadius: 8,
          flexWrap: 'wrap',
        }}>
          <span style={{ color: 'var(--text-secondary)' }}>
            Results: <strong style={{ color: 'var(--text-primary)' }}>{successResults.length}/{results.length}</strong>
          </span>
          <span style={{ color: 'var(--text-secondary)' }}>
            Total Cost: <strong style={{ color: 'var(--accent-amber)' }}>{formatCost(totalCost)}</strong>
          </span>
          <span style={{ color: 'var(--text-secondary)' }}>
            Avg Latency: <strong style={{ color: 'var(--accent-green)' }}>{formatLatency(avgLatency)}</strong>
          </span>
        </div>
      )}

      {groupedResults.map((group) => {
        const groupSuccessResults = group.results.filter((result) => result.status === 'success');
        const groupCost = groupSuccessResults.reduce((sum, result) => sum + result.costUsd, 0);

        return (
          <div key={group.key} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              flexWrap: 'wrap',
            }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{group.label}</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                  {group.source === 'draft' ? 'Current editor' : 'Saved prompt'} · {group.results.length} results
                </div>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                Cost: <span style={{ color: 'var(--accent-amber)' }}>{formatCost(groupCost)}</span>
              </div>
            </div>

            <div className="result-grid">
              {group.results.map((result) => (
                <ResultPanel key={result.id} result={result} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
