import { fail } from '@sveltejs/kit';
import * as fs from 'node:fs';
import * as path from 'node:path';

import type { Actions } from './$types';

export const actions = {
  saveFile: async (event) => {
    const data = await event.request.json();

    const token = event.cookies.get('token'); // TODO choose token cookie name

    // TODO check token
    if (token === undefined || token.length === 0) {
      return fail(403, { success: false, errorMsg: 'Unauthorized access!' });
    }
    const projectId: number = data.project; // TODO choose how project id is passed

    // TODO check user is allow to modify project
    // TODO resolve project path from projectId

    const projectPath = '/tmp/example/' + projectId;

    const filename = data.filename;
    const filePath = path.resolve(projectPath, filename);
    if (!filePath.startsWith(projectPath)) {
      return fail(403, { success: false, errorMsg: 'Unauthorized access!' });
    }

    fs.writeFileSync(filePath, data.fileContent);
    return { success: true };
  },
} satisfies Actions;
