import { deserialize } from '$app/forms';

export async function fetchEnv(): Promise<Record<string, string | undefined>> {
  const res = await fetch(`/game-loader?/getEnv`);
  const envResult = deserialize(await res.text());
  if (envResult.type !== 'success' || !envResult.data) {
    if (envResult.type === 'failure' && envResult.data)
      throw new Error(envResult.data.errorMsg as string);
    throw new Error('Failed to read remote directory');
  }
  return envResult.data.env as Record<string, string | undefined>;
}
