import { NextRequest } from 'next/server';
import { streamLLM } from '@/lib/providers';
import { LLMRequest, StreamChunk } from '@/types';
import { calculateCost } from '@/lib/pricing';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const body = await req.json() as LLMRequest;

  const encoder = new TextEncoder();
  const startTime = Date.now();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (chunk: StreamChunk) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
      };

      try {
        const result = await streamLLM(
          { ...body, stream: true },
          (chunk) => send(chunk)
        );

        const latencyMs = Date.now() - startTime;
        const costUsd = calculateCost(body.model, result.inputTokens, result.outputTokens);

        send({
          type: 'usage',
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
          model: body.model,
          provider: body.provider,
        });

        // Send final metadata
        controller.enqueue(encoder.encode(
          `data: ${JSON.stringify({ type: 'meta', latencyMs, costUsd })}\n\n`
        ));

        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        send({ type: 'error', error: errMsg });
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
