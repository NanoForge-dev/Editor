/**
 * Code worker entry (`entry.worker`): the analyzers and transformers of scenes, `main.ts`'s
 * `SceneLibrary` and the scene vars. `ts-morph` and the worker SDK come from the editor's worker.
 */
import { defineWorkerPlugin } from '@nanoforge-dev/editor-sdk/worker';

import {
  CLASSES_ANALYZER,
  LIBRARY_TRANSFORMER,
  REFERENCES_ANALYZER,
  REPLACE_TRANSFORMER,
  SCENES_ANALYZER,
  SCENE_FILE_TRANSFORMER,
  VARS_ANALYZER,
  VARS_TRANSFORMER,
} from '../model/scene.const';
import {
  analyzeClasses,
  analyzeReferences,
  transformLibrary,
  transformReplace,
  transformSceneFile,
} from './edits';
import { analyzeScenes } from './scenes';
import { analyzeVars, transformVars } from './vars';

export default defineWorkerPlugin({
  activate(sdk) {
    sdk.registerAnalyzer(SCENES_ANALYZER, analyzeScenes);
    sdk.registerAnalyzer(REFERENCES_ANALYZER, analyzeReferences);
    sdk.registerAnalyzer(CLASSES_ANALYZER, analyzeClasses);
    sdk.registerTransformer(LIBRARY_TRANSFORMER, transformLibrary);
    sdk.registerTransformer(SCENE_FILE_TRANSFORMER, transformSceneFile);
    sdk.registerTransformer(REPLACE_TRANSFORMER, transformReplace);
    sdk.registerAnalyzer(VARS_ANALYZER, analyzeVars);
    sdk.registerTransformer(VARS_TRANSFORMER, transformVars);
  },
});
