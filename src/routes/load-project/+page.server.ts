import { fail } from '@sveltejs/kit';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { env } from '$env/dynamic/private';

import { authGuard } from '@utils-server/server-api';

export const actions = {
  loadProject: async ({ request, locals, cookies }) => {
    const data = await request.json();

    const projectPath = data.projectPath;
    const projectId = data.projectId;
    let absoluteProjectPath: string = '';
    if (projectPath) {
      if (env.API_URL) {
        return fail(403, {
          success: false,
          errorMsg: 'Cannot load local project if API_URL is present',
        });
      }
      absoluteProjectPath = projectPath;
    } else if (projectId) {
      if (!env.API_URL) {
        return fail(403, { success: false, errorMsg: 'Missing API_URL' });
      }

      const serverProjectPath = await authGuard(async (httpClient) => {
        return await httpClient.post(`${env.API_URL}/editor/projects/${projectId}`);
      }, cookies);
      if (serverProjectPath.status !== 200) {
        return fail(403, { success: false, errorMsg: 'Cannot retrieve project from API' });
      }
      absoluteProjectPath = (await serverProjectPath.json())['projectPath'];
    } else {
      return fail(403, {
        success: false,
        creationPanel: env.API_URL ? 'api' : 'local',
        errorMsg: `No project provided: ${
          env.API_URL
            ? 'Go back to the NanoForge project manager to access a project'
            : 'Select or create a local project'
        }`,
      });
    }

    try {
      const stats = fs.lstatSync(absoluteProjectPath);
      if (!stats.isDirectory()) {
        return fail(403, {
          success: false,
          errorMsg: `Project folder ${projectPath} is not a folder`,
        });
      }
    } catch {
      return fail(403, {
        success: false,
        errorMsg: `Project folder ${projectPath} does not exist`,
      });
    }
    try {
      fs.accessSync(absoluteProjectPath, fs.constants.W_OK);
    } catch {
      return fail(403, {
        success: false,
        errorMsg: `Project folder ${projectPath} does not have the good rights`,
      });
    }
    absoluteProjectPath = path.resolve(absoluteProjectPath);

    console.log(locals.session.data.path);
    const session = locals.session;

    await session.setData({ path: absoluteProjectPath });
    await session.save();

    return {
      success: true,
    };
  },
};
