import { NextRequest, NextResponse } from 'next/server';
import { renderPromptTemplates } from '@/lib/prompt-template';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      systemPrompt?: string;
      userPrompt?: string;
    };

    const rendered = await renderPromptTemplates({
      systemPrompt: body.systemPrompt || '',
      userPrompt: body.userPrompt || '',
    });

    return NextResponse.json(rendered);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
