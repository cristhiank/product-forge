/**
 * Hub - Main API facade for Agents Hub
 * Wraps all core modules behind a clean, cohesive interface
 */

import type { Database } from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { openDatabase } from './db/connection.js';
import { initSchema } from './db/schema.js';
import { createChannel, listChannels, ensureChannel } from './core/channels.js';
import {
  postMessage,
  replyToMessage,
  updateMessage,
  readMessages,
  readThread,
} from './core/messages.js';
import { searchMessages } from './core/search.js';
import { watchMessages } from './core/watch.js';
import {
  getStatus,
  getStats,
  exportMessages,
  importMessages,
  garbageCollect,
} from './core/maintenance.js';
import {
  registerWorker,
  getWorker,
  listWorkers,
  updateWorker,
  removeWorker,
  discoverSession,
} from './core/workers.js';
import {
  readNewEvents,
  processEvents,
  buildSyncResult,
  detectHealth,
} from './core/reactor.js';
import {
  recordOperatorAction,
  listOperatorActions,
  summarizeOperatorActions,
} from './core/actions.js';
import { generateId } from './utils/ids.js';
import { now } from './utils/time.js';
import type {
  Channel,
  ChannelInfo,
  Message,
  PostOptions,
  ReplyOptions,
  UpdateOptions,
  ReadOptions,
  SearchOptions,
  SearchResult,
  WatchOptions,
  HubStatus,
  HubStats,
  Worker,
  WorkerStatus,
  WorkerSyncStatus,
  RegisterWorkerOptions,
  WorkerEvent,
  WorkerSyncResult,
  SlowToolExecution,
  ToolDurationStat,
  TokenUsageTotals,
  ModelUsageSummary,
  ProviderUsageSummary,
  OpsSummary,
  OpsToolSummary,
  OpsUsage,
  OpsActions,
  OperatorAction,
} from './core/types.js';

function buildWorkerSyncFailure(
  workerId: string,
  syncStatus: Exclude<WorkerSyncStatus, 'ok'>,
  status: WorkerStatus | null,
  error: string,
): WorkerSyncResult {
  return {
    workerId,
    ok: false,
    syncStatus,
    newEvents: 0,
    status,
    toolCalls: 0,
    turns: 0,
    errors: 0,
    lastEventAt: null,
    error,
    slowTools: [],
    toolDurationStats: [],
    significantEvents: [],
  };
}

interface ToolTimingMetadata {
  pendingStarts: Record<string, { toolName: string; startedAt: string }>;
  toolStats: Record<string, { count: number; totalMs: number; maxMs: number; slowCount: number }>;
  slowTools: SlowToolExecution[];
  toolFailures: Record<string, number>;
}

function parseToolTimingMetadata(workerMetadata: Record<string, unknown>): ToolTimingMetadata {
  const raw = workerMetadata.toolTiming as Record<string, unknown> | undefined;
  const pendingStarts: Record<string, { toolName: string; startedAt: string }> = {};
  const toolStats: Record<string, { count: number; totalMs: number; maxMs: number; slowCount: number }> = {};
  const slowTools: SlowToolExecution[] = [];
  const toolFailures: Record<string, number> = {};

  if (raw && typeof raw === 'object') {
    const rawPending = raw.pendingStarts as Record<string, unknown> | undefined;
    if (rawPending && typeof rawPending === 'object') {
      for (const [toolCallId, value] of Object.entries(rawPending)) {
        if (!toolCallId || !value || typeof value !== 'object') continue;
        const toolName = typeof (value as Record<string, unknown>).toolName === 'string'
          ? ((value as Record<string, unknown>).toolName as string)
          : 'unknown';
        const startedAt = typeof (value as Record<string, unknown>).startedAt === 'string'
          ? ((value as Record<string, unknown>).startedAt as string)
          : '';
        if (!startedAt) continue;
        pendingStarts[toolCallId] = { toolName, startedAt };
      }
    }

    const rawToolStats = raw.toolStats as Record<string, unknown> | undefined;
    if (rawToolStats && typeof rawToolStats === 'object') {
      for (const [toolName, value] of Object.entries(rawToolStats)) {
        if (!toolName || !value || typeof value !== 'object') continue;
        const v = value as Record<string, unknown>;
        const count = typeof v.count === 'number' ? v.count : 0;
        const totalMs = typeof v.totalMs === 'number' ? v.totalMs : 0;
        const maxMs = typeof v.maxMs === 'number' ? v.maxMs : 0;
        const slowCount = typeof v.slowCount === 'number' ? v.slowCount : 0;
        if (count <= 0) continue;
        toolStats[toolName] = { count, totalMs, maxMs, slowCount };
      }
    }

    const rawSlowTools = raw.slowTools;
    if (Array.isArray(rawSlowTools)) {
      for (const item of rawSlowTools) {
        if (!item || typeof item !== 'object') continue;
        const v = item as Record<string, unknown>;
        if (typeof v.toolName !== 'string' || typeof v.completedAt !== 'string' || typeof v.durationMs !== 'number') continue;
        slowTools.push({
          toolName: v.toolName,
          toolCallId: typeof v.toolCallId === 'string' ? v.toolCallId : null,
          startedAt: typeof v.startedAt === 'string' ? v.startedAt : null,
          completedAt: v.completedAt,
          durationMs: v.durationMs,
          success: v.success !== false,
        });
      }
    }

    const rawToolFailures = raw.toolFailures as Record<string, unknown> | undefined;
    if (rawToolFailures && typeof rawToolFailures === 'object') {
      for (const [toolName, value] of Object.entries(rawToolFailures)) {
        if (!toolName) continue;
        const count = typeof value === 'number' ? value : 0;
        if (count > 0) toolFailures[toolName] = count;
      }
    }
  }

  return { pendingStarts, toolStats, slowTools, toolFailures };
}

function toolStatsRecordToArray(
  toolStats: Record<string, { count: number; totalMs: number; maxMs: number; slowCount: number }>
): ToolDurationStat[] {
  return Object.entries(toolStats)
    .map(([toolName, stats]) => ({
      toolName,
      count: stats.count,
      totalMs: stats.totalMs,
      avgMs: Math.round(stats.totalMs / stats.count),
      maxMs: stats.maxMs,
      slowCount: stats.slowCount,
    }))
    .sort((a, b) => b.totalMs - a.totalMs || a.toolName.localeCompare(b.toolName));
}

const EMPTY_USAGE_TOTALS: TokenUsageTotals = {
  inputTokens: 0,
  outputTokens: 0,
  cachedInputTokens: 0,
  cachedOutputTokens: 0,
  compactionInputTokens: 0,
  compactionOutputTokens: 0,
  compactionCachedInputTokens: 0,
  compactionReclaimedTokens: 0,
  totalTokens: 0,
};

interface UsageDelta {
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
  cachedOutputTokens: number;
}

interface ProviderPricing {
  inputPer1K: number;
  outputPer1K: number;
  cachedInputPer1K: number;
  cachedOutputPer1K: number;
}

interface OpsTelemetryMetadata {
  activeModel: string | null;
  activeProvider: string | null;
  modelSwitches: number;
  estimatedCostUsd: number;
  usageTotals: TokenUsageTotals;
  models: Record<string, ModelUsageSummary>;
  providers: Record<string, ProviderUsageSummary>;
}

const PROVIDER_PRICING_USD_PER_1K: Record<string, ProviderPricing> = {
  anthropic: { inputPer1K: 0.003, outputPer1K: 0.015, cachedInputPer1K: 0.0003, cachedOutputPer1K: 0 },
  openai: { inputPer1K: 0.005, outputPer1K: 0.015, cachedInputPer1K: 0.001, cachedOutputPer1K: 0 },
  google: { inputPer1K: 0.002, outputPer1K: 0.008, cachedInputPer1K: 0.0002, cachedOutputPer1K: 0 },
  github: { inputPer1K: 0.0025, outputPer1K: 0.01, cachedInputPer1K: 0.0005, cachedOutputPer1K: 0 },
  unknown: { inputPer1K: 0.0, outputPer1K: 0.0, cachedInputPer1K: 0.0, cachedOutputPer1K: 0.0 },
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') return null;
  return value as Record<string, unknown>;
}

function asFiniteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function firstNumber(source: Record<string, unknown> | null, keys: string[]): number {
  if (!source) return 0;
  for (const key of keys) {
    const value = asFiniteNumber(source[key]);
    if (value !== null) return Math.max(0, value);
  }
  return 0;
}

function cloneUsageTotals(usage: TokenUsageTotals): TokenUsageTotals {
  return {
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    cachedInputTokens: usage.cachedInputTokens,
    cachedOutputTokens: usage.cachedOutputTokens,
    compactionInputTokens: usage.compactionInputTokens,
    compactionOutputTokens: usage.compactionOutputTokens,
    compactionCachedInputTokens: usage.compactionCachedInputTokens,
    compactionReclaimedTokens: usage.compactionReclaimedTokens,
    totalTokens: usage.totalTokens,
  };
}

function addUsage(totals: TokenUsageTotals, usage: UsageDelta): void {
  totals.inputTokens += usage.inputTokens;
  totals.outputTokens += usage.outputTokens;
  totals.cachedInputTokens += usage.cachedInputTokens;
  totals.cachedOutputTokens += usage.cachedOutputTokens;
  totals.totalTokens += usage.inputTokens + usage.outputTokens + usage.cachedInputTokens + usage.cachedOutputTokens;
}

function parseUsageDelta(data: Record<string, unknown>): UsageDelta {
  const sources: Array<Record<string, unknown> | null> = [
    asRecord(data.usage),
    asRecord(data.tokensUsed),
    asRecord(data.tokenUsage),
    asRecord(data.usageMetrics),
    data,
  ];
  const keys = {
    input: ['inputTokens', 'input_tokens', 'promptTokens', 'prompt_tokens', 'input'],
    output: ['outputTokens', 'output_tokens', 'completionTokens', 'completion_tokens', 'output'],
    cachedInput: ['cachedInputTokens', 'cached_input_tokens', 'cachedInput', 'cached_input'],
    cachedOutput: ['cachedOutputTokens', 'cached_output_tokens', 'cachedOutput', 'cached_output'],
  };
  for (const source of sources) {
    if (!source) continue;
    const usage: UsageDelta = {
      inputTokens: firstNumber(source, keys.input),
      outputTokens: firstNumber(source, keys.output),
      cachedInputTokens: firstNumber(source, keys.cachedInput),
      cachedOutputTokens: firstNumber(source, keys.cachedOutput),
    };
    if (usage.inputTokens + usage.outputTokens + usage.cachedInputTokens + usage.cachedOutputTokens > 0) {
      return usage;
    }
  }
  return { inputTokens: 0, outputTokens: 0, cachedInputTokens: 0, cachedOutputTokens: 0 };
}

function parseCompactionUsage(data: Record<string, unknown>): {
  usage: UsageDelta;
  reclaimedTokens: number;
} {
  const source = asRecord(data.compactionTokensUsed) ?? asRecord(data.compaction_tokens_used);
  const usage = source
    ? {
        inputTokens: firstNumber(source, ['input', 'inputTokens', 'input_tokens', 'promptTokens', 'prompt_tokens']),
        outputTokens: firstNumber(source, ['output', 'outputTokens', 'output_tokens', 'completionTokens', 'completion_tokens']),
        cachedInputTokens: firstNumber(source, ['cachedInput', 'cached_input', 'cachedInputTokens', 'cached_input_tokens']),
        cachedOutputTokens: firstNumber(source, ['cachedOutput', 'cached_output', 'cachedOutputTokens', 'cached_output_tokens']),
      }
    : { inputTokens: 0, outputTokens: 0, cachedInputTokens: 0, cachedOutputTokens: 0 };

  const explicitReclaimed = asFiniteNumber(data.compactionReclaimedTokens)
    ?? asFiniteNumber(data.compaction_reclaimed_tokens)
    ?? 0;
  const pre = asFiniteNumber(data.preCompactionTokens) ?? asFiniteNumber(data.pre_compaction_tokens);
  const post = asFiniteNumber(data.postCompactionTokens) ?? asFiniteNumber(data.post_compaction_tokens);
  const derivedReclaimed = pre !== null && post !== null ? Math.max(0, pre - post) : 0;
  return {
    usage,
    reclaimedTokens: Math.max(0, explicitReclaimed || derivedReclaimed),
  };
}

function detectProviderFromModel(model: string | null): string {
  if (!model) return 'unknown';
  const lower = model.toLowerCase();
  if (lower.startsWith('claude')) return 'anthropic';
  if (lower.startsWith('gpt') || lower.startsWith('o1') || lower.startsWith('o3')) return 'openai';
  if (lower.startsWith('gemini')) return 'google';
  if (lower.startsWith('copilot')) return 'github';
  return 'unknown';
}

function pricingForProvider(provider: string): ProviderPricing {
  return PROVIDER_PRICING_USD_PER_1K[provider] ?? PROVIDER_PRICING_USD_PER_1K.unknown;
}

function calculateUsageCostUsd(provider: string, usage: UsageDelta): number {
  const pricing = pricingForProvider(provider);
  return (
    (usage.inputTokens / 1000) * pricing.inputPer1K +
    (usage.outputTokens / 1000) * pricing.outputPer1K +
    (usage.cachedInputTokens / 1000) * pricing.cachedInputPer1K +
    (usage.cachedOutputTokens / 1000) * pricing.cachedOutputPer1K
  );
}

function ensureModelUsage(
  models: Record<string, ModelUsageSummary>,
  model: string,
  provider: string,
): ModelUsageSummary {
  const existing = models[model];
  if (existing) return existing;
  const created: ModelUsageSummary = {
    model,
    provider,
    inputTokens: 0,
    outputTokens: 0,
    cachedInputTokens: 0,
    cachedOutputTokens: 0,
    totalTokens: 0,
    costUsd: 0,
    requests: 0,
    lastUsedAt: null,
  };
  models[model] = created;
  return created;
}

function ensureProviderUsage(
  providers: Record<string, ProviderUsageSummary>,
  provider: string,
): ProviderUsageSummary {
  const existing = providers[provider];
  if (existing) return existing;
  const created: ProviderUsageSummary = {
    provider,
    inputTokens: 0,
    outputTokens: 0,
    cachedInputTokens: 0,
    cachedOutputTokens: 0,
    totalTokens: 0,
    costUsd: 0,
    requests: 0,
    lastUsedAt: null,
  };
  providers[provider] = created;
  return created;
}

function defaultOpsTelemetry(): OpsTelemetryMetadata {
  return {
    activeModel: null,
    activeProvider: null,
    modelSwitches: 0,
    estimatedCostUsd: 0,
    usageTotals: { ...EMPTY_USAGE_TOTALS },
    models: {},
    providers: {},
  };
}

function parseOpsTelemetryMetadata(workerMetadata: Record<string, unknown>): OpsTelemetryMetadata {
  const raw = asRecord(workerMetadata.opsTelemetry);
  if (!raw) return defaultOpsTelemetry();

  const modelsRaw = asRecord(raw.models) ?? {};
  const providersRaw = asRecord(raw.providers) ?? {};
  const models: Record<string, ModelUsageSummary> = {};
  for (const [key, value] of Object.entries(modelsRaw)) {
    const item = asRecord(value);
    if (!item) continue;
    models[key] = {
      model: typeof item.model === 'string' ? item.model : key,
      provider: typeof item.provider === 'string' ? item.provider : 'unknown',
      inputTokens: firstNumber(item, ['inputTokens']),
      outputTokens: firstNumber(item, ['outputTokens']),
      cachedInputTokens: firstNumber(item, ['cachedInputTokens']),
      cachedOutputTokens: firstNumber(item, ['cachedOutputTokens']),
      totalTokens: firstNumber(item, ['totalTokens']),
      costUsd: firstNumber(item, ['costUsd']),
      requests: firstNumber(item, ['requests']),
      lastUsedAt: typeof item.lastUsedAt === 'string' ? item.lastUsedAt : null,
    };
  }

  const providers: Record<string, ProviderUsageSummary> = {};
  for (const [key, value] of Object.entries(providersRaw)) {
    const item = asRecord(value);
    if (!item) continue;
    providers[key] = {
      provider: typeof item.provider === 'string' ? item.provider : key,
      inputTokens: firstNumber(item, ['inputTokens']),
      outputTokens: firstNumber(item, ['outputTokens']),
      cachedInputTokens: firstNumber(item, ['cachedInputTokens']),
      cachedOutputTokens: firstNumber(item, ['cachedOutputTokens']),
      totalTokens: firstNumber(item, ['totalTokens']),
      costUsd: firstNumber(item, ['costUsd']),
      requests: firstNumber(item, ['requests']),
      lastUsedAt: typeof item.lastUsedAt === 'string' ? item.lastUsedAt : null,
    };
  }

  return {
    activeModel: typeof raw.activeModel === 'string' ? raw.activeModel : null,
    activeProvider: typeof raw.activeProvider === 'string' ? raw.activeProvider : null,
    modelSwitches: firstNumber(raw, ['modelSwitches']),
    estimatedCostUsd: firstNumber(raw, ['estimatedCostUsd']),
    usageTotals: {
      inputTokens: firstNumber(asRecord(raw.usageTotals), ['inputTokens']),
      outputTokens: firstNumber(asRecord(raw.usageTotals), ['outputTokens']),
      cachedInputTokens: firstNumber(asRecord(raw.usageTotals), ['cachedInputTokens']),
      cachedOutputTokens: firstNumber(asRecord(raw.usageTotals), ['cachedOutputTokens']),
      compactionInputTokens: firstNumber(asRecord(raw.usageTotals), ['compactionInputTokens']),
      compactionOutputTokens: firstNumber(asRecord(raw.usageTotals), ['compactionOutputTokens']),
      compactionCachedInputTokens: firstNumber(asRecord(raw.usageTotals), ['compactionCachedInputTokens']),
      compactionReclaimedTokens: firstNumber(asRecord(raw.usageTotals), ['compactionReclaimedTokens']),
      totalTokens: firstNumber(asRecord(raw.usageTotals), ['totalTokens']),
    },
    models,
    providers,
  };
}

function applyUsageToBuckets(
  telemetry: OpsTelemetryMetadata,
  model: string,
  provider: string,
  usage: UsageDelta,
  timestamp: string,
): void {
  if (usage.inputTokens + usage.outputTokens + usage.cachedInputTokens + usage.cachedOutputTokens <= 0) return;

  addUsage(telemetry.usageTotals, usage);
  const costDelta = calculateUsageCostUsd(provider, usage);
  telemetry.estimatedCostUsd += costDelta;

  const modelSummary = ensureModelUsage(telemetry.models, model, provider);
  modelSummary.inputTokens += usage.inputTokens;
  modelSummary.outputTokens += usage.outputTokens;
  modelSummary.cachedInputTokens += usage.cachedInputTokens;
  modelSummary.cachedOutputTokens += usage.cachedOutputTokens;
  modelSummary.totalTokens += usage.inputTokens + usage.outputTokens + usage.cachedInputTokens + usage.cachedOutputTokens;
  modelSummary.costUsd += costDelta;
  modelSummary.requests += 1;
  modelSummary.lastUsedAt = timestamp;

  const providerSummary = ensureProviderUsage(telemetry.providers, provider);
  providerSummary.inputTokens += usage.inputTokens;
  providerSummary.outputTokens += usage.outputTokens;
  providerSummary.cachedInputTokens += usage.cachedInputTokens;
  providerSummary.cachedOutputTokens += usage.cachedOutputTokens;
  providerSummary.totalTokens += usage.inputTokens + usage.outputTokens + usage.cachedInputTokens + usage.cachedOutputTokens;
  providerSummary.costUsd += costDelta;
  providerSummary.requests += 1;
  providerSummary.lastUsedAt = timestamp;
}

function resolveModelFromEvent(data: Record<string, unknown>): string | null {
  const candidates = [
    data.newModel,
    data.selectedModel,
    data.model,
    asRecord(data.context)?.model,
    asRecord(data.session)?.model,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim().length > 0) return candidate.trim();
  }
  return null;
}

function updateOpsTelemetryFromEvents(
  existing: OpsTelemetryMetadata,
  events: WorkerEvent[],
): OpsTelemetryMetadata {
  const next: OpsTelemetryMetadata = {
    activeModel: existing.activeModel,
    activeProvider: existing.activeProvider,
    modelSwitches: existing.modelSwitches,
    estimatedCostUsd: existing.estimatedCostUsd,
    usageTotals: cloneUsageTotals(existing.usageTotals),
    models: { ...existing.models },
    providers: { ...existing.providers },
  };

  for (const event of events) {
    const data = event.data ?? {};
    const modelFromEvent = resolveModelFromEvent(data);
    if (modelFromEvent && modelFromEvent !== next.activeModel) {
      if (next.activeModel) next.modelSwitches += 1;
      next.activeModel = modelFromEvent;
      next.activeProvider = detectProviderFromModel(modelFromEvent);
    } else if (!next.activeProvider && next.activeModel) {
      next.activeProvider = detectProviderFromModel(next.activeModel);
    }

    let usage = parseUsageDelta(data);
    if (event.type === 'session.compaction_complete') {
      const compaction = parseCompactionUsage(data);
      next.usageTotals.compactionInputTokens += compaction.usage.inputTokens;
      next.usageTotals.compactionOutputTokens += compaction.usage.outputTokens;
      next.usageTotals.compactionCachedInputTokens += compaction.usage.cachedInputTokens;
      next.usageTotals.compactionReclaimedTokens += compaction.reclaimedTokens;
      if (usage.inputTokens + usage.outputTokens + usage.cachedInputTokens + usage.cachedOutputTokens === 0) {
        usage = compaction.usage;
      }
    }

    const model = modelFromEvent ?? next.activeModel ?? 'unknown';
    const provider = modelFromEvent
      ? detectProviderFromModel(modelFromEvent)
      : next.activeProvider ?? detectProviderFromModel(model);
    applyUsageToBuckets(next, model, provider, usage, event.timestamp);
  }

  return next;
}

function calculateBurnRateUsdPerHour(worker: Worker): number {
  const estimatedCostUsd = worker.estimatedCostUsd ?? 0;
  if (estimatedCostUsd <= 0) return 0;
  const startedAt = new Date(worker.registeredAt).getTime();
  if (Number.isNaN(startedAt)) return 0;
  const elapsedHours = Math.max((Date.now() - startedAt) / 3_600_000, 1 / 60);
  return estimatedCostUsd / elapsedHours;
}

function mergeUsageTotals(target: TokenUsageTotals, usage?: TokenUsageTotals): void {
  if (!usage) return;
  target.inputTokens += usage.inputTokens;
  target.outputTokens += usage.outputTokens;
  target.cachedInputTokens += usage.cachedInputTokens;
  target.cachedOutputTokens += usage.cachedOutputTokens;
  target.compactionInputTokens += usage.compactionInputTokens;
  target.compactionOutputTokens += usage.compactionOutputTokens;
  target.compactionCachedInputTokens += usage.compactionCachedInputTokens;
  target.compactionReclaimedTokens += usage.compactionReclaimedTokens;
  target.totalTokens += usage.totalTokens;
}

function aggregateUsageAcrossWorkers(workers: Worker[]): {
  totals: TokenUsageTotals;
  estimatedCostUsd: number;
  burnRateUsdPerHour: number;
  modelDistribution: ModelUsageSummary[];
  providerDistribution: ProviderUsageSummary[];
} {
  const totals: TokenUsageTotals = { ...EMPTY_USAGE_TOTALS };
  const models: Record<string, ModelUsageSummary> = {};
  const providers: Record<string, ProviderUsageSummary> = {};
  let estimatedCostUsd = 0;
  let burnRateUsdPerHour = 0;

  for (const worker of workers) {
    mergeUsageTotals(totals, worker.usage);
    estimatedCostUsd += worker.estimatedCostUsd ?? 0;
    burnRateUsdPerHour += calculateBurnRateUsdPerHour(worker);

    for (const [model, summary] of Object.entries(worker.modelUsage ?? {})) {
      const existing = models[model] ?? {
        model,
        provider: summary.provider,
        inputTokens: 0,
        outputTokens: 0,
        cachedInputTokens: 0,
        cachedOutputTokens: 0,
        totalTokens: 0,
        costUsd: 0,
        requests: 0,
        lastUsedAt: null,
      };
      existing.inputTokens += summary.inputTokens;
      existing.outputTokens += summary.outputTokens;
      existing.cachedInputTokens += summary.cachedInputTokens;
      existing.cachedOutputTokens += summary.cachedOutputTokens;
      existing.totalTokens += summary.totalTokens;
      existing.costUsd += summary.costUsd;
      existing.requests += summary.requests;
      if (!existing.lastUsedAt || (summary.lastUsedAt && summary.lastUsedAt > existing.lastUsedAt)) {
        existing.lastUsedAt = summary.lastUsedAt;
      }
      models[model] = existing;
    }

    for (const [provider, summary] of Object.entries(worker.providerUsage ?? {})) {
      const existing = providers[provider] ?? {
        provider,
        inputTokens: 0,
        outputTokens: 0,
        cachedInputTokens: 0,
        cachedOutputTokens: 0,
        totalTokens: 0,
        costUsd: 0,
        requests: 0,
        lastUsedAt: null,
      };
      existing.inputTokens += summary.inputTokens;
      existing.outputTokens += summary.outputTokens;
      existing.cachedInputTokens += summary.cachedInputTokens;
      existing.cachedOutputTokens += summary.cachedOutputTokens;
      existing.totalTokens += summary.totalTokens;
      existing.costUsd += summary.costUsd;
      existing.requests += summary.requests;
      if (!existing.lastUsedAt || (summary.lastUsedAt && summary.lastUsedAt > existing.lastUsedAt)) {
        existing.lastUsedAt = summary.lastUsedAt;
      }
      providers[provider] = existing;
    }
  }

  const modelDistribution = Object.values(models)
    .sort((a, b) => b.totalTokens - a.totalTokens || b.costUsd - a.costUsd || a.model.localeCompare(b.model));
  const providerDistribution = Object.values(providers)
    .sort((a, b) => b.totalTokens - a.totalTokens || b.costUsd - a.costUsd || a.provider.localeCompare(b.provider));

  return {
    totals,
    estimatedCostUsd,
    burnRateUsdPerHour,
    modelDistribution,
    providerDistribution,
  };
}

/**
 * Hub class - main entry point for Agents Hub
 */
export class Hub {
  private db: Database;
  private dbPath: string;

  /**
   * Create a Hub instance from an existing database
   * @param dbPath - Path to SQLite database file
   */
  constructor(dbPath: string) {
    this.dbPath = dbPath;
    this.db = openDatabase(dbPath);
    initSchema(this.db);
  }

  /**
   * Initialize a new Hub with metadata and default channels
   * @param dbPath - Path to SQLite database file
   * @param mode - Hub mode: 'single' for single-agent, 'multi' for multi-agent
   * @param hubId - Optional hub ID (auto-generated if not provided)
   * @returns Hub instance with initialized metadata
   */
  static init(
    dbPath: string,
    mode: 'single' | 'multi' = 'single',
    hubId?: string
  ): Hub {
    // Ensure parent directory exists
    const dir = dirname(dbPath);
    mkdirSync(dir, { recursive: true });

    // Create Hub instance (constructor handles DB open + schema init)
    const hub = new Hub(dbPath);

    // Insert hub metadata as key-value pairs
    const id = hubId ?? generateId();
    const createdAt = now();
    const insertMeta = hub.db.prepare('INSERT INTO hub_meta (key, value) VALUES (?, ?)');
    insertMeta.run('schema_version', '1.0');
    insertMeta.run('created_at', createdAt);
    insertMeta.run('mode', mode);
    insertMeta.run('hub_id', id);

    // Create #main channel (always present)
    createChannel(hub.db, '#main', {
      createdBy: 'system',
      description: 'Main communication channel',
    });

    // Create #general channel for multi-agent mode
    if (mode === 'multi') {
      createChannel(hub.db, '#general', {
        createdBy: 'system',
        description: 'General discussion and coordination',
      });
    }

    return hub;
  }

  // ============ Channel Methods ============

  /**
   * Create a new channel
   * @param name - Channel name (must start with #)
   * @param opts - Optional channel metadata
   * @returns Created channel
   */
  channelCreate(
    name: string,
    opts?: {
      description?: string;
      workerId?: string;
      createdBy?: string;
    }
  ): Channel {
    return createChannel(this.db, name, {
      createdBy: opts?.createdBy ?? 'unknown',
      description: opts?.description,
      workerId: opts?.workerId,
    });
  }

  /**
   * List all channels
   * @param includeStats - Include message counts and last activity
   * @returns Array of channels or channel info with stats
   */
  channelList(includeStats = false): Channel[] | ChannelInfo[] {
    return listChannels(this.db, includeStats);
  }

  // ============ Message Methods ============

  /**
   * Post a new message to a channel
   * Automatically creates the channel if it doesn't exist
   * @param opts - Message options
   * @returns Created message
   */
  post(opts: PostOptions): Message {
    // Ensure channel exists before posting
    ensureChannel(this.db, opts.channel, opts.author);
    return postMessage(this.db, opts);
  }

  /**
   * Reply to an existing message (creates threaded message)
   * @param threadId - ID of the message to reply to
   * @param opts - Reply options
   * @returns Created reply message
   */
  reply(threadId: string, opts: ReplyOptions): Message {
    return replyToMessage(this.db, threadId, opts);
  }

  /**
   * Update an existing message
   * @param id - Message ID
   * @param opts - Update options
   * @returns Updated message
   */
  update(id: string, opts: UpdateOptions): Message {
    return updateMessage(this.db, id, opts);
  }

  /**
   * Read messages with optional filtering
   * @param opts - Query options
   * @returns Paginated message results
   */
  read(opts?: ReadOptions): { messages: Message[]; total: number; hasMore: boolean } {
    return readMessages(this.db, opts);
  }

  /**
   * Read all messages in a thread
   * @param messageId - ID of any message in the thread
   * @returns Array of messages in chronological order
   */
  readThread(messageId: string): Message[] {
    return readThread(this.db, messageId);
  }

  // ============ Search & Watch ============

  /**
   * Full-text search across messages
   * @param query - FTS5 search query
   * @param opts - Search options
   * @returns Ranked search results
   */
  search(query: string, opts?: SearchOptions): SearchResult[] {
    return searchMessages(this.db, query, opts);
  }

  /**
   * Watch for new messages (async generator)
   * @param opts - Watch options
   * @returns Async generator yielding new messages
   */
  watch(opts?: WatchOptions): AsyncGenerator<Message> {
    return watchMessages(this.db, this.dbPath, opts);
  }

  // ============ Status & Maintenance ============

  /**
   * Get hub status overview
   * @returns Hub status with message counts and activity
   */
  status(): HubStatus {
    return getStatus(this.db);
  }

  /**
   * Export messages to NDJSON format
   * @param opts - Export options
   * @returns NDJSON string
   */
  export(opts?: {
    channel?: string;
    since?: string;
    format?: 'ndjson' | 'csv';
  }): string {
    return exportMessages(this.db, opts);
  }

  /**
   * Import messages from NDJSON format
   * @param ndjson - NDJSON string of messages
   * @returns Number of messages imported
   */
  import(ndjson: string): number {
    return importMessages(this.db, ndjson);
  }

  /**
   * Garbage collect old messages
   * @param olderThan - ISO timestamp (messages older than this will be removed)
   * @param dryRun - If true, only count without deleting
   * @returns Object with number of messages removed
   */
  gc(olderThan?: string, dryRun = false): { removed: number } {
    return garbageCollect(this.db, olderThan, dryRun);
  }

  /**
   * Get hub statistics
   * @returns Hub statistics including DB size and message counts
   */
  stats(): HubStats {
    return getStats(this.db, this.dbPath);
  }

  // ============ Worker Methods ============

  /**
   * Register a new worker
   */
  workerRegister(opts: RegisterWorkerOptions): Worker {
    return registerWorker(this.db, opts);
  }

  /**
   * Get a worker by ID
   */
  workerGet(id: string): Worker | null {
    return getWorker(this.db, id);
  }

  /**
   * List workers with optional status filter
   */
  workerList(opts?: { status?: WorkerStatus }): Worker[] {
    return listWorkers(this.db, opts);
  }

  /**
   * Sync a worker's events — reads new events from events.jsonl, updates counters and status
   */
  workerSync(id: string): WorkerSyncResult {
    const worker = getWorker(this.db, id);
    if (!worker) return buildWorkerSyncFailure(id, 'no_worker', null, `Worker not found: ${id}`);
    const workerMetadata = (worker.metadata ?? {}) as Record<string, unknown>;
    const hasStoredOpsTelemetry = asRecord(workerMetadata.opsTelemetry) !== null;
    const toolTiming = parseToolTimingMetadata(workerMetadata);
    const opsTelemetry = parseOpsTelemetryMetadata(workerMetadata);

    // Lazy re-discovery: if eventsPath is missing, retry discoverSession
    if (!worker.eventsPath) {
      const session = discoverSession(id);
      if (!session) {
        return buildWorkerSyncFailure(
          id,
          'no_events_path',
          worker.status,
          `No events path available for worker: ${id}`,
        );
      }
      updateWorker(this.db, id, { sessionId: session.sessionId, eventsPath: session.eventsPath });
      worker.eventsPath = session.eventsPath;
      worker.sessionId = session.sessionId;
    }

    const { events, newOffset, parseErrors, fileMissing } = readNewEvents(worker.eventsPath, worker.eventsOffset);
    if (fileMissing) {
      return buildWorkerSyncFailure(
        id,
        'events_missing',
        worker.status,
        `Events file not found at path: ${worker.eventsPath}`,
      );
    }
    if (parseErrors > 0 && events.length === 0) {
      return buildWorkerSyncFailure(
        id,
        'parse_error',
        worker.status,
        `Failed to parse ${parseErrors} event line(s) for worker: ${id}`,
      );
    }

    let telemetryForSync = opsTelemetry;
    let telemetryBackfilled = false;
    if (!hasStoredOpsTelemetry && worker.eventsOffset > 0) {
      const historicalRead = readNewEvents(worker.eventsPath, 0);
      if (historicalRead.events.length > 0) {
        telemetryForSync = updateOpsTelemetryFromEvents(defaultOpsTelemetry(), historicalRead.events);
        telemetryBackfilled = true;
      }
    }

    if (events.length === 0) {
      const result = buildSyncResult(id, events, processEvents([], toolTiming.pendingStarts), worker.status);
      result.slowTools = toolTiming.slowTools;
      result.toolDurationStats = toolStatsRecordToArray(toolTiming.toolStats);
      result.toolFailureCounts = toolTiming.toolFailures;
      result.activeModel = telemetryForSync.activeModel;
      result.activeProvider = telemetryForSync.activeProvider;
      result.modelSwitches = telemetryForSync.modelSwitches;
      result.estimatedCostUsd = telemetryForSync.estimatedCostUsd;
      result.usage = cloneUsageTotals(telemetryForSync.usageTotals);
      result.modelUsage = { ...telemetryForSync.models };
      result.providerUsage = { ...telemetryForSync.providers };

      if (!hasStoredOpsTelemetry || telemetryBackfilled) {
        updateWorker(this.db, id, {
          metadata: {
            ...workerMetadata,
            toolTiming: {
              pendingStarts: toolTiming.pendingStarts,
              toolStats: toolTiming.toolStats,
              slowTools: toolTiming.slowTools,
              toolFailures: toolTiming.toolFailures,
            },
            opsTelemetry: {
              activeModel: telemetryForSync.activeModel,
              activeProvider: telemetryForSync.activeProvider,
              modelSwitches: telemetryForSync.modelSwitches,
              estimatedCostUsd: telemetryForSync.estimatedCostUsd,
              usageTotals: telemetryForSync.usageTotals,
              models: telemetryForSync.models,
              providers: telemetryForSync.providers,
            },
          },
        });
      }
      return result;
    }

    const processed = processEvents(events, toolTiming.pendingStarts);
    const result = buildSyncResult(id, events, processed, worker.status);

    const mergedToolStats = { ...toolTiming.toolStats };
    for (const stat of processed.toolDurationStats) {
      const existing = mergedToolStats[stat.toolName] ?? { count: 0, totalMs: 0, maxMs: 0, slowCount: 0 };
      existing.count += stat.count;
      existing.totalMs += stat.totalMs;
      existing.maxMs = Math.max(existing.maxMs, stat.maxMs);
      existing.slowCount += stat.slowCount;
      mergedToolStats[stat.toolName] = existing;
    }
    const mergedSlowTools = [...toolTiming.slowTools, ...processed.slowTools]
      .sort((a, b) => b.completedAt.localeCompare(a.completedAt))
      .slice(0, 20);
    const mergedToolFailures = { ...toolTiming.toolFailures };
    for (const [toolName, count] of Object.entries(processed.toolFailureCounts ?? {})) {
      mergedToolFailures[toolName] = (mergedToolFailures[toolName] ?? 0) + count;
    }
    const mergedOpsTelemetry = telemetryBackfilled
      ? telemetryForSync
      : updateOpsTelemetryFromEvents(telemetryForSync, events);

    result.slowTools = mergedSlowTools;
    result.toolDurationStats = toolStatsRecordToArray(mergedToolStats);
    result.toolFailureCounts = mergedToolFailures;
    result.activeModel = mergedOpsTelemetry.activeModel;
    result.activeProvider = mergedOpsTelemetry.activeProvider;
    result.modelSwitches = mergedOpsTelemetry.modelSwitches;
    result.estimatedCostUsd = mergedOpsTelemetry.estimatedCostUsd;
    result.usage = cloneUsageTotals(mergedOpsTelemetry.usageTotals);
    result.modelUsage = { ...mergedOpsTelemetry.models };
    result.providerUsage = { ...mergedOpsTelemetry.providers };

    // Update worker state
    const updates: Partial<{
      eventsOffset: number;
      toolCalls: number;
      turns: number;
      errors: number;
      lastEventAt: string;
      lastEventType: string;
      status: WorkerStatus;
      exitCode: number;
      completedAt: string;
      metadata: Record<string, unknown>;
    }> = {
      eventsOffset: newOffset,
      toolCalls: worker.toolCalls + processed.toolCalls,
      turns: worker.turns + processed.turns,
      errors: worker.errors + processed.errors,
      metadata: {
        ...workerMetadata,
        toolTiming: {
          pendingStarts: processed.pendingStarts,
          toolStats: mergedToolStats,
          slowTools: mergedSlowTools,
          toolFailures: mergedToolFailures,
        },
        opsTelemetry: {
          activeModel: mergedOpsTelemetry.activeModel,
          activeProvider: mergedOpsTelemetry.activeProvider,
          modelSwitches: mergedOpsTelemetry.modelSwitches,
          estimatedCostUsd: mergedOpsTelemetry.estimatedCostUsd,
          usageTotals: mergedOpsTelemetry.usageTotals,
          models: mergedOpsTelemetry.models,
          providers: mergedOpsTelemetry.providers,
        },
      },
    };

    if (processed.lastEventAt) updates.lastEventAt = processed.lastEventAt;
    if (processed.lastEventType) updates.lastEventType = processed.lastEventType;

    if (processed.terminalStatus) {
      updates.status = processed.terminalStatus;
      if (processed.exitCode !== null && processed.exitCode !== undefined) {
        updates.exitCode = processed.exitCode;
      }
      if (processed.lastEventAt) {
        updates.completedAt = processed.lastEventAt;
      }
    }

    updateWorker(this.db, id, updates);

    return result;
  }

  /**
   * Record a manual operator action and its result.
   */
  recordOperatorAction(opts: {
    workerId: string;
    actionType: OperatorAction['actionType'];
    status: OperatorAction['status'];
    requestedAt?: string;
    completedAt?: string;
    error?: string | null;
    metadata?: Record<string, unknown>;
  }): OperatorAction {
    return recordOperatorAction(this.db, opts);
  }

  /**
   * List recorded operator actions.
   */
  listOperatorActions(opts: {
    workerId?: string;
    actionType?: OperatorAction['actionType'];
    status?: OperatorAction['status'];
    limit?: number;
  } = {}): OperatorAction[] {
    return listOperatorActions(this.db, opts);
  }

  /**
   * Aggregate top-level operations summary for dashboard and API.
   */
  opsSummary(): OpsSummary {
    const workers = this.workerList();
    const workerHealth = workers.map((worker) => ({
      worker,
      health: detectHealth(worker.lastEventAt),
    }));
    const incidentWorkers = workerHealth.filter(({ worker, health }) =>
      health !== 'healthy' || worker.status === 'failed' || worker.status === 'lost' || worker.errors > 0,
    );
    const unresolvedRequests = this.read({ type: 'request', unresolved: true, limit: 1000 }).total;
    const usage = aggregateUsageAcrossWorkers(workers);
    const throughput = workers.reduce(
      (acc, worker) => {
        acc.turns += worker.turns;
        acc.toolCalls += worker.toolCalls;
        acc.errors += worker.errors;
        return acc;
      },
      { turns: 0, toolCalls: 0, errors: 0 },
    );
    return {
      generatedAt: new Date().toISOString(),
      workers: {
        total: workers.length,
        active: workers.filter((w) => w.status === 'active').length,
        healthy: workerHealth.filter((w) => w.health === 'healthy').length,
        stale: workerHealth.filter((w) => w.health === 'stale').length,
        lost: workerHealth.filter((w) => w.health === 'lost').length,
        failed: workers.filter((w) => w.status === 'failed').length,
        completed: workers.filter((w) => w.status === 'completed').length,
      },
      throughput: {
        turns: throughput.turns,
        toolCalls: throughput.toolCalls,
        errors: throughput.errors,
        toolErrorRate: throughput.toolCalls > 0 ? throughput.errors / throughput.toolCalls : 0,
      },
      usage: {
        ...usage.totals,
        estimatedCostUsd: usage.estimatedCostUsd,
        burnRateUsdPerHour: usage.burnRateUsdPerHour,
      },
      incidents: {
        workerIncidents: incidentWorkers.length,
        unresolvedRequests,
      },
      modelDistribution: usage.modelDistribution,
      providerDistribution: usage.providerDistribution,
    };
  }

  /**
   * Aggregate tool reliability and latency metrics.
   */
  opsTools(): OpsToolSummary[] {
    const totals: Record<string, { calls: number; totalMs: number; maxMs: number; slowCount: number; errorCount: number }> = {};
    for (const worker of this.workerList()) {
      const timing = parseToolTimingMetadata((worker.metadata ?? {}) as Record<string, unknown>);
      for (const [toolName, stats] of Object.entries(timing.toolStats)) {
        const current = totals[toolName] ?? { calls: 0, totalMs: 0, maxMs: 0, slowCount: 0, errorCount: 0 };
        current.calls += stats.count;
        current.totalMs += stats.totalMs;
        current.maxMs = Math.max(current.maxMs, stats.maxMs);
        current.slowCount += stats.slowCount;
        totals[toolName] = current;
      }
      for (const [toolName, failures] of Object.entries(timing.toolFailures)) {
        const current = totals[toolName] ?? { calls: 0, totalMs: 0, maxMs: 0, slowCount: 0, errorCount: 0 };
        current.errorCount += failures;
        totals[toolName] = current;
      }
    }

    return Object.entries(totals)
      .map(([toolName, stats]) => ({
        toolName,
        calls: stats.calls,
        avgMs: stats.calls > 0 ? Math.round(stats.totalMs / stats.calls) : 0,
        maxMs: stats.maxMs,
        slowCount: stats.slowCount,
        errorCount: stats.errorCount,
        errorRate: stats.calls > 0 ? stats.errorCount / stats.calls : 0,
      }))
      .sort((a, b) => b.errorRate - a.errorRate || b.calls - a.calls || a.toolName.localeCompare(b.toolName));
  }

  /**
   * Aggregate usage, model/provider breakdown, and top workers by spend.
   */
  opsUsage(): OpsUsage {
    const workers = this.workerList();
    const usage = aggregateUsageAcrossWorkers(workers);
    const topWorkers = workers
      .map((worker) => ({
        workerId: worker.id,
        channel: worker.channel,
        activeModel: worker.activeModel ?? null,
        activeProvider: worker.activeProvider ?? null,
        totalTokens: worker.usage?.totalTokens ?? 0,
        estimatedCostUsd: worker.estimatedCostUsd ?? 0,
      }))
      .sort((a, b) => b.estimatedCostUsd - a.estimatedCostUsd || b.totalTokens - a.totalTokens || a.workerId.localeCompare(b.workerId))
      .slice(0, 20);

    return {
      generatedAt: new Date().toISOString(),
      totals: {
        ...usage.totals,
        estimatedCostUsd: usage.estimatedCostUsd,
        burnRateUsdPerHour: usage.burnRateUsdPerHour,
      },
      byModel: usage.modelDistribution,
      byProvider: usage.providerDistribution,
      topWorkers,
    };
  }

  /**
   * Aggregate operator action outcomes.
   */
  opsActions(limit = 100): OpsActions {
    const actions = listOperatorActions(this.db, { limit });
    const summary = summarizeOperatorActions(this.db);
    const successRate = summary.total > 0 ? summary.succeeded / summary.total : 1;
    return {
      generatedAt: new Date().toISOString(),
      total: summary.total,
      successRate,
      byType: summary.byType,
      actions,
    };
  }

  /**
   * Worker-specific usage plus recent operator actions.
   */
  workerUsage(id: string): {
    workerId: string;
    activeModel: string | null;
    activeProvider: string | null;
    modelSwitches: number;
    estimatedCostUsd: number;
    burnRateUsdPerHour: number;
    usage: TokenUsageTotals;
    modelDistribution: ModelUsageSummary[];
    providerDistribution: ProviderUsageSummary[];
    actions: OperatorAction[];
  } | null {
    const worker = this.workerGet(id);
    if (!worker) return null;
    const modelDistribution = Object.values(worker.modelUsage ?? {})
      .sort((a, b) => b.totalTokens - a.totalTokens || b.costUsd - a.costUsd || a.model.localeCompare(b.model));
    const providerDistribution = Object.values(worker.providerUsage ?? {})
      .sort((a, b) => b.totalTokens - a.totalTokens || b.costUsd - a.costUsd || a.provider.localeCompare(b.provider));
    return {
      workerId: worker.id,
      activeModel: worker.activeModel ?? null,
      activeProvider: worker.activeProvider ?? null,
      modelSwitches: worker.modelSwitches ?? 0,
      estimatedCostUsd: worker.estimatedCostUsd ?? 0,
      burnRateUsdPerHour: calculateBurnRateUsdPerHour(worker),
      usage: worker.usage ? cloneUsageTotals(worker.usage) : { ...EMPTY_USAGE_TOTALS },
      modelDistribution,
      providerDistribution,
      actions: listOperatorActions(this.db, { workerId: worker.id, limit: 50 }),
    };
  }

  /**
   * Sync all active workers
   */
  workerSyncAll(): WorkerSyncResult[] {
    const workers = listWorkers(this.db, { status: 'active' });
    return workers.map(w => this.workerSync(w.id));
  }

  /**
   * Remove a worker
   */
  workerRemove(id: string): boolean {
    return removeWorker(this.db, id);
  }

  /**
   * Close the database connection
   */
  close(): void {
    this.db.close();
  }
}
