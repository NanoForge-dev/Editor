import { fail } from '@sveltejs/kit';

import { FileSystemError } from '$lib/server/file-system/file-system-error';
import { ProjectDirectory } from '$lib/server/file-system/project-directory';
import { ProjectFile } from '$lib/server/file-system/project-file';

import type { Actions } from './$types';

export const actions = {
  readFile: async ({ request, locals }) => {
    const data = await request.json();

    if (!data.filePath) {
      return fail(403, { success: false, errorMsg: "Missing arg: 'filePath'" });
    }

    try {
      return {
        success: true,
        fileContent: new ProjectFile(data.filePath, locals.session.data.path).read(),
      };
    } catch (e: unknown) {
      if (e instanceof FileSystemError) {
        return fail(403, { success: false, errorMsg: e.message });
      }
      throw e;
    }
  },
  readDir: async ({ request, locals }) => {
    const data = await request.json();

    try {
      return {
        success: true,
        dirContent: new ProjectDirectory(
          data.dirPath ? data.dirPath : '/',
          locals.session.data.path,
        ).read(),
      };
    } catch (e: unknown) {
      if (e instanceof FileSystemError) {
        return fail(403, { success: false, errorMsg: e.message });
      }
      throw e;
    }
  },
  readDirRec: async ({ request, locals }) => {
    const data = await request.json();

    try {
      return {
        success: true,
        dirContent: new ProjectDirectory(
          data.dirPath ? data.dirPath : '/',
          locals.session.data.path,
        ).read(true),
      };
    } catch (e: unknown) {
      if (e instanceof FileSystemError) {
        return fail(403, { success: false, errorMsg: e.message });
      }
      throw e;
    }
  },
  writeFile: async ({ request, locals }) => {
    const data = await request.json();

    if (!data.filePath) {
      return fail(403, { success: false, errorMsg: "Missing arg: 'filePath'" });
    }
    if (!data.fileContent) {
      return fail(403, { success: false, errorMsg: "Missing arg: 'fileContent'" });
    }

    try {
      new ProjectFile(data.filePath, locals.session.data.path).write(data.fileContent);
    } catch (e: unknown) {
      if (e instanceof FileSystemError) {
        return fail(403, { success: false, errorMsg: e.message });
      }
      throw e;
    }
    return { success: true };
  },

  deleteFile: async ({ request, locals }) => {
    const data = await request.json();

    if (!data.filePath) {
      return fail(403, { success: false, errorMsg: "Missing arg: 'filePath'" });
    }

    try {
      new ProjectFile(data.filePath, locals.session.data.path).delete();
    } catch (e: unknown) {
      if (e instanceof FileSystemError) {
        return fail(403, { success: false, errorMsg: e.message });
      }
      throw e;
    }
    return { success: true };
  },

  renameFile: async ({ request, locals }) => {
    const data = await request.json();

    if (!data.filePath) {
      return fail(403, { success: false, errorMsg: "Missing arg: 'filePath'" });
    }
    if (!data.newFilePath) {
      return fail(403, { success: false, errorMsg: "Missing arg: 'newFilePath'" });
    }

    try {
      new ProjectFile(data.filePath, locals.session.data.path).rename(data.newFilePath);
    } catch (e: unknown) {
      if (e instanceof FileSystemError) {
        return fail(403, { success: false, errorMsg: e.message });
      }
      throw e;
    }
    return { success: true };
  },

  createDir: async ({ request, locals }) => {
    const data = await request.json();

    if (!data.dirPath) {
      return fail(403, { success: false, errorMsg: "Missing arg: 'dirPath'" });
    }

    try {
      new ProjectDirectory(data.dirPath, locals.session.data.path).create();
    } catch (e: unknown) {
      if (e instanceof FileSystemError) {
        return fail(403, { success: false, errorMsg: e.message });
      }
      throw e;
    }
    return { success: true };
  },

  renameDir: async ({ request, locals }) => {
    const data = await request.json();

    if (!data.dirPath) {
      return fail(403, { success: false, errorMsg: "Missing arg: 'dirPath'" });
    }
    if (!data.newDirPath) {
      return fail(403, { success: false, errorMsg: "Missing arg: 'newDirPath'" });
    }

    try {
      new ProjectDirectory(data.dirPath, locals.session.data.path).rename(data.newDirPath);
    } catch (e: unknown) {
      if (e instanceof FileSystemError) {
        return fail(403, { success: false, errorMsg: e.message });
      }
      throw e;
    }
    return { success: true };
  },
  deleteDir: async ({ request, locals }) => {
    const data = await request.json();

    if (!data.dirPath) {
      return fail(403, { success: false, errorMsg: "Missing arg: 'dirPath'" });
    }

    try {
      new ProjectDirectory(data.dirPath, locals.session.data.path).delete(data.recursive === true);
    } catch (e: unknown) {
      if (e instanceof FileSystemError) {
        return fail(403, { success: false, errorMsg: e.message });
      }
      throw e;
    }
    return { success: true };
  },
} satisfies Actions;
