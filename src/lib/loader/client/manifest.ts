import { deserialize } from '$app/forms';

import { type IManifest } from './types/manifest.type.ts';

export async function fetchManifest(): Promise<IManifest> {
  const res = await fetch(`/game-loader?/getManifest`, {
    method: 'POST',
    body: JSON.stringify({ side: 'client' }),
  });
  const manifestResult = deserialize(await res.text());
  if (manifestResult.type !== 'success' || !manifestResult.data) {
    if (manifestResult.type === 'failure' && manifestResult.data)
      throw new Error(manifestResult.data.errorMsg as string);
    throw new Error('Failed to read remote directory');
  }
  return manifestResult.data.manifest as IManifest;
}
