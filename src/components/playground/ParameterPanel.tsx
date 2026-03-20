'use client';

import { useEffect, useState } from 'react';
import { usePlaygroundStore } from '@/store/playground';
import { PARAM_DEFS, getModelInfo, PROVIDER_COLORS } from '@/lib/pricing';
import { JSONValue, LLMParameters, ParamDef } from '@/types';

function ParamControl({ def, value, onChange }: {
  def: ParamDef;
  value: number | string | boolean;
  onChange: (v: number | string | boolean) => void;
}) {
  if (def.type === 'range') {
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 2 }}>
          <span style={{ color: 'var(--text-secondary)' }}>{def.label}</span>
          <span style={{ fontWeight: 600 }}>{value}</span>
        </div>
        <input
          type="range"
          min={def.min}
          max={def.max}
          step={def.step}
          value={Number(value)}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          style={{ width: '100%', padding: 0, border: 'none', background: 'transparent' }}
        />
      </div>
    );
  }

  if (def.type === 'number') {
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 2 }}>
          <span style={{ color: 'var(--text-secondary)' }}>{def.label}</span>
        </div>
        <input
          type="number"
          min={def.min}
          max={def.max}
          step={def.step}
          value={Number(value)}
          onChange={(e) => onChange(parseInt(e.target.value, 10) || def.default as number)}
          style={{ width: '100%', fontSize: 12 }}
        />
      </div>
    );
  }

  if (def.type === 'select') {
    return (
      <div>
        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 2 }}>{def.label}</div>
        <select
          value={String(value)}
          onChange={(e) => onChange(e.target.value)}
          style={{ width: '100%', fontSize: 12 }}
        >
          {def.options?.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </div>
    );
  }

  if (def.type === 'checkbox') {
    return (
      <label style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        minHeight: 36,
        fontSize: 12,
        color: 'var(--text-secondary)',
      }}>
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span>{def.label}</span>
      </label>
    );
  }

  return null;
}

function getBaseParams(parameters: LLMParameters, supportedKeys: string[]): LLMParameters {
  const baseParams: LLMParameters = {};

  for (const key of supportedKeys) {
    if (parameters[key] !== undefined) {
      baseParams[key] = parameters[key];
    }
  }

  return baseParams;
}

function getExtraParams(parameters: LLMParameters, supportedKeys: string[]): Record<string, JSONValue> {
  const supported = new Set(supportedKeys);
  const extraParams: Record<string, JSONValue> = {};

  for (const [key, value] of Object.entries(parameters)) {
    if (supported.has(key) || value === undefined) continue;
    extraParams[key] = value;
  }

  return extraParams;
}

function formatExtraParams(parameters: LLMParameters, supportedKeys: string[]): string {
  const extraParams = getExtraParams(parameters, supportedKeys);
  return Object.keys(extraParams).length > 0 ? JSON.stringify(extraParams, null, 2) : '';
}

function AdditionalParamsEditor({
  parameters,
  supportedKeys,
  onChange,
}: {
  parameters: LLMParameters;
  supportedKeys: string[];
  onChange: (extraParams: Record<string, JSONValue>) => void;
}) {
  const serializedExtras = formatExtraParams(parameters, supportedKeys);
  const [draft, setDraft] = useState(serializedExtras);
  const [error, setError] = useState('');

  useEffect(() => {
    setDraft((currentDraft) => {
      try {
        const normalizedDraft = currentDraft.trim()
          ? JSON.stringify(JSON.parse(currentDraft), null, 2)
          : '';
        return normalizedDraft === serializedExtras ? currentDraft : serializedExtras;
      } catch {
        return currentDraft;
      }
    });
  }, [serializedExtras]);

  const handleChange = (nextDraft: string) => {
    setDraft(nextDraft);

    if (!nextDraft.trim()) {
      setError('');
      onChange({});
      return;
    }

    try {
      const parsed = JSON.parse(nextDraft) as JSONValue;
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('Enter a JSON object.');
      }

      const nextExtraParams = parsed as Record<string, JSONValue>;
      const duplicateKeys = Object.keys(nextExtraParams).filter((key) => supportedKeys.includes(key));
      if (duplicateKeys.length > 0) {
        throw new Error(`These keys already have dedicated controls: ${duplicateKeys.join(', ')}`);
      }

      setError('');
      onChange(nextExtraParams);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Failed to parse JSON.');
    }
  };

  return (
    <div style={{ gridColumn: '1 / -1' }}>
      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>
        Additional Parameters (JSON)
      </div>
      <textarea
        value={draft}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={'{\n  "seed": 7,\n  "stop": ["END"],\n  "max_tokens": 8192\n}'}
        rows={5}
        style={{ width: '100%', fontFamily: 'monospace', fontSize: 12, resize: 'vertical' }}
      />
      <div style={{ fontSize: 11, color: error ? 'var(--accent-red)' : 'var(--text-secondary)', marginTop: 4 }}>
        {error || 'Use this for provider-specific JSON parameters that do not have dedicated controls.'}
      </div>
    </div>
  );
}

export default function ParameterPanel() {
  const {
    selectedModels,
    updateModelParams,
    replaceModelParams,
    responseFormat,
    setResponseFormat,
  } = usePlaygroundStore();

  if (selectedModels.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
          Parameters
        </label>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', padding: '8px 0' }}>
          Select models above to configure parameters.
        </div>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>
            Response Format (JSON Schema, optional)
          </label>
          <textarea
            value={responseFormat}
            onChange={(e) => setResponseFormat(e.target.value)}
            placeholder='{"type": "object", "properties": {...}}'
            rows={3}
            style={{ width: '100%', fontFamily: 'monospace', fontSize: 12, resize: 'vertical' }}
          />
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
        Parameters (Per Model)
      </label>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 500, overflowY: 'auto' }}>
        {selectedModels.map((selection, idx) => {
          const modelInfo = getModelInfo(selection.model);
          if (!modelInfo) return null;

          const paramKeys = modelInfo.supportedParams;
          const providerColor = PROVIDER_COLORS[selection.provider];

          return (
            <div key={`${selection.model}-${idx}`} style={{
              padding: 10,
              borderRadius: 8,
              background: 'var(--bg-primary)',
              border: '1px solid var(--border-color)',
              borderLeft: `3px solid ${providerColor}`,
            }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: providerColor, marginBottom: 8 }}>
                {modelInfo.name}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {paramKeys.map((key) => {
                  const def = PARAM_DEFS[key];
                  if (!def) return null;

                  const currentVal = selection.parameters[key] ?? def.default;
                  return (
                    <ParamControl
                      key={key}
                      def={def}
                      value={currentVal as number | string | boolean}
                      onChange={(value) => updateModelParams(idx, { [key]: value })}
                    />
                  );
                })}

                <AdditionalParamsEditor
                  parameters={selection.parameters}
                  supportedKeys={paramKeys}
                  onChange={(extraParams) => {
                    replaceModelParams(idx, {
                      ...getBaseParams(selection.parameters, paramKeys),
                      ...extraParams,
                    });
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div>
        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>
          Response Format (JSON Schema, optional)
        </label>
        <textarea
          value={responseFormat}
          onChange={(e) => setResponseFormat(e.target.value)}
          placeholder='{"type": "object", "properties": {...}}'
          rows={3}
          style={{ width: '100%', fontFamily: 'monospace', fontSize: 12, resize: 'vertical' }}
        />
      </div>
    </div>
  );
}
