import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { generateId } from '@/lib/utils';

function mapPromptRow(row: Record<string, unknown> | undefined) {
  if (!row) return null;

  return {
    id: String(row.id ?? ''),
    name: String(row.name ?? ''),
    systemPrompt: String(row.system_prompt ?? ''),
    userPrompt: String(row.user_prompt ?? ''),
    responseFormat: row.response_format ? String(row.response_format) : undefined,
    createdAt: String(row.created_at ?? ''),
    updatedAt: String(row.updated_at ?? ''),
  };
}

function getPromptPayload(body: Record<string, unknown>) {
  return {
    name: String(body.name ?? 'Untitled'),
    systemPrompt: String(body.system_prompt ?? body.systemPrompt ?? ''),
    userPrompt: String(body.user_prompt ?? body.userPrompt ?? ''),
    responseFormat: body.response_format ?? body.responseFormat ?? null,
  };
}

export async function GET() {
  const db = getDb();
  const prompts = db.prepare('SELECT * FROM prompt_sets ORDER BY updated_at DESC').all() as Array<Record<string, unknown>>;
  return NextResponse.json(prompts.map(mapPromptRow));
}

export async function POST(req: NextRequest) {
  const body = await req.json() as Record<string, unknown>;
  const db = getDb();
  const id = generateId();
  const payload = getPromptPayload(body);

  db.prepare(`
    INSERT INTO prompt_sets (id, name, system_prompt, user_prompt, response_format)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, payload.name, payload.systemPrompt, payload.userPrompt, payload.responseFormat);

  const created = db.prepare('SELECT * FROM prompt_sets WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  return NextResponse.json(mapPromptRow(created), { status: 201 });
}

export async function PUT(req: NextRequest) {
  const body = await req.json() as Record<string, unknown>;
  const db = getDb();
  const payload = getPromptPayload(body);

  db.prepare(`
    UPDATE prompt_sets
    SET name = ?, system_prompt = ?, user_prompt = ?, response_format = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(payload.name, payload.systemPrompt, payload.userPrompt, payload.responseFormat, body.id);

  const updated = db.prepare('SELECT * FROM prompt_sets WHERE id = ?').get(body.id) as Record<string, unknown> | undefined;
  return NextResponse.json(mapPromptRow(updated));
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const db = getDb();
  db.prepare('DELETE FROM prompt_sets WHERE id = ?').run(id);
  return NextResponse.json({ ok: true });
}
