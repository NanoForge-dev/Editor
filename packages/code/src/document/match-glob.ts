import type { ExtensionRegistry } from '@nanoforge-dev/editor-kernel';

import { DOCUMENT_EDITORS } from './document-contributions';
import type { DocumentEditor } from './document.type';

/** `{a,b}` alternatives; a `,` or `}` outside braces is a plain character. */
const globToRegex = (glob: string): RegExp => {
  let source = '';
  let depth = 0;
  for (let i = 0; i < glob.length; i++) {
    const char = glob[i]!;
    if (char === '*' && glob[i + 1] === '*') {
      if (glob[i + 2] === '/') {
        source += '(?:.*/)?';
        i += 2;
      } else {
        source += '.*';
        i += 1;
      }
    } else if (char === '*') source += '[^/]*';
    else if (char === '?') source += '[^/]';
    else if (char === '{') {
      depth++;
      source += '(?:';
    } else if (char === '}' && depth) {
      depth--;
      source += ')';
    } else if (char === ',' && depth) source += '|';
    else source += /[.+^$()|[\]\\{}]/.test(char) ? `\\${char}` : char;
  }
  return new RegExp(`^${source}${')'.repeat(depth)}$`);
};

const globs = new Map<string, RegExp>();

/** Whether a project path matches a glob (`**\/*.{png,jpg}`, `src/*.ts`). */
export const matchesGlob = (pattern: string, path: string): boolean => {
  let regex = globs.get(pattern);
  if (!regex) globs.set(pattern, (regex = globToRegex(pattern)));
  return regex.test(path);
};

/** Editors able to open a file, best first. */
export const editorsFor = (
  extensions: Pick<ExtensionRegistry, 'getValues'>,
  uri: string,
): DocumentEditor[] =>
  extensions
    .getValues(DOCUMENT_EDITORS)
    .filter((editor) => matchesGlob(editor.pattern, uri))
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
