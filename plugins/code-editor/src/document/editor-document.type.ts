import type { DocumentBackend } from '@nanoforge-dev/editor-sdk';

import type { Monaco } from '../monaco/monaco';
import { type EditorDocument } from './editor-document';
import type { UnsavedStore } from './unsaved-store';

/** The file changed on disk while the document had unsaved edits (`diskText` null: deleted). */
export interface Conflict {
  readonly diskText: string | null;
  readonly diskHash: string | null;
}

export interface DocumentHost {
  readonly monaco: Monaco;
  readonly backend: DocumentBackend;
  readonly unsaved: UnsavedStore;
  /** Actions on save (format, organize imports), run before writing. */
  beforeSave(document: EditorDocument): Promise<void>;
}
