import type { WithOptional } from '@utils/types/base.type';

import type {
  CliBuildOptions,
  CliCreateOptions,
  CliDevOptions,
  CliGenerateOptions,
  CliInstallOptions,
  CliNewOptions,
  CliStartOptions,
} from './cli.type';

export const CLI_NEW_DEFAULTS: WithOptional<CliNewOptions, 'name'> = {
  packageManager: 'npm',
  language: 'ts',
  strict: false,
  server: false,
  skipInstall: false,
  docker: false,
  git: false,
  gitRemote: false,
};

export const CLI_INSTALL_DEFAULTS: WithOptional<CliInstallOptions> = {};

export const CLI_BUILD_DEFAULTS: WithOptional<CliBuildOptions> = {};

export const CLI_START_DEFAULTS: WithOptional<CliStartOptions> = {};

export const CLI_DEV_DEFAULTS: WithOptional<CliDevOptions> = {};

export const CLI_GENERATE_DEFAULTS: WithOptional<CliGenerateOptions> = {};

export const CLI_CREATE_DEFAULTS: WithOptional<CliCreateOptions, 'name'> = {};
