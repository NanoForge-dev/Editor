import { fail } from '@sveltejs/kit';

import { CliError } from '@utils-server/cli/cli-error';
import { CliInterface } from '@utils-server/cli/cli-interface';

import type { Actions } from './$types';

export const actions = {
  // Create project
  // Run project
  // Export project
  createProject: async ({ request }) => {
    const data = await request.json();

    if (!data.projectPath) {
      return fail(403, { success: false, errorMsg: "Missing arg: 'projectPath'" });
    }
    if (!data.projectName) {
      return fail(403, { success: false, errorMsg: "Missing arg: 'projectName'" });
    }
    if (!data.packageManager) {
      return fail(403, { success: false, errorMsg: "Missing arg: 'packageManager'" });
    }
    if (!data.language) {
      return fail(403, { success: false, errorMsg: "Missing arg: 'language'" });
    }

    try {
      new CliInterface(data.projectPath).createProject(
        data.projectName,
        data.packageManager,
        data.language,
        data.multiplayerServer,
      );
      return {
        success: true,
      };
    } catch (e: unknown) {
      if (e instanceof CliError) {
        return fail(403, { success: false, errorMsg: e.message });
      }
      throw e;
    }
  },

  startDevProject: async ({ locals }) => {
    try {
      const childProcess = new CliInterface(locals.session.data.path).startDevProject(
        locals.session?.data?.projectPid || -1,
      );
      const session = locals.session;

      session.data.projectPid = childProcess;
      await session.save();

      return {
        success: true,
      };
    } catch (e: unknown) {
      if (e instanceof CliError) {
        return fail(403, { success: false, errorMsg: e.message });
      }
      throw e;
    }
  },

  stopProject: async ({ locals }) => {
    try {
      if (!locals.session.data.projectPid) {
        throw new CliError('Project not running');
      }
      new CliInterface(locals.session.data.path).stopProject(locals.session.data.projectPid);
      locals.session.data.projectPid = -1;
      return {
        success: true,
      };
    } catch (e: unknown) {
      if (e instanceof CliError) {
        return fail(403, { success: false, errorMsg: e.message });
      }
      throw e;
    }
  },

  isProjectRunning: async ({ locals }) => {
    try {
      if (!locals.session.data.projectPid) {
        return {
          success: true,
          projectRunning: false,
        };
      }
      return {
        success: true,
        projectRunning: new CliInterface(locals.session.data.path).isProjectRunning(
          locals.session.data.projectPid,
        ),
      };
    } catch (e: unknown) {
      if (e instanceof CliError) {
        return fail(403, { success: false, errorMsg: e.message });
      }
      throw e;
    }
  },
} satisfies Actions;
