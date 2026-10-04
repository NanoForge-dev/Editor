import { RUNTIME_PROTOCOL_VERSION } from '@nanoforge-dev/editor-protocol';

import type { GameCompatibility } from './game-compatibility.type';

const ADD_LIBRARY =
  'Register the editor library in its main.ts: app.use(new EditorLibrary()), from @nanoforge-dev/editor-lib (NanoForge engine 2.0 and later).';
const UPDATE_ENGINE =
  'Update the NanoForge engine packages of the project (@nanoforge-dev/core and the other @nanoforge-dev libraries).';

/** Compares the `hello` of a game (undefined when it never said hello) with the editor. */
export const checkCompatibility = (
  source: 'client' | 'server',
  app: string,
  hello: { protocolVersion?: number } | undefined,
  editorVersion = RUNTIME_PROTOCOL_VERSION,
): GameCompatibility => {
  const side = source === 'client' ? 'game client' : 'game server';
  if (!hello) {
    return {
      source,
      app,
      status: 'legacy',
      message: `The ${side} has no editor bridge: Pause, Step and the live views are unavailable${source === 'client' ? ", and Stop can't end it (it keeps running until Run › Reload editor runtime)" : ''}. ${ADD_LIBRARY}`,
    };
  }
  const version = hello.protocolVersion ?? 0;
  if (version === editorVersion) return { source, app, status: 'ok', protocolVersion: version };
  return version < editorVersion
    ? {
        source,
        app,
        status: 'older',
        protocolVersion: version,
        message: `The ${side} speaks editor protocol ${version}, older than this editor (${editorVersion}): some editor features may not work. ${UPDATE_ENGINE}`,
      }
    : {
        source,
        app,
        status: 'newer',
        protocolVersion: version,
        message: `The ${side} speaks editor protocol ${version}, newer than this editor (${editorVersion}): update the NanoForge editor.`,
      };
};
