import { env } from '$env/dynamic/private';
import { redirect } from '@sveltejs/kit';
import { authGuard } from '@utils-server/server-api';
import * as fs from 'node:fs';
import * as path from 'node:path';

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url, cookies, locals }) => {
  const projectPath = url.searchParams.get('projectPath');
  const projectId = url.searchParams.get('projectId');
  let absoluteProjectPath: string = '';
  if (projectPath) {
    if (env.API_URL) {
      return { success: false, errorMsg: 'Cannot load local project if API_URL is present' };
    }
    absoluteProjectPath = projectPath;
  } else if (projectId) {
    if (!env.API_URL) {
      throw new Error('Missing API_URL');
    }

    const serverProjectPath = await authGuard(async (httpClient) => {
      return await httpClient.post(`${env.API_URL}/editor/projects/${projectId}`);
    }, cookies);
    if (serverProjectPath.status !== 200) {
      return { success: false, errorMsg: 'Cannot retrieve project from API' };
    }
    absoluteProjectPath = (await serverProjectPath.json())['projectPath'];
  } else {
    return { success: false, errorMsg: 'No project provided' };
  }

  try {
    const stats = fs.lstatSync(absoluteProjectPath);
    if (!stats.isDirectory()) {
      return { success: false, errorMsg: `Project folder ${projectPath} is not a folder` };
    }
  } catch {
    return { success: false, errorMsg: `Project folder ${projectPath} does not exist` };
  }
  try {
    fs.accessSync(absoluteProjectPath, fs.constants.W_OK);
  } catch {
    return {
      success: false,
      errorMsg: `Project folder ${projectPath} does not have the good rights`,
    };
  }
  absoluteProjectPath = path.resolve(absoluteProjectPath);

  const session = locals.session;

  await session.setData({ path: absoluteProjectPath });
  await session.save();

  redirect(307, '/');
};
