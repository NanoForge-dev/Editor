import { fail } from '@sveltejs/kit';
import * as fs from 'node:fs';
import * as path from 'node:path';

import type { Actions } from './$types';

function checkPathIsInsideDir(filePath: string, projectPath: string) {
  if (!filePath.startsWith(projectPath)) {
    throw `Path ${filePath} outside of directory`;
  }
}

function checkPathExists(filePath: string) {
  if (!fs.existsSync(filePath)) {
    throw `Path ${filePath} should exist`;
  }
}

function checkPathNotExists(filePath: string) {
  if (fs.existsSync(filePath)) {
    throw `Path ${filePath} should not exist`;
  }
}

function checkPathIsFile(filePath: string) {
  let stats: fs.Stats;
  try {
    stats = fs.lstatSync(filePath);
  } catch {
    throw `Path ${filePath} does not exist`;
  }
  if (!stats.isFile()) {
    throw `Path ${filePath} is not a file`;
  }
}

function checkPathIsDir(filePath: string) {
  let stats: fs.Stats;
  try {
    stats = fs.lstatSync(filePath);
  } catch {
    throw `Path ${filePath} does not exist`;
  }
  if (!stats.isDirectory()) {
    throw `Path ${filePath} is not a directory`;
  }
}

function checkPathIsWritable(filePath: string) {
  try {
    fs.accessSync(filePath, fs.constants.W_OK);
  } catch {
    throw `Path ${filePath} writable`;
  }
}

function checkPathIsReadable(filePath: string) {
  try {
    fs.accessSync(filePath, fs.constants.R_OK);
  } catch {
    throw `Path ${filePath} writable`;
  }
}

function readDirContent(
  absoluteDirPath: string,
  recursive: boolean,
): { files: string[]; directories: {} } {
  const dirContent: { files: string[]; directories: { [key: string]: any } } = {
    files: [],
    directories: {},
  };
  fs.readdirSync(absoluteDirPath, { withFileTypes: true, recursive: false }).forEach((item) => {
    if (item.isFile()) {
      dirContent.files.push(item.name);
    } else if (item.isDirectory()) {
      dirContent.directories[item.name] = recursive
        ? readDirContent(absoluteDirPath + '/' + item.name, recursive)
        : {};
    }
  });
  return dirContent;
}

export const actions = {
  readFile: async ({ request, locals }) => {
    const data = await request.json();

    if (!data.filePath) {
      return fail(403, { success: false, errorMsg: "Missing arg: 'filePath'" });
    }

    try {
      const absoluteFilePath = path.resolve(locals.session.data.path, './' + data.filePath);
      checkPathIsInsideDir(absoluteFilePath, locals.session.data.path);
      checkPathExists(absoluteFilePath);
      checkPathIsFile(absoluteFilePath);
      checkPathIsReadable(absoluteFilePath);
      return { success: true, fileContent: fs.readFileSync(absoluteFilePath).toString() };
    } catch (e) {
      return fail(403, { success: false, errorMsg: e });
    }
  },
  readDir: async ({ request, locals }) => {
    const data = await request.json();

    let dirPath = '/';
    if (data.dirPath) {
      dirPath = data.dirPath;
    }

    try {
      const absoluteDirPath = path.resolve(locals.session.data.path, './' + dirPath);
      checkPathIsInsideDir(absoluteDirPath, locals.session.data.path);
      checkPathExists(absoluteDirPath);
      checkPathIsDir(absoluteDirPath);
      const dirContent = readDirContent(absoluteDirPath, false);
      return {
        success: true,
        dirContent,
      };
    } catch (e) {
      return fail(403, { success: false, errorMsg: e });
    }
  },

  readDirRec: async ({ request, locals }) => {
    const data = await request.json();

    let dirPath = '/';
    if (data.dirPath) {
      dirPath = data.dirPath;
    }

    try {
      const absoluteDirPath = path.resolve(locals.session.data.path, './' + dirPath);
      checkPathIsInsideDir(absoluteDirPath, locals.session.data.path);
      checkPathExists(absoluteDirPath);
      checkPathIsDir(absoluteDirPath);
      const dirContent = readDirContent(absoluteDirPath, true);
      return { success: true, dirContent };
    } catch (e) {
      return fail(403, { success: false, errorMsg: e });
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
      const absoluteFilePath = path.resolve(locals.session.data.path, './' + data.filePath);
      checkPathIsInsideDir(absoluteFilePath, locals.session.data.path);
      if (fs.existsSync(absoluteFilePath)) {
        checkPathIsFile(absoluteFilePath);
        checkPathIsWritable(absoluteFilePath);
      } else {
        const folderPath = path.dirname(absoluteFilePath);
        checkPathIsWritable(folderPath);
      }
      fs.writeFileSync(absoluteFilePath, data.fileContent, { flush: true });
    } catch (e) {
      return fail(403, { success: false, errorMsg: e });
    }
    return { success: true };
  },

  deleteFile: async ({ request, locals }) => {
    const data = await request.json();

    if (!data.filePath) {
      return fail(403, { success: false, errorMsg: "Missing arg: 'filePath'" });
    }

    try {
      const absoluteFilePath = path.resolve(locals.session.data.path, './' + data.filePath);
      checkPathIsInsideDir(absoluteFilePath, locals.session.data.path);
      checkPathExists(absoluteFilePath);
      checkPathIsFile(absoluteFilePath);
      checkPathIsWritable(absoluteFilePath);
      fs.rmSync(absoluteFilePath);
    } catch (e) {
      return fail(403, { success: false, errorMsg: e });
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
      const absoluteFilePath = path.resolve(locals.session.data.path, './' + data.filePath);
      const absoluteNewFilePath = path.resolve(locals.session.data.path, './' + data.newFilePath);
      checkPathIsInsideDir(absoluteFilePath, locals.session.data.path);
      checkPathIsInsideDir(absoluteNewFilePath, locals.session.data.path);
      checkPathExists(absoluteFilePath);
      checkPathIsFile(absoluteFilePath);
      checkPathIsWritable(absoluteFilePath);
      const newFolderPath = path.dirname(absoluteNewFilePath);
      checkPathExists(newFolderPath);
      checkPathIsWritable(newFolderPath);
      checkPathNotExists(absoluteNewFilePath);
      fs.renameSync(absoluteFilePath, absoluteNewFilePath);
    } catch (e) {
      return fail(403, { success: false, errorMsg: e });
    }
    return { success: true };
  },

  createDir: async ({ request, locals }) => {
    const data = await request.json();

    if (!data.dirPath) {
      return fail(403, { success: false, errorMsg: "Missing arg: 'dirPath'" });
    }

    try {
      const absoluteFilePath = path.resolve(locals.session.data.path, './' + data.dirPath);
      checkPathIsInsideDir(absoluteFilePath, locals.session.data.path);
      checkPathNotExists(absoluteFilePath);

      fs.mkdirSync(absoluteFilePath, { recursive: true });
    } catch (e) {
      return fail(403, { success: false, errorMsg: e });
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
      const absoluteDirPath = path.resolve(locals.session.data.path, './' + data.dirPath);
      const absoluteNewDirPath = path.resolve(locals.session.data.path, './' + data.newDirPath);
      checkPathIsInsideDir(absoluteDirPath, locals.session.data.path);
      checkPathIsInsideDir(absoluteNewDirPath, locals.session.data.path);
      checkPathExists(absoluteDirPath);
      checkPathIsDir(absoluteDirPath);
      checkPathIsWritable(absoluteDirPath);
      const newFolderPath = path.dirname(absoluteNewDirPath);
      checkPathExists(newFolderPath);
      checkPathIsWritable(newFolderPath);
      checkPathNotExists(absoluteNewDirPath);
      fs.renameSync(absoluteDirPath, absoluteNewDirPath);
    } catch (e) {
      return fail(403, { success: false, errorMsg: e });
    }
    return { success: true };
  },
} satisfies Actions;
