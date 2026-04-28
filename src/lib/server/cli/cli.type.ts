export type CliPartial<T, K extends keyof T | never = never> = (T extends { directory?: string }
  ? Omit<Partial<T>, 'directory'>
  : Partial<T>) &
  Pick<T, K>;

export interface CliRunOptions {
  async?: boolean;
}

export interface CliNewOptions {
  directory?: string;
  name: string;
  path?: string;
  packageManager: 'npm' | 'pnpm' | 'yarn' | 'bun';
  language: 'js' | 'ts';
  strict: boolean;
  server: boolean;
  initFunctions?: boolean;
  skipInstall: boolean;
  docker: boolean;
  lint?: false;
  editor?: true;
  git: boolean;
  gitRemote: string | false;
}

export interface CliInstallOptions {
  directory?: string;
  lib?: true;
  server?: true;
}

export interface CliBuildOptions {
  directory?: string;
  config?: string;
  clientEntry?: string;
  serverEntry?: string;
  clientStaticDir?: string;
  serverStaticDir?: string;
  clientOutDir?: string;
  serverOutDir?: string;
  editor?: true;
  watch?: true;
}

export interface CliStartOptions {
  directory?: string;
  config?: string;
  clientDir?: string;
  serverDir?: string;
  watch?: true;
  cert?: string;
  key?: string;
}

export interface CliDevOptions {
  directory?: string;
  config?: string;
  generate?: true;
}

export interface CliGenerateOptions {
  directory?: string;
  config?: string;
  editor?: true;
  watch?: true;
}

export interface CliCreateOptions {
  directory?: string;
  config?: string;
  name: string;
  server?: true;
  path?: string;
}
