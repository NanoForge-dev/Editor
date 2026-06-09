import type * as Monaco from 'monaco-editor';
import { Uri } from 'monaco-editor';

import { type SfsDirectory } from '$lib/client/sync-file-system';
import type { DirectoryContent } from '$lib/server/file-system/project-directory';

export function pathToUri(path: string) {
  const clean = normalizePath(path);
  return Uri.parse(`file:///${clean}`);
}

export function normalizePath(path: string) {
  return path.replace(/\\/g, '/').replace(/\/+/g, '/').replace(/^\/+/, '');
}

function joinPath(base: string, name: string) {
  return normalizePath(base ? `${base}/${name}` : name);
}

export async function loadMonacoProject(monaco: typeof Monaco, fsRoot: SfsDirectory) {
  const rootContent = await fsRoot.readdir(true);

  async function loadDirectory(dir: SfsDirectory, content: DirectoryContent, basePath: string) {
    for (const fileName of content.files) {
      const fullPath = joinPath(basePath, fileName);
      if (!/\.(ts|js|tsx|jsx)$/.test(fileName)) continue;

      const file = await dir.getFile(fileName);
      const text = (await file.read()) ?? '';

      const uri = pathToUri(fullPath);

      let model = monaco.editor.getModel(uri);

      if (!model) {
        model = monaco.editor.createModel(text, 'typescript', uri);
      } else {
        model.setValue(text);
      }
    }

    for (const [dirName, subContent] of Object.entries(content.directories)) {
      if (!subContent) continue;

      const subDir = await dir.getDirectory(dirName);
      await loadDirectory(subDir, subContent, joinPath(basePath, dirName));
    }
  }

  await loadDirectory(fsRoot, rootContent, '');
}
