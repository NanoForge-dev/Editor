import { spawn } from 'node:child_process';
import { stat } from 'node:fs/promises';
import { dirname } from 'node:path';

/** Opens the OS file manager on an entry (its folder for files; selected where supported). */
export const revealInFileManager = async (absolute: string): Promise<void> => {
  const directory = (await stat(absolute)).isDirectory();
  const [command, args] =
    process.platform === 'darwin'
      ? ['open', directory ? [absolute] : ['-R', absolute]]
      : process.platform === 'win32'
        ? ['explorer', directory ? [absolute] : [`/select,${absolute}`]]
        : ['xdg-open', [directory ? absolute : dirname(absolute)]];
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { detached: true, stdio: 'ignore' });
    child.once('error', reject);
    child.once('spawn', () => {
      child.unref();
      resolve();
    });
  });
};
