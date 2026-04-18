import type { FileSystemDirectory } from '@utils-client/file-system';
import { type Writable, writable } from 'svelte/store';

export const CurrentDirectory: Writable<FileSystemDirectory> = writable();
