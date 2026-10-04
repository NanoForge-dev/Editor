import { ObservableValue } from '@nanoforge-dev/editor-sdk';

import type { Monaco } from '../monaco/monaco';
import type { CodeEditorService } from '../service/code-editor-service';

/** Service of the open project (undefined without one), shared with the widgets. */
export const current = new ObservableValue<
  { service: CodeEditorService; monaco: Monaco } | undefined
>(undefined);
