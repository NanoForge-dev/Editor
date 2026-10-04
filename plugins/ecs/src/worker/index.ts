/**
 * Code worker entry (`entry.worker`): the `@nanoforge/ecs` item owner, and the entry file's
 * analyzer and transformer. `ts-morph` and the worker SDK come from the editor's worker.
 */
import { defineWorkerPlugin } from '@nanoforge-dev/editor-sdk/worker';

import {
  BUNDLE_SPAWNS_ANALYZER,
  ENTRY_ANALYZER,
  ENTRY_TRANSFORMER,
  IMPORTERS_ANALYZER,
  ITEM_DOCS_TRANSFORMER,
  RELOCATED_TEXT_ANALYZER,
  REWRITE_IMPORTS_TRANSFORMER,
} from '../model/ecs.const';
import { analyzeBundleSpawns } from './bundle-spawns';
import { analyzeEntry } from './entry-file';
import { transformItemDocs } from './item-docs';
import { ecsOwner } from './owner';
import { analyzeImporters, analyzeRelocatedText, transformRewriteImports } from './refactor';
import { transformEntry } from './transforms';

export default defineWorkerPlugin({
  activate(sdk) {
    sdk.registerItemOwner(ecsOwner);
    sdk.registerAnalyzer(ENTRY_ANALYZER, analyzeEntry);
    sdk.registerTransformer(ENTRY_TRANSFORMER, transformEntry);
    sdk.registerTransformer(ITEM_DOCS_TRANSFORMER, transformItemDocs);
    sdk.registerAnalyzer(IMPORTERS_ANALYZER, analyzeImporters);
    sdk.registerAnalyzer(RELOCATED_TEXT_ANALYZER, analyzeRelocatedText);
    sdk.registerTransformer(REWRITE_IMPORTS_TRANSFORMER, transformRewriteImports);
    sdk.registerAnalyzer(BUNDLE_SPAWNS_ANALYZER, analyzeBundleSpawns);
  },
});
