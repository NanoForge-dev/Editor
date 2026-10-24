import type { ItemOwner } from '@nanoforge-dev/editor-meta';

import type { CodeEngine } from './code-engine';
import type { Analyzer, Transformer } from './code-engine.type';
import { literalToValue, quoteStyle, readExportedLiteral, valueToLiteral } from './literals';

/**
 * What plugin worker entries (`entry.worker`) import as `@nanoforge-dev/editor-sdk/worker`.
 * Registrations are owned by the plugin and removed when it unloads.
 */
export interface WorkerSdk {
  readonly literals: {
    readonly literalToValue: typeof literalToValue;
    readonly valueToLiteral: typeof valueToLiteral;
    readonly readExportedLiteral: typeof readExportedLiteral;
    readonly quoteStyle: typeof quoteStyle;
  };
  registerAnalyzer(id: string, analyzer: Analyzer): () => void;
  registerTransformer(id: string, transformer: Transformer): () => void;
  /** Registers an owner of item data (ADR 0003): its tags, inference, claims and `extract`. */
  registerItemOwner(owner: ItemOwner): () => void;
}

export interface WorkerPluginModule {
  activate?(sdk: WorkerSdk): void | Promise<void>;
}

export const createWorkerSdk = (engine: CodeEngine, owner: string): WorkerSdk => ({
  registerAnalyzer: (id, analyzer) => engine.registerAnalyzer(id, analyzer, owner),
  registerTransformer: (id, transformer) => engine.registerTransformer(id, transformer, owner),
  registerItemOwner: (itemOwner) => engine.registerItemOwner(itemOwner, owner),
  literals: { literalToValue, valueToLiteral, readExportedLiteral, quoteStyle },
});
