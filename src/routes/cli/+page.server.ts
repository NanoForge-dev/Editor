import { fail } from '@sveltejs/kit';

import { CliError } from '@utils-server/cli/cli-error';
import { CliInterface } from '@utils-server/cli/cli-interface';

import type { Actions } from './$types';

export const actions = {
  new: async ({ request }) => {
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
      new CliInterface(data.projectPath).new(
        data.projectName,
        data.packageManager,
        data.language,
        false,
        data.multiplayerServer,
        data.dockerContainerization,
        false,
        true,
        data.createGitRepository,
        data.gitRemote,
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
  generate: async ({ locals }) => {
    try {
      new CliInterface(locals.session.data.path).generate(true);
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
  build: async ({ locals }) => {
    try {
      new CliInterface(locals.session.data.path).build(true);
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
  addComponent: async ({ request, locals }) => {
    const data = await request.json();

    if (!data.componentName) {
      return fail(403, { success: false, errorMsg: "Missing arg: 'componentName'" });
    }

    try {
      new CliInterface(locals.session.data.path).addComponent(data.componentName);
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
