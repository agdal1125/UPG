'use client';

import { create } from 'zustand';
import { LLMParameters, Provider } from '@/types';

export interface ModelSelection {
  provider: Provider;
  model: string;
  parameters: LLMParameters;
}

export interface ResultEntry {
  id: string;
  promptKey: string;
  promptLabel: string;
  promptSetId?: string;
  promptSource: 'draft' | 'saved';
  provider: Provider;
  model: string;
  parameters: LLMParameters;
  requestMethod?: string;
  requestUrl?: string;
  requestHeaders?: string;
  requestBody?: string;
  requestCode?: string;
  content: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  latencyMs: number;
  status: 'pending' | 'streaming' | 'success' | 'error';
  error?: string;
}

interface PlaygroundState {
  systemPrompt: string;
  userPrompt: string;
  responseFormat: string;
  currentPromptSetId: string | null;
  includeCurrentDraft: boolean;
  selectedPromptSetIds: string[];

  selectedModels: ModelSelection[];
  globalParameters: LLMParameters;

  results: ResultEntry[];
  isRunning: boolean;

  setSystemPrompt: (v: string) => void;
  setUserPrompt: (v: string) => void;
  setResponseFormat: (v: string) => void;
  setCurrentPromptSetId: (id: string | null) => void;
  setIncludeCurrentDraft: (v: boolean) => void;
  setSelectedPromptSetIds: (ids: string[]) => void;
  togglePromptSetSelection: (id: string) => void;
  setGlobalParameters: (p: LLMParameters) => void;
  addModel: (m: ModelSelection) => void;
  removeModel: (index: number) => void;
  updateModelParams: (index: number, params: LLMParameters) => void;
  replaceModelParams: (index: number, params: LLMParameters) => void;
  setSelectedModels: (models: ModelSelection[]) => void;
  setIsRunning: (v: boolean) => void;
  clearResults: () => void;
  initResult: (entry: Omit<ResultEntry, 'content' | 'inputTokens' | 'outputTokens' | 'costUsd' | 'latencyMs' | 'status'>) => void;
  updateResult: (id: string, update: Partial<ResultEntry>) => void;
  appendContent: (id: string, delta: string) => void;
}

export const usePlaygroundStore = create<PlaygroundState>((set) => ({
  systemPrompt: '',
  userPrompt: '',
  responseFormat: '',
  currentPromptSetId: null,
  includeCurrentDraft: true,
  selectedPromptSetIds: [],
  selectedModels: [],
  globalParameters: {
    temperature: 0.7,
  },
  results: [],
  isRunning: false,

  setSystemPrompt: (v) => set({ systemPrompt: v }),
  setUserPrompt: (v) => set({ userPrompt: v }),
  setResponseFormat: (v) => set({ responseFormat: v }),
  setCurrentPromptSetId: (id) => set({ currentPromptSetId: id }),
  setIncludeCurrentDraft: (v) => set({ includeCurrentDraft: v }),
  setSelectedPromptSetIds: (ids) => set({ selectedPromptSetIds: Array.from(new Set(ids)) }),
  togglePromptSetSelection: (id) => set((state) => ({
    selectedPromptSetIds: state.selectedPromptSetIds.includes(id)
      ? state.selectedPromptSetIds.filter((existingId) => existingId !== id)
      : [...state.selectedPromptSetIds, id],
  })),
  setGlobalParameters: (p) => set({ globalParameters: p }),

  addModel: (m) => set((state) => ({ selectedModels: [...state.selectedModels, m] })),
  removeModel: (index) => set((state) => ({
    selectedModels: state.selectedModels.filter((_, currentIndex) => currentIndex !== index),
  })),
  updateModelParams: (index, params) => set((state) => ({
    selectedModels: state.selectedModels.map((model, currentIndex) =>
      currentIndex === index ? { ...model, parameters: { ...model.parameters, ...params } } : model
    ),
  })),
  replaceModelParams: (index, params) => set((state) => ({
    selectedModels: state.selectedModels.map((model, currentIndex) =>
      currentIndex === index ? { ...model, parameters: { ...params } } : model
    ),
  })),
  setSelectedModels: (models) => set({ selectedModels: models }),
  setIsRunning: (v) => set({ isRunning: v }),
  clearResults: () => set({ results: [] }),

  initResult: (entry) => set((state) => ({
    results: [...state.results, {
      ...entry,
      content: '',
      inputTokens: 0,
      outputTokens: 0,
      costUsd: 0,
      latencyMs: 0,
      status: 'pending',
    }],
  })),

  updateResult: (id, update) => set((state) => ({
    results: state.results.map((result) => result.id === id ? { ...result, ...update } : result),
  })),

  appendContent: (id, delta) => set((state) => ({
    results: state.results.map((result) =>
      result.id === id ? { ...result, content: result.content + delta, status: 'streaming' } : result
    ),
  })),
}));
