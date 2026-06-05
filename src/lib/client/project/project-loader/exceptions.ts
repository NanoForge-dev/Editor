import { goto } from '$app/navigation';
import { resolve } from '$app/paths';

import { getConfig } from '$lib/client/config';
import { ProjectLoader } from '$lib/client/project';

import { toastError } from '@utils-client/toasts';

const config = getConfig();

export enum PLErrors {
  No_Project = 'no_project',
  No_Init_Project = 'no_init_project',
  Invalid_Create_Action = 'invalid_create_action',
  Invalid_Complete_Action = 'invalid_complete_action',
  Empty_Project = 'empty_project',
}

const traces: Record<PLErrors, string> = {
  [PLErrors.No_Project]: 'No project found',
  [PLErrors.No_Init_Project]: 'Project not initialized',
  [PLErrors.Invalid_Create_Action]: 'Unable to create project',
  [PLErrors.Invalid_Complete_Action]: 'Unable to complete project',
  [PLErrors.Empty_Project]: 'Empty project',
};

const fallbacks = {
  [PLErrors.No_Project]: () => async () => {
    await goto(resolve('/'));
    toastError('No project found', 'Select a project or create a new one');
  },
  [PLErrors.No_Init_Project]: (id: string) => async () => {
    await goto(resolve(`/load?id=${id}`));
  },
  [PLErrors.Invalid_Create_Action]: (error: any) => async () => {
    toastError('Unable to create project', error.message ?? 'Unknown error');
  },
  [PLErrors.Invalid_Complete_Action]: (error: any) => async () => {
    toastError('Unable to init project', error.message ?? 'Unknown error');
  },
  [PLErrors.Empty_Project]: (id: string, resolvable: string) => async () => {
    if (config.mode === 'offline') {
      ProjectLoader.unload();
      await goto(resolve('/'));
      toastError('Invalid project', 'Select another project or create a new one');
    }
    await goto(resolve(`/load?id=${id}&gatewayId=${resolvable}`));
  },
};

export class PLException<T extends PLErrors> extends Error {
  public readonly reason: T;
  public readonly fb: () => Promise<void>;
  public readonly args: Parameters<(typeof fallbacks)[T]>;

  constructor(reason: T, ...args: Parameters<(typeof fallbacks)[T]>) {
    super(`Failed to load project: ${traces[reason]}`);
    this.reason = reason;
    this.fb = (fallbacks[reason] as any)(...(args as []));
    this.args = args;
  }
}

export const runPLSafe = async <T, E extends PLErrors>(
  cb: () => Promise<T>,
  fb: (e: unknown) => PLException<E>,
): Promise<T | never> => {
  try {
    return await cb();
  } catch (e) {
    if (e instanceof PLException) throw e;
    throw fb(e);
  }
};
