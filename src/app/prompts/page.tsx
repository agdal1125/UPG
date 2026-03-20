'use client';

import { useState, useEffect } from 'react';
import { PromptSet } from '@/types';
import { createCopyName } from '@/lib/utils';

export default function PromptsPage() {
  const [prompts, setPrompts] = useState<PromptSet[]>([]);
  const [editing, setEditing] = useState<PromptSet | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', systemPrompt: '', userPrompt: '', responseFormat: '' });

  const load = () => {
    fetch('/api/prompts').then(r => r.json()).then(setPrompts).catch(() => {});
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    const method = editing ? 'PUT' : 'POST';
    await fetch('/api/prompts', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...(editing ? { id: editing.id } : {}),
        name: form.name,
        system_prompt: form.systemPrompt,
        user_prompt: form.userPrompt,
        response_format: form.responseFormat || null,
      }),
    });
    setEditing(null);
    setShowCreate(false);
    setForm({ name: '', systemPrompt: '', userPrompt: '', responseFormat: '' });
    load();
  };

  const remove = async (id: string) => {
    await fetch(`/api/prompts?id=${id}`, { method: 'DELETE' });
    load();
  };

  const duplicate = async (ps: PromptSet) => {
    await fetch('/api/prompts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: createCopyName(ps.name),
        system_prompt: ps.systemPrompt,
        user_prompt: ps.userPrompt,
        response_format: ps.responseFormat || null,
      }),
    });
    load();
  };

  const startEdit = (ps: PromptSet) => {
    setEditing(ps);
    setShowCreate(true);
    setForm({
      name: ps.name,
      systemPrompt: ps.systemPrompt,
      userPrompt: ps.userPrompt,
      responseFormat: ps.responseFormat || '',
    });
  };

  return (
    <div style={{ maxWidth: 1000 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Prompt Library</h2>
        <button className="btn btn-primary" onClick={() => {
          setEditing(null);
          setForm({ name: '', systemPrompt: '', userPrompt: '', responseFormat: '' });
          setShowCreate(true);
        }}>
          + New Prompt
        </button>
      </div>

      {/* Create/Edit form */}
      {showCreate && (
        <div className="card" style={{ marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <h3 style={{ margin: 0, fontSize: 16 }}>{editing ? 'Edit' : 'Create'} Prompt Set</h3>
          <input
            placeholder="Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <textarea
            placeholder="System Prompt"
            value={form.systemPrompt}
            onChange={(e) => setForm({ ...form, systemPrompt: e.target.value })}
            rows={5}
            style={{ fontFamily: 'monospace', fontSize: 13 }}
          />
          <textarea
            placeholder="User Prompt"
            value={form.userPrompt}
            onChange={(e) => setForm({ ...form, userPrompt: e.target.value })}
            rows={5}
            style={{ fontFamily: 'monospace', fontSize: 13 }}
          />
          <textarea
            placeholder="Response Format (JSON Schema, optional)"
            value={form.responseFormat}
            onChange={(e) => setForm({ ...form, responseFormat: e.target.value })}
            rows={3}
            style={{ fontFamily: 'monospace', fontSize: 12 }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary" onClick={save}>Save</button>
            <button className="btn btn-secondary" onClick={() => { setShowCreate(false); setEditing(null); }}>Cancel</button>
          </div>
        </div>
      )}

      {/* List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {prompts.length === 0 && (
          <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: 40 }}>
            No saved prompts yet. Create one to get started.
          </div>
        )}
        {prompts.map(ps => (
          <div key={ps.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>{ps.name}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>
                Updated: {new Date(ps.updatedAt).toLocaleString()}
              </div>
              <div style={{ fontSize: 12 }}>
                <div style={{ marginBottom: 4 }}>
                  <span style={{ color: 'var(--accent-blue)', fontWeight: 600 }}>System: </span>
                  <span style={{ color: 'var(--text-secondary)' }}>
                    {ps.systemPrompt ? ps.systemPrompt.slice(0, 100) + (ps.systemPrompt.length > 100 ? '...' : '') : '(empty)'}
                  </span>
                </div>
                <div>
                  <span style={{ color: 'var(--accent-green)', fontWeight: 600 }}>User: </span>
                  <span style={{ color: 'var(--text-secondary)' }}>
                    {ps.userPrompt ? ps.userPrompt.slice(0, 100) + (ps.userPrompt.length > 100 ? '...' : '') : '(empty)'}
                  </span>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="btn btn-secondary btn-sm" onClick={() => startEdit(ps)}>Edit</button>
              <button className="btn btn-secondary btn-sm" onClick={() => duplicate(ps)}>Duplicate</button>
              <button className="btn btn-danger btn-sm" onClick={() => remove(ps.id)}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
