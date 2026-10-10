const NAMES = new Set([
  'PATH',
  'Path',
  'PATHEXT',
  'HOME',
  'USER',
  'USERNAME',
  'LOGNAME',
  'SHELL',
  'LANG',
  'LANGUAGE',
  'TERM',
  'TZ',
  'TMPDIR',
  'TMP',
  'TEMP',
  'CI',
  'NODE_ENV',
  'NODE_OPTIONS',
  'NODE_EXTRA_CA_CERTS',
  'FORCE_COLOR',
  'NO_COLOR',
  'SSH_AUTH_SOCK',
  'SSH_AGENT_PID',
  'GIT_SSH',
  'GIT_SSH_COMMAND',
  'GIT_ASKPASS',
  'SSH_ASKPASS',
  'GIT_AUTHOR_NAME',
  'GIT_AUTHOR_EMAIL',
  'GIT_COMMITTER_NAME',
  'GIT_COMMITTER_EMAIL',
  'GIT_SSL_CAINFO',
  'GIT_SSL_CAPATH',
  'SSL_CERT_FILE',
  'SSL_CERT_DIR',
  'GNUPGHOME',
  'GPG_TTY',
  'HTTP_PROXY',
  'HTTPS_PROXY',
  'NO_PROXY',
  'ALL_PROXY',
  'http_proxy',
  'https_proxy',
  'no_proxy',
  'all_proxy',
  'SystemRoot',
  'SYSTEMROOT',
  'ComSpec',
  'COMSPEC',
  'WINDIR',
  'APPDATA',
  'LOCALAPPDATA',
  'USERPROFILE',
  'HOMEDRIVE',
  'HOMEPATH',
  'ProgramFiles',
  'ProgramFiles(x86)',
  'ProgramData',
  'NF_CLI_PATH',
]);

const PREFIXES = [
  'LC_',
  'XDG_',
  'npm_config_',
  'NPM_CONFIG_',
  'PNPM_',
  'BUN_',
  'COREPACK_',
  'NANOFORGE_',
];

/**
 * The part of the editor's environment its child processes (git, the CLI, game servers) get: what
 * tools need to run, never the server's own settings (`SESSION_SECRET`, `API_KEY`, `PORT`…), nor
 * the git variables that point at another repository (`GIT_DIR`, `GIT_WORK_TREE`…, set when the
 * editor is started from a git hook), which would bypass `GIT_CEILING_DIRECTORIES`.
 */
export const childEnv = (
  extra: Record<string, string | undefined> = {},
  source: Record<string, string | undefined> = process.env,
): Record<string, string> => {
  const kept = Object.entries(source).filter(
    ([key, value]) =>
      value !== undefined &&
      !(key in extra) &&
      (NAMES.has(key) || PREFIXES.some((prefix) => key.startsWith(prefix))),
  );
  const added = Object.entries(extra).filter(([, value]) => value !== undefined);
  return Object.fromEntries([...kept, ...added]) as Record<string, string>;
};
