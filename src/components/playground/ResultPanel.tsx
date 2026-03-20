'use client';

import { ResultEntry } from '@/store/playground';
import { PROVIDER_COLORS, PROVIDER_LABELS, getModelInfo } from '@/lib/pricing';
import { formatCost, formatLatency, formatTokens } from '@/lib/utils';
import { useState, useRef } from 'react';

interface Props {
  result: ResultEntry;
}

export default function ResultPanel({ result }: Props) {
  const [tab, setTab] = useState<'raw' | 'formatted' | 'html'>('formatted');
  const modelInfo = getModelInfo(result.model);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const statusColors: Record<string, string> = {
    pending: 'var(--text-secondary)',
    streaming: 'var(--accent-amber)',
    success: 'var(--accent-green)',
    error: 'var(--accent-red)',
  };

  const renderContent = () => {
    if (result.status === 'error') {
      return <div style={{ color: 'var(--accent-red)', fontSize: 13 }}>{result.error}</div>;
    }
    if (result.status === 'pending') {
      return <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Waiting...</div>;
    }

    switch (tab) {
      case 'raw':
        return <div className="code-block">{result.content}</div>;
      case 'formatted':
        // Try to parse as JSON and pretty print
        try {
          const parsed = JSON.parse(result.content);
          return <div className="code-block">{JSON.stringify(parsed, null, 2)}</div>;
        } catch {
          return (
            <div style={{ fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {result.content}
            </div>
          );
        }
      case 'html':
        return (
          <iframe
            ref={iframeRef}
            srcDoc={result.content}
            style={{
              width: '100%', minHeight: 300, border: '1px solid var(--border-color)',
              borderRadius: 8, background: 'white',
            }}
            sandbox="allow-scripts"
          />
        );
    }
  };

  return (
    <div className={`card provider-${result.provider}`} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <span style={{
            fontSize: 14, fontWeight: 600,
            color: PROVIDER_COLORS[result.provider],
          }}>
            {modelInfo?.name || result.model}
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-secondary)', marginLeft: 8 }}>
            {PROVIDER_LABELS[result.provider]}
          </span>
        </div>
        <span className={`badge ${result.status === 'streaming' ? 'streaming-indicator' : ''}`} style={{
          background: `${statusColors[result.status]}20`,
          color: statusColors[result.status],
        }}>
          {result.status}
        </span>
      </div>

      {/* Metrics */}
      {(result.status === 'success' || result.status === 'streaming') && (
        <div style={{ display: 'flex', gap: 16, fontSize: 11, color: 'var(--text-secondary)' }}>
          <span>In: {formatTokens(result.inputTokens)}</span>
          <span>Out: {formatTokens(result.outputTokens)}</span>
          <span style={{ color: 'var(--accent-amber)' }}>Cost: {formatCost(result.costUsd)}</span>
          <span style={{ color: 'var(--accent-green)' }}>Time: {formatLatency(result.latencyMs)}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="tabs">
        {(['formatted', 'raw', 'html'] as const).map(t => (
          <div
            key={t}
            className={`tab ${tab === t ? 'active' : ''}`}
            onClick={() => setTab(t)}
          >
            {t === 'formatted' ? 'Formatted' : t === 'raw' ? 'Raw' : 'HTML'}
          </div>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', maxHeight: 400 }}>
        {renderContent()}
      </div>
    </div>
  );
}
