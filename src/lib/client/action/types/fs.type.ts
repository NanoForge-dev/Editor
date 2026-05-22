import type { ReaddirFsBody } from '$lib/server/actions/project/fs/readdir.action';
import type { DirectoryContent } from '$lib/server/file-system/project-directory';

export type ReaddirFsActionInput = ReaddirFsBody;

export type ReaddirFsActionResult = DirectoryContent;
