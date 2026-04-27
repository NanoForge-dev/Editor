import { type Writable, writable } from 'svelte/store';

import type { FileSystemDirectory } from '@utils-client/file-system';

export const CurrentDirectory: Writable<FileSystemDirectory> = writable();
