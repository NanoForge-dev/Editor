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
        data.strictTypeChecking,
        data.multiplayerServer,
        data.skipDependencyInstallation,
        data.dockerContainerization,
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

  startProject: async ({ locals }) => {
    try {
      new CliInterface(locals.session.data.path).startProject();
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
} satisfies Actions;
