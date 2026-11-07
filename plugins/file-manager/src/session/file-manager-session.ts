import { ObservableValue } from '@nanoforge-dev/editor-sdk';

import type { FileManagerService } from '../service/file-manager-service';

/** Service of the open project (undefined without one), shared with the widget. */
export const current = new ObservableValue<FileManagerService | undefined>(undefined);
