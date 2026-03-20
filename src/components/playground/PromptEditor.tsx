'use client';

import { useEffect, useState } from 'react';
import { PromptSet } from '@/types';
import { usePlaygroundStore } from '@/store/playground';
import { createCopyName } from '@/lib/utils';

export default function PromptEditor() {
  const {
    systemPrompt,
    setSystemPrompt,
    userPrompt,
    setUserPrompt,
    responseFormat,
    setResponseFormat,
    currentPromptSetId,
    setCurrentPromptSetId,
    includeCurrentDraft,
    setIncludeCurrentDraft,
    selectedPromptSetIds,
    setSelectedPromptSetIds,
    togglePromptSetSelection,
  } = usePlaygroundStore();

  const [promptSets, setPromptSets] = useState<PromptSet[]>([]);
  const [saveName, setSaveName] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);

  const loadPromptSets = async () => {
    const list = await fetch('/api/prompts').then((response) => response.json());
    setPromptSets(list);
  };

  useEffect(() => {
    loadPromptSets().catch(() => {});
  }, []);

  const loadPromptSet = (promptSet: PromptSet) => {
    setSystemPrompt(promptSet.systemPrompt);
    setUserPrompt(promptSet.userPrompt);
    setResponseFormat(promptSet.responseFormat || '');
    setCurrentPromptSetId(promptSet.id);
  };

  const savePromptSet = async () => {
    const existingPrompt = promptSets.find((promptSet) => promptSet.id === currentPromptSetId);
    const resolvedName = saveName.trim() || existingPrompt?.name || '';
    if (!resolvedName) return;

    const method = currentPromptSetId ? 'PUT' : 'POST';
    const body = {
      ...(currentPromptSetId ? { id: currentPromptSetId } : {}),
      name: resolvedName,
      system_prompt: systemPrompt,
      user_prompt: userPrompt,
      response_format: responseFormat || null,
    };

    const res = await fetch('/api/prompts', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) return;

    const saved = await res.json();
    setCurrentPromptSetId(saved.id);
    setShowSaveDialog(false);
    setSaveName('');
    await loadPromptSets();
  };

  const deletePromptSet = async (id: string) => {
    await fetch(`/api/prompts?id=${id}`, { method: 'DELETE' });

    if (currentPromptSetId === id) {
      setCurrentPromptSetId(null);
    }

    setSelectedPromptSetIds(selectedPromptSetIds.filter((selectedId) => selectedId !== id));
    await loadPromptSets();
  };

  const duplicatePromptSet = async () => {
    const existingPrompt = promptSets.find((promptSet) => promptSet.id === currentPromptSetId);
    if (!existingPrompt) return;

    const res = await fetch('/api/prompts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: createCopyName(existingPrompt.name),
        system_prompt: systemPrompt,
        user_prompt: userPrompt,
        response_format: responseFormat || null,
      }),
    });

    if (!res.ok) return;

    const duplicated = await res.json();
    setCurrentPromptSetId(duplicated.id);
    await loadPromptSets();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <select
          value={currentPromptSetId || ''}
          onChange={(e) => {
            if (!e.target.value) {
              setCurrentPromptSetId(null);
              return;
            }

            const promptSet = promptSets.find((item) => item.id === e.target.value);
            if (promptSet) loadPromptSet(promptSet);
          }}
          style={{ flex: 1, minWidth: 200 }}
        >
          <option value="">-- Select saved prompt --</option>
          {promptSets.map((promptSet) => (
            <option key={promptSet.id} value={promptSet.id}>{promptSet.name}</option>
          ))}
        </select>
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => {
            const existingPrompt = promptSets.find((promptSet) => promptSet.id === currentPromptSetId);
            setSaveName(existingPrompt?.name || '');
            setShowSaveDialog(true);
          }}
        >
          Save
        </button>
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => {
            setSystemPrompt('');
            setUserPrompt('');
            setResponseFormat('');
            setCurrentPromptSetId(null);
          }}
        >
          Clear
        </button>
        {currentPromptSetId && (
          <button className="btn btn-secondary btn-sm" onClick={duplicatePromptSet}>
            Duplicate
          </button>
        )}
        {currentPromptSetId && (
          <button
            className="btn btn-danger btn-sm"
            onClick={() => {
              setResponseFormat('');
              deletePromptSet(currentPromptSetId);
            }}
          >
            Delete
          </button>
        )}
      </div>

      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        padding: 12,
        background: 'var(--bg-tertiary)',
        borderRadius: 8,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
              Prompt Batch
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
              Run multiple saved prompts against the selected models.
            </div>
          </div>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setSelectedPromptSetIds([])}
            style={{ fontSize: 11 }}
          >
            Clear Batch
          </button>
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
          <input
            type="checkbox"
            checked={includeCurrentDraft}
            onChange={(e) => setIncludeCurrentDraft(e.target.checked)}
          />
          <span>Include current editor</span>
        </label>

        {promptSets.length > 0 ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {promptSets.map((promptSet) => {
              const checked = selectedPromptSetIds.includes(promptSet.id);
              return (
                <label key={promptSet.id} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 10px',
                  borderRadius: 999,
                  border: '1px solid var(--border-color)',
                  background: checked ? 'var(--bg-primary)' : 'transparent',
                  fontSize: 12,
                  cursor: 'pointer',
                }}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => togglePromptSetSelection(promptSet.id)}
                  />
                  <span>{promptSet.name}</span>
                  {promptSet.id === currentPromptSetId && (
                    <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>(loaded)</span>
                  )}
                </label>
              );
            })}
          </div>
        ) : (
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            Save prompt sets to run NxN batches from the playground.
          </div>
        )}
      </div>

      <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
        Python template expressions are supported at run time. Example: <code>{`{datetime.now().strftime('%Y-%m-%d')}`}</code>.
        Use <code>{`{{`}</code> and <code>{`}}`}</code> for literal braces.
      </div>

      {showSaveDialog && (
        <div style={{
          display: 'flex',
          gap: 8,
          padding: 12,
          background: 'var(--bg-tertiary)',
          borderRadius: 8,
        }}>
          <input
            placeholder="Prompt set name..."
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && savePromptSet()}
            style={{ flex: 1 }}
          />
          <button className="btn btn-primary btn-sm" onClick={savePromptSet}>Save</button>
          <button className="btn btn-secondary btn-sm" onClick={() => setShowSaveDialog(false)}>Cancel</button>
        </div>
      )}

      <div>
        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>
          System Prompt
        </label>
        <textarea
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          placeholder="Enter system prompt..."
          rows={6}
          style={{ width: '100%', resize: 'vertical', fontFamily: 'monospace', fontSize: 13 }}
        />
      </div>

      <div>
        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>
          User Prompt
        </label>
        <textarea
          value={userPrompt}
          onChange={(e) => setUserPrompt(e.target.value)}
          placeholder="Enter user prompt..."
          rows={6}
          style={{ width: '100%', resize: 'vertical', fontFamily: 'monospace', fontSize: 13 }}
        />
      </div>
    </div>
  );
}
