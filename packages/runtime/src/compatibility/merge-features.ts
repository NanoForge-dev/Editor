import type { EngineFeatures } from '@nanoforge-dev/editor-protocol';

/**
 * Merges the engine features requested by the editor and plugins: the shortest frame stats
 * interval, logs if anyone wants them, the highest network trace rates and payload size, the
 * shortest live world and scenes intervals.
 */
export const mergeFeatures = (requests: readonly EngineFeatures[]): EngineFeatures => {
  const merged: EngineFeatures = {};
  for (const request of requests) {
    if (request.frameStats) {
      merged.frameStats = {
        intervalMs: Math.min(
          merged.frameStats?.intervalMs ?? Infinity,
          request.frameStats.intervalMs,
        ),
      };
    }
    if (request.logs) merged.logs = true;
    if (request.viewport) merged.viewport = true;
    if (request.ecsWorld) {
      merged.ecsWorld = {
        intervalMs: Math.min(merged.ecsWorld?.intervalMs ?? Infinity, request.ecsWorld.intervalMs),
      };
    }
    if (request.scenes) {
      merged.scenes = {
        intervalMs: Math.min(merged.scenes?.intervalMs ?? Infinity, request.scenes.intervalMs),
      };
    }
    if (request.ecsSystemStats) {
      merged.ecsSystemStats = {
        intervalMs: Math.min(
          merged.ecsSystemStats?.intervalMs ?? Infinity,
          request.ecsSystemStats.intervalMs,
        ),
      };
    }
    if (request.networkTrace) {
      const current = merged.networkTrace ?? {};
      merged.networkTrace = {
        sampleRate: Math.max(current.sampleRate ?? 0, request.networkTrace.sampleRate ?? 1),
        maxPerSecond: Math.max(current.maxPerSecond ?? 0, request.networkTrace.maxPerSecond ?? 100),
        ...((current.maxBytes ?? request.networkTrace.maxBytes) !== undefined && {
          maxBytes: Math.max(current.maxBytes ?? 0, request.networkTrace.maxBytes ?? 0),
        }),
      };
    }
  }
  return merged;
};
