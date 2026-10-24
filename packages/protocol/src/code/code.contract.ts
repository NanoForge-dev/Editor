import { z } from 'zod';

import { defineContract } from '@nanoforge-dev/editor-rpc';

import { ProjectPath } from '../path/project-path';
import { ProjectId } from '../project/project.schema';

export const CodeContract = defineContract('code', {
  methods: {
    /**
     * Type declarations of a package as resolved from a file (node_modules lookup):
     * its package.json and `.d.ts` files, with project-relative paths.
     */
    typeFiles: {
      input: z.object({
        project: ProjectId,
        from: ProjectPath,
        module: z.string().regex(/^(@[\w.-]+\/)?[\w.-]+$/, 'package name'),
      }),
      output: z.array(z.object({ path: ProjectPath, text: z.string() })),
    },
    /**
     * Formats a file's text with Prettier: the project's own Prettier, config and plugins on
     * local editors; the bundled Prettier and the project's JSON/YAML config on hosted ones.
     * `formatter` is `none` when the file is ignored or unsupported (text unchanged).
     */
    format: {
      input: z.object({ project: ProjectId, path: ProjectPath, text: z.string() }),
      output: z.object({ text: z.string(), formatter: z.enum(['project', 'bundled', 'none']) }),
    },
  },
});
