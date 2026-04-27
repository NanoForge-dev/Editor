import { deserialize } from '$app/forms';

import { gameProps } from '$lib/loader/client/game';

export async function fetchEnv(): Promise<void> {
  const res = await fetch(`/game-loader?/getEnv`, { method: 'POST', body: new FormData() });
  const envResult = deserialize(await res.text());
  if (envResult.type !== 'success' || !envResult.data) {
    if (envResult.type === 'failure' && envResult.data)
      throw new Error(envResult.data.errorMsg as string);
    throw new Error('Failed to read remote directory');
  }
  gameProps.env = envResult.data.env as Record<string, string>;
}
