import { LLMRequest, StreamChunk } from '@/types';
import { callOpenAI, streamOpenAI } from './openai';
import { callAnthropic, streamAnthropic } from './anthropic';
import { callGemini, streamGemini } from './gemini';
import { callPerplexity, streamPerplexity } from './perplexity';
import { callPerplexityAgent, streamPerplexityAgent } from './perplexity-agent';

export interface ProviderCallResult {
  content: string;
  inputTokens: number;
  outputTokens: number;
}

export type StreamCallback = (chunk: StreamChunk) => void;

export async function callLLM(req: LLMRequest): Promise<ProviderCallResult> {
  switch (req.provider) {
    case 'openai': return callOpenAI(req);
    case 'anthropic': return callAnthropic(req);
    case 'gemini': return callGemini(req);
    case 'perplexity': return callPerplexity(req);
    case 'perplexity-agent': return callPerplexityAgent(req);
    default: throw new Error(`Unknown provider: ${req.provider}`);
  }
}

export async function streamLLM(
  req: LLMRequest,
  onChunk: StreamCallback
): Promise<ProviderCallResult> {
  switch (req.provider) {
    case 'openai': return streamOpenAI(req, onChunk);
    case 'anthropic': return streamAnthropic(req, onChunk);
    case 'gemini': return streamGemini(req, onChunk);
    case 'perplexity': return streamPerplexity(req, onChunk);
    case 'perplexity-agent': return streamPerplexityAgent(req, onChunk);
    default: throw new Error(`Unknown provider: ${req.provider}`);
  }
}
