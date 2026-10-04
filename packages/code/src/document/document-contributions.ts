import { z } from 'zod';

import { defineExtensionPoint } from '@nanoforge-dev/editor-kernel';

import type { DocumentEditor, JsonSchemaContribution } from './document.type';

export const DocumentEditorSchema = z.object({
  pattern: z.string().min(1),
  widget: z.string().min(1),
  command: z.string().min(1).optional(),
  title: z.string().optional(),
  priority: z.number().optional(),
});

export const DOCUMENT_EDITORS = defineExtensionPoint<DocumentEditor>('code.documentEditors');

export const JSON_SCHEMAS = defineExtensionPoint<JsonSchemaContribution>('code.jsonSchemas');

/** Serialized type of document edit commands. */
export const DOCUMENT_EDITS = 'document.edits';
