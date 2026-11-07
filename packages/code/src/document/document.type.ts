import type { CommandOrigin, TextEdit } from '@nanoforge-dev/editor-history';
import type { Event, Observable } from '@nanoforge-dev/editor-kernel';

export interface DocumentChange {
  readonly uri: string;
  readonly edits: readonly TextEdit[];
  readonly origin: CommandOrigin | undefined;
}

/** A document opened by an editor (e.g. a Monaco model): the source of truth while open. */
export interface OpenDocument {
  readonly uri: string;
  readonly kind: 'text' | 'binary' | 'custom';
  readonly onDidChange: Event<DocumentChange>;
  readonly dirty: Observable<boolean>;
  /** Current content (text documents; custom documents serialize their model). */
  getText(): string;
  /** Applies edits and returns their inverse. */
  applyEdits(edits: readonly TextEdit[], origin: CommandOrigin | undefined): TextEdit[];
  save(): Promise<void>;
  revert(): Promise<void>;
}

/** Where documents are stored when they are not open. */
export interface DocumentBackend {
  readonly onDidChange: Event<readonly string[]>;
  read(uri: string): Promise<{ text: string; hash: string }>;
  write(uri: string, text: string, expectedHash: string | null): Promise<{ hash: string }>;
}

/** Which editor widget opens which files ("open with"). */
export interface DocumentEditor {
  /** Glob on project paths: `**\/*.ts`, `**\/*.{png,jpg}`. */
  readonly pattern: string;
  readonly widget: string;
  /**
   * Command opening a file in this editor (`command(path, options)`); declared in the plugin
   * manifest, running it activates the plugin. Without one, the widget is opened.
   */
  readonly command?: string;
  readonly title?: string;
  readonly priority?: number;
}

/** A JSON schema for files matching globs (completion and validation in the code editor). */
export interface JsonSchemaContribution {
  /** Globs on project paths, e.g. `.nanoforge/editor/settings.json`. */
  readonly fileMatch: readonly string[];
  /** The schema, or a function computing it when it is applied (e.g. from a registry). */
  readonly schema: object | (() => object);
}
