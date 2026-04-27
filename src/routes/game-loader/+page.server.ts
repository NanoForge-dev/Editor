import { fail } from '@sveltejs/kit';

import type { Save } from '$lib/loader/client/types/save.type';
import { getGameEnv } from '$lib/loader/server/env';

import { FileSystemError } from '@utils-server/file-system/file-system-error';
import {
  ProjectDirectory,
  directoryContentToFileEntries,
} from '@utils-server/file-system/project-directory';
import { ProjectFile } from '@utils-server/file-system/project-file';

import type { Actions } from './$types';

export const actions = {
  getManifest: async ({ request, locals }) => {
    const data = await request.json();

    if (!data.side) {
      return fail(403, { success: false, errorMsg: "Missing arg: 'side'" });
    }
    if (data.side !== 'server' && data.side !== 'client') {
      return fail(403, { success: false, errorMsg: "Arg 'side' can only be 'server' or 'client'" });
    }

    try {
      return {
        success: true,
        manifest: {
          files: directoryContentToFileEntries(
            new ProjectDirectory(`/.nanoforge/${data.side}/`, locals.session.data.path).read(true),
          ),
          version: '0.0.0',
        },
      };
    } catch (e: unknown) {
      if (e instanceof FileSystemError) {
        return fail(403, { success: false, errorMsg: e.message });
      }
      throw e;
    }
  },
  getSave: async ({ request, locals }) => {
    const data = await request.json();

    if (!data.side) {
      return fail(403, { success: false, errorMsg: "Missing arg: 'side'" });
    }
    if (data.side !== 'server' && data.side !== 'client') {
      return fail(403, { success: false, errorMsg: "Arg 'side' can only be 'server' or 'client'" });
    }

    try {
      return {
        success: true,
        save: new ProjectFile(
          `/.nanoforge/${data.side}.save.json`,
          locals.session.data.path,
        ).readJson<Save>(),
      };
    } catch (e: unknown) {
      if (e instanceof FileSystemError) {
        return fail(403, { success: false, errorMsg: e.message });
      }
      throw e;
    }
  },
  getBuildFile: async ({ request, locals }) => {
    const data = await request.json();

    if (!data.side) {
      return fail(403, { success: false, errorMsg: "Missing arg: 'side'" });
    }
    if (data.side !== 'server' && data.side !== 'client') {
      return fail(403, { success: false, errorMsg: "Arg 'side' can only be 'server' or 'client'" });
    }
    if (!data.filePath) {
      return fail(403, { success: false, errorMsg: "Missing arg: 'filePath'" });
    }

    try {
      return {
        success: true,
        fileContent: new ProjectFile(
          `/.nanoforge/${data.side}/${data.filePath}`,
          locals.session.data.path,
        ).read(data.encoding),
      };
    } catch (e: unknown) {
      if (e instanceof FileSystemError) {
        return fail(403, { success: false, errorMsg: e.message });
      }
      throw e;
    }
  },
  getEnv: async () => {
    return {
      success: true,
      env: getGameEnv(),
    };
  },
} satisfies Actions;
