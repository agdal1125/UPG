'use client';

import PromptEditor from '@/components/playground/PromptEditor';
import ModelSelector from '@/components/playground/ModelSelector';
import ParameterPanel from '@/components/playground/ParameterPanel';
import ResultGrid from '@/components/playground/ResultGrid';
import { ensureAuthorizedResponse } from '@/lib/auth-client';
import { calculateCost } from '@/lib/pricing';
import { generateId } from '@/lib/utils';
import { ResultEntry, usePlaygroundStore } from '@/store/playground';
import { LLMParameters, PromptSet, Provider, ProviderRequestDebug } from '@/types';

interface RunnablePrompt {
  key: string;
  label: string;
  promptSetId?: string;
  promptSource: 'draft' | 'saved';
  systemPrompt: string;
  userPrompt: string;
  responseFormat?: string;
}

interface RenderedPrompt extends RunnablePrompt {
  renderedSystemPrompt: string;
  renderedUserPrompt: string;
}

interface RunEntry {
  id: string;
  promptKey: string;
  promptLabel: string;
  promptSetId?: string;
  promptSource: 'draft' | 'saved';
  provider: Provider;
  model: string;
  parameters: LLMParameters;
  responseFormat?: string;
  renderedSystemPrompt: string;
  renderedUserPrompt: string;
}

const MAX_CONCURRENT_REQUESTS = 6;

function hasPromptContent(systemPrompt: string, userPrompt: string) {
  return Boolean(systemPrompt.trim() || userPrompt.trim());
}

async function mapWithConcurrency<T>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<void>,
) {
  let cursor = 0;

  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const currentIndex = cursor;
      cursor += 1;
      if (currentIndex >= items.length) break;
      await worker(items[currentIndex]);
    }
  });

  await Promise.allSettled(runners);
}

async function fetchPromptSets(): Promise<PromptSet[]> {
  const response = await fetch('/api/prompts');
  if (!response.ok) {
    throw new Error('Failed to load saved prompts.');
  }

  return await response.json() as PromptSet[];
}

export default function PlaygroundPage() {
  const isRunning = usePlaygroundStore((state) => state.isRunning);
  const selectedModelsCount = usePlaygroundStore((state) => state.selectedModels.length);
  const systemPrompt = usePlaygroundStore((state) => state.systemPrompt);
  const userPrompt = usePlaygroundStore((state) => state.userPrompt);
  const includeCurrentDraft = usePlaygroundStore((state) => state.includeCurrentDraft);
  const selectedPromptSetIds = usePlaygroundStore((state) => state.selectedPromptSetIds);

  const currentDraftCount = includeCurrentDraft && hasPromptContent(systemPrompt, userPrompt) ? 1 : 0;
  const selectedPromptCount = currentDraftCount + selectedPromptSetIds.length;
  const totalRunCount = selectedPromptCount * selectedModelsCount;

  const runAll = async () => {
    const store = usePlaygroundStore.getState();
    if (store.selectedModels.length === 0) return;

    let promptSets: PromptSet[] = [];

    try {
      promptSets = (store.selectedPromptSetIds.length > 0 || store.currentPromptSetId)
        ? await fetchPromptSets()
        : [];
    } catch (error) {
      window.alert(error instanceof Error ? error.message : String(error));
      return;
    }

    const promptSetMap = new Map(promptSets.map((promptSet) => [promptSet.id, promptSet]));

    const runnablePrompts: RunnablePrompt[] = [];

    if (store.includeCurrentDraft && hasPromptContent(store.systemPrompt, store.userPrompt)) {
      const currentPromptName = store.currentPromptSetId
        ? promptSetMap.get(store.currentPromptSetId)?.name
        : null;

      runnablePrompts.push({
        key: `draft:${store.currentPromptSetId || 'current'}`,
        label: currentPromptName ? `Current Editor (${currentPromptName})` : 'Current Editor',
        promptSetId: store.currentPromptSetId || undefined,
        promptSource: 'draft',
        systemPrompt: store.systemPrompt,
        userPrompt: store.userPrompt,
        responseFormat: store.responseFormat || undefined,
      });
    }

    for (const promptSetId of store.selectedPromptSetIds) {
      const promptSet = promptSetMap.get(promptSetId);
      if (!promptSet) continue;
      if (!hasPromptContent(promptSet.systemPrompt, promptSet.userPrompt)) continue;

      runnablePrompts.push({
        key: `saved:${promptSet.id}`,
        label: promptSet.name,
        promptSetId: promptSet.id,
        promptSource: 'saved',
        systemPrompt: promptSet.systemPrompt,
        userPrompt: promptSet.userPrompt,
        responseFormat: promptSet.responseFormat || undefined,
      });
    }

    if (runnablePrompts.length === 0) return;

    store.setIsRunning(true);
    store.clearResults();

    let renderedPrompts: RenderedPrompt[] = [];

    try {
      renderedPrompts = await Promise.all(runnablePrompts.map(async (prompt) => {
        const response = await fetch('/api/render-prompt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemPrompt: prompt.systemPrompt,
            userPrompt: prompt.userPrompt,
          }),
        });

        if (!(await ensureAuthorizedResponse(response, 'Running prompts requires authentication. Unlock protected actions now?'))) {
          throw new Error('Authentication required to run prompts.');
        }

        if (!response.ok) {
          const errorPayload = await response.json().catch(() => null);
          throw new Error(`${prompt.label}: ${errorPayload?.error || 'Failed to render prompt templates.'}`);
        }

        const rendered = await response.json();
        return {
          ...prompt,
          renderedSystemPrompt: rendered.systemPrompt || '',
          renderedUserPrompt: rendered.userPrompt || '',
        };
      }));
    } catch (error) {
      store.setIsRunning(false);
      if (!(error instanceof Error && error.message === 'Authentication required to run prompts.')) {
        window.alert(error instanceof Error ? error.message : String(error));
      }
      return;
    }

    const entries: RunEntry[] = renderedPrompts.flatMap((prompt) => (
      store.selectedModels.map((modelSelection) => ({
        id: generateId(),
        promptKey: prompt.key,
        promptLabel: prompt.label,
        promptSetId: prompt.promptSetId,
        promptSource: prompt.promptSource,
        provider: modelSelection.provider,
        model: modelSelection.model,
        parameters: modelSelection.parameters,
        responseFormat: prompt.responseFormat,
        renderedSystemPrompt: prompt.renderedSystemPrompt,
        renderedUserPrompt: prompt.renderedUserPrompt.trim() ? prompt.renderedUserPrompt : '\u00A0',
      }))
    ));

    const batchId = generateId();
    const batchLabel = renderedPrompts.length === 1
      ? renderedPrompts[0].label
      : `NxN Batch (${renderedPrompts.length} prompts x ${store.selectedModels.length} models)`;

    entries.forEach((entry) => {
      store.initResult({
        id: entry.id,
        promptKey: entry.promptKey,
        promptLabel: entry.promptLabel,
        promptSetId: entry.promptSetId,
        promptSource: entry.promptSource,
        provider: entry.provider,
        model: entry.model,
        parameters: entry.parameters,
      });
    });

    await mapWithConcurrency(entries, MAX_CONCURRENT_REQUESTS, async (entry) => {
      const startTime = Date.now();

      try {
        store.updateResult(entry.id, { status: 'streaming' });

        const response = await fetch('/api/llm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            provider: entry.provider,
            model: entry.model,
            systemPrompt: entry.renderedSystemPrompt,
            userPrompt: entry.renderedUserPrompt,
            parameters: entry.parameters,
            responseFormat: entry.responseFormat,
            stream: true,
          }),
        });

        if (!response.ok) {
          if (!(await ensureAuthorizedResponse(response, 'Running models requires authentication. Unlock protected actions now?'))) {
            throw new Error('Authentication required to run models.');
          }
          throw new Error(`HTTP ${response.status}: ${await response.text()}`);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error('No response body');

        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data: ')) continue;

            const data = trimmed.slice(6);
            if (data === '[DONE]') continue;

            try {
              const chunk = JSON.parse(data) as Record<string, unknown>;
              if (chunk.type === 'delta' && typeof chunk.content === 'string') {
                store.appendContent(entry.id, chunk.content);
              } else if (chunk.type === 'usage') {
                store.updateResult(entry.id, {
                  inputTokens: Number(chunk.inputTokens || 0),
                  outputTokens: Number(chunk.outputTokens || 0),
                });
              } else if (chunk.type === 'meta') {
                const update: Partial<ResultEntry> = {};

                if (chunk.latencyMs !== undefined) {
                  update.latencyMs = Number(chunk.latencyMs);
                }
                if (chunk.costUsd !== undefined) {
                  update.costUsd = Number(chunk.costUsd);
                }
                if (chunk.requestDebug && typeof chunk.requestDebug === 'object') {
                  const requestDebug = chunk.requestDebug as ProviderRequestDebug;
                  update.requestMethod = requestDebug.method;
                  update.requestUrl = requestDebug.url;
                  update.requestHeaders = JSON.stringify(requestDebug.headers, null, 2);
                  update.requestBody = JSON.stringify(requestDebug.body, null, 2);
                  update.requestCode = requestDebug.code;
                }

                store.updateResult(entry.id, update);
              } else if (chunk.type === 'error') {
                store.updateResult(entry.id, {
                  status: 'error',
                  error: typeof chunk.error === 'string' ? chunk.error : 'Unknown error',
                  latencyMs: Date.now() - startTime,
                });
                return;
              }
            } catch {
              // Ignore malformed chunks.
            }
          }
        }

        const latencyMs = Date.now() - startTime;
        const currentResult = usePlaygroundStore.getState().results.find((result) => result.id === entry.id);
        const costUsd = calculateCost(
          entry.model,
          currentResult?.inputTokens || 0,
          currentResult?.outputTokens || 0,
        );

        store.updateResult(entry.id, {
          status: 'success',
          latencyMs: currentResult?.latencyMs || latencyMs,
          costUsd: currentResult?.costUsd || costUsd,
        });
      } catch (error) {
        store.updateResult(entry.id, {
          status: 'error',
          error: error instanceof Error && error.message === 'Authentication required to run models.'
            ? 'Authentication required.'
            : error instanceof Error ? error.message : String(error),
          latencyMs: Date.now() - startTime,
        });
      }
    });

    const finalResults = usePlaygroundStore.getState().results;

    try {
      await Promise.allSettled(renderedPrompts.map(async (prompt) => {
        const promptResults = finalResults.filter((result) => result.promptKey === prompt.key);
        const promptOrder = renderedPrompts.findIndex((candidate) => candidate.key === prompt.key);

        const response = await fetch('/api/history', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            batchId,
            batchLabel,
            promptSetId: prompt.promptSetId,
            promptLabel: prompt.label,
            promptSource: prompt.promptSource,
            promptOrder,
            systemPrompt: prompt.renderedSystemPrompt,
            userPrompt: prompt.renderedUserPrompt,
            responseFormat: prompt.responseFormat,
            memo: renderedPrompts.length > 1
              ? `Batch run: ${renderedPrompts.length} prompts x ${store.selectedModels.length} models`
              : null,
            results: promptResults.map((result) => ({
              provider: result.provider,
              model: result.model,
              parameters: result.parameters,
              requestMethod: result.requestMethod,
              requestUrl: result.requestUrl,
              requestHeaders: result.requestHeaders,
              requestBody: result.requestBody,
              requestCode: result.requestCode,
              response: result.content,
              inputTokens: result.inputTokens,
              outputTokens: result.outputTokens,
              costUsd: result.costUsd,
              latencyMs: result.latencyMs,
              status: result.status,
              error: result.error,
            })),
          }),
        });
        if (!(await ensureAuthorizedResponse(response, 'Saving run history requires authentication. Unlock protected actions now?'))) {
          return;
        }
      }));
    } catch {
      // Keep the UI usable even if history persistence fails.
    }

    store.setIsRunning(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 1600 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Playground</h2>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
            {selectedPromptCount} prompts x {selectedModelsCount} models = {totalRunCount} runs
          </div>
        </div>
        <button
          className="btn btn-primary btn-lg"
          onClick={runAll}
          disabled={isRunning || selectedModelsCount === 0 || selectedPromptCount === 0}
        >
          {isRunning ? 'Running...' : `Run (${selectedPromptCount} x ${selectedModelsCount})`}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="card">
          <PromptEditor />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card">
            <ModelSelector />
          </div>
          <div className="card">
            <ParameterPanel />
          </div>
        </div>
      </div>

      <div>
        <ResultGrid />
      </div>
    </div>
  );
}
