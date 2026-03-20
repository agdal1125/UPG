'use client';

import { usePlaygroundStore, ModelSelection } from '@/store/playground';
import { MODELS, PROVIDER_LABELS, PROVIDER_COLORS, getDefaultParams } from '@/lib/pricing';
import { Provider } from '@/types';

const PROVIDERS: Provider[] = ['openai', 'anthropic', 'gemini', 'perplexity', 'perplexity-agent'];

export default function ModelSelector() {
  const { selectedModels, addModel, removeModel } = usePlaygroundStore();

  const isSelected = (modelId: string) => selectedModels.some(m => m.model === modelId);

  const toggleModel = (modelId: string, provider: Provider) => {
    const idx = selectedModels.findIndex(m => m.model === modelId);
    if (idx >= 0) {
      removeModel(idx);
    } else {
      addModel({
        provider,
        model: modelId,
        parameters: getDefaultParams(modelId),
      });
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
          Models ({selectedModels.length} selected)
        </label>
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => usePlaygroundStore.getState().setSelectedModels([])}
          style={{ fontSize: 11 }}
        >
          Clear All
        </button>
      </div>

      {PROVIDERS.map(provider => {
        const models = MODELS.filter(m => m.provider === provider);
        return (
          <div key={provider}>
            <div style={{
              fontSize: 11, fontWeight: 700, color: PROVIDER_COLORS[provider],
              marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1,
            }}>
              {PROVIDER_LABELS[provider]}
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {models.map(model => (
                <button
                  key={model.id}
                  onClick={() => toggleModel(model.id, provider)}
                  style={{
                    padding: '5px 10px',
                    borderRadius: 6,
                    fontSize: 12,
                    cursor: 'pointer',
                    border: `1px solid ${isSelected(model.id) ? PROVIDER_COLORS[provider] : 'var(--border-color)'}`,
                    background: isSelected(model.id) ? `${PROVIDER_COLORS[provider]}20` : 'var(--bg-tertiary)',
                    color: isSelected(model.id) ? PROVIDER_COLORS[provider] : 'var(--text-secondary)',
                    fontWeight: isSelected(model.id) ? 600 : 400,
                    transition: 'all 0.15s',
                  }}
                >
                  {model.name}
                  <span style={{ fontSize: 10, marginLeft: 4, opacity: 0.7 }}>
                    ${model.inputPrice}/{model.outputPrice}
                  </span>
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
