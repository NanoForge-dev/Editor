/* eslint-disable no-restricted-imports -- tests run the worker code against the real code engine */
import { describe, expect, it } from 'vitest';

import { CodeEngine } from '@nanoforge-dev/editor-code/engine';
import { applyTextEdits } from '@nanoforge-dev/editor-history';

import {
  analyzeImporters,
  analyzeRelocatedText,
  transformRewriteImports,
} from '../../src/worker/refactor';

const setup = () => {
  const engine = new CodeEngine();
  engine.registerAnalyzer('importers', analyzeImporters);
  engine.registerAnalyzer('relocated', analyzeRelocatedText);
  engine.registerTransformer('rewrite', transformRewriteImports);
  engine.setTsconfig(
    '{ "compilerOptions": { "paths": { "@pong/shared/*": ["./libs/shared/src/*"] } } }',
  );
  engine.setFiles([
    {
      path: 'apps/client/src/components/health.ts',
      text: 'import { max } from "../config";\nexport class Health { name = "Health"; constructor(public points = max) {} }\n',
    },
    { path: 'apps/client/src/config.ts', text: 'export const max = 3;\n' },
    {
      path: 'apps/client/src/main.ts',
      text: 'import { Health } from "./components/health";\nnew Health();\n',
    },
    {
      path: 'apps/client/src/systems/regen.ts',
      text: "import type { Health } from '../components/health';\nexport const regen = (h: Health) => h;\n",
    },
  ]);
  return engine;
};

describe('move to shared library', () => {
  it('finds the importers, relocates the file and rewrites their imports', () => {
    const engine = setup();
    const from = 'apps/client/src/components/health.ts';
    const to = 'libs/shared/src/components/health.ts';
    expect(engine.analyze(from, 'importers')).toEqual([
      'apps/client/src/main.ts',
      'apps/client/src/systems/regen.ts',
    ]);
    expect(engine.analyze(from, 'relocated', { to })).toMatchObject({
      imports: ['apps/client/src/config.ts'],
    });
    expect((engine.analyze(from, 'relocated', { to }) as { text: string }).text).toContain(
      'import { max } from "../../../../apps/client/src/config";',
    );
    const main = 'apps/client/src/main.ts';
    const { text } = applyTextEdits(
      engine.text(main)!,
      engine.transform(main, 'rewrite', { from, to }),
    );
    expect(text).toBe('import { Health } from "@pong/shared/components/health";\nnew Health();\n');
    const regen = 'apps/client/src/systems/regen.ts';
    expect(
      applyTextEdits(engine.text(regen)!, engine.transform(regen, 'rewrite', { from, to })).text,
    ).toContain("import type { Health } from '@pong/shared/components/health';");
  });
});
