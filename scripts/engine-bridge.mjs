import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';

const speaks = (file) =>
  existsSync(file) && readFileSync(file, 'utf8').includes('EDITOR_PROTOCOL_VERSION');

/**
 * How an engine checkout speaks the editor bridge:
 * - `library`: engine 2.0 and later. The bridge is `@nanoforge-dev/editor-lib`
 *   (`modules/editor`), and a game registers its `EditorLibrary`;
 * - `core`: earlier bridge branches, where core handled it for every game;
 * - `undefined`: no bridge (or the engine is not built).
 */
export const bridgeOf = (engine) => {
  if (speaks(join(engine, 'modules/editor/dist/index.js'))) return 'library';
  if (speaks(join(engine, 'packages/common/dist/index.js'))) return 'core';
  return undefined;
};

/** Links `@nanoforge-dev/editor-lib` of the engine into the `node_modules` of a game's app. */
export const linkEditorLibrary = (engine, app) => {
  const link = join(app, 'node_modules/@nanoforge-dev/editor-lib');
  mkdirSync(dirname(link), { recursive: true });
  rmSync(link, { recursive: true, force: true });
  symlinkSync(join(engine, 'modules/editor'), link);
};

/**
 * Registers `EditorLibrary` in a game's `main.ts`, after its last `app.use(...)`. A game that
 * already has it is left as it is.
 */
export const useEditorLibrary = (main) => {
  const text = readFileSync(main, 'utf8');
  if (text.includes('EditorLibrary')) return;
  const uses = [...text.matchAll(/^([ \t]*)app\.use\(.*\);[ \t]*$/gm)];
  const last = uses.at(-1);
  if (!last) throw new Error(`${main} registers no library: cannot add the editor library`);
  const end = last.index + last[0].length;
  writeFileSync(
    main,
    `import { EditorLibrary } from "@nanoforge-dev/editor-lib";\n${text.slice(0, end)}\n${last[1]}app.use(new EditorLibrary());${text.slice(end)}`,
  );
};

/**
 * Gives a game folder the `node_modules` of a folder of the engine's examples: a copy made of
 * links (scopes and `.bin` are real folders of links), so the game resolves the engine's builds.
 */
export const linkNodeModules = (from, to) => {
  rmSync(to, { recursive: true, force: true });
  const copy = (dir, target) => {
    mkdirSync(target, { recursive: true });
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === '.vite' || entry.name === '.unrun') continue;
      const path = join(dir, entry.name);
      if (lstatSync(path).isDirectory()) copy(path, join(target, entry.name));
      else symlinkSync(realpathSync(path), join(target, entry.name));
    }
  };
  copy(from, to);
};

/** Links engine modules (`modules/<name>`) into the `node_modules` of a game's app. */
export const linkEngineModules = (engine, app, modules) => {
  for (const module of modules) {
    const target = join(app, 'node_modules/@nanoforge-dev', module);
    mkdirSync(dirname(target), { recursive: true });
    rmSync(target, { recursive: true, force: true });
    symlinkSync(join(engine, 'modules', module), target);
  }
};
