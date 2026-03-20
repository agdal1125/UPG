import { v4 as uuidv4 } from 'uuid';

export function generateId(): string {
  return uuidv4();
}

export function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function formatCost(cost?: number | null): string {
  const safeCost = Number.isFinite(cost) ? Number(cost) : 0;
  if (safeCost < 0.001) return `$${safeCost.toFixed(6)}`;
  if (safeCost < 0.01) return `$${safeCost.toFixed(4)}`;
  return `$${safeCost.toFixed(3)}`;
}

export function formatLatency(ms?: number | null): string {
  const safeMs = Number.isFinite(ms) ? Number(ms) : 0;
  if (safeMs < 1000) return `${safeMs}ms`;
  return `${(safeMs / 1000).toFixed(1)}s`;
}

export function formatTokens(n?: number | null): string {
  const safeTokens = Number.isFinite(n) ? Number(n) : 0;
  if (safeTokens < 1000) return `${safeTokens}`;
  return `${(safeTokens / 1000).toFixed(1)}K`;
}

export function createCopyName(name?: string | null): string {
  const normalizedName = (name || '').trim() || 'Untitled';
  const match = normalizedName.match(/^(.*?)(?:\s+\(Copy(?:\s+(\d+))?\))$/);

  if (!match) {
    return `${normalizedName} (Copy)`;
  }

  const baseName = match[1].trim() || 'Untitled';
  const copyNumber = match[2] ? Number(match[2]) + 1 : 2;
  return `${baseName} (Copy ${copyNumber})`;
}
