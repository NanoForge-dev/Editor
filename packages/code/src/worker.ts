/// <reference lib="webworker" />
/**
 * Entry of the code worker. Plugin worker entries share this worker's ts-morph and the worker
 * sdk helpers through the shared module registry (like the Svelte runtime on the main thread).
 */
import * as tsMorph from 'ts-morph';

import { SharedModuleRegistry } from '@nanoforge-dev/editor-kernel';
import * as meta from '@nanoforge-dev/editor-meta';

import { CodeError } from './engine/code.exception';
import { EditBuilder } from './engine/edit-builder';
import { literalToValue, quoteStyle, readExportedLiteral, valueToLiteral } from './engine/literals';
import { serveEngine } from './worker-rpc/serve-engine';
import type { MessageEndpoint } from './worker-rpc/worker-rpc';

new SharedModuleRegistry()
  .register('ts-morph', tsMorph)
  .register('@nanoforge-dev/editor-sdk/worker', {
    defineWorkerPlugin: <T>(plugin: T) => plugin,
    CodeError,
    EditBuilder,
    docOf: meta.docOf,
    parseDocComment: meta.parseDocComment,
    firstTag: meta.firstTag,
    hasTag: meta.hasTag,
    leadingDocComments: meta.leadingDocComments,
    tagTexts: meta.tagTexts,
    literalToValue,
    valueToLiteral,
    readExportedLiteral,
    quoteStyle,
  })
  .install(globalThis);

serveEngine(self as unknown as MessageEndpoint);
