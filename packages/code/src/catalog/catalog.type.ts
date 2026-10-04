import type { Logger, PluginHost } from '@nanoforge-dev/editor-kernel';
import type { MetaDiagnostic } from '@nanoforge-dev/editor-meta';
import type { ItemMeta, ItemRef, MetaSource } from '@nanoforge-dev/editor-meta/pure';
import type { ClientProject } from '@nanoforge-dev/editor-project';

import type { DocumentService } from '../document/document-service';
import type { CodeService } from '../service/code-service';

/** An item of the catalog: its metadata and where it comes from. */
export interface CatalogItem {
  readonly ref: ItemRef;
  readonly source: MetaSource;
  readonly meta: ItemMeta;
  /** Items of installed packages can't be changed. */
  readonly readonly: boolean;
}

export interface CatalogState {
  readonly items: readonly CatalogItem[];
  readonly diagnostics: readonly MetaDiagnostic[];
  /** True until the first extraction of every source is done. */
  readonly loading: boolean;
}

export interface CatalogOptions {
  readonly project: ClientProject;
  readonly code: CodeService;
  readonly documents: DocumentService;
  readonly plugins?: PluginHost;
  readonly logger?: Logger;
  /** Delay before extracting again after a change. */
  readonly delayMs?: number;
}
