import { deserialize } from '$app/forms';
import type { EditorComponentManifest } from '@nanoforge-dev/ecs-lib';

export async function fetchComponentManifest(
  componentPath: string,
): Promise<EditorComponentManifest> {
  const res = await fetch(`/game-loader?/getComponentManifest`, {
    method: 'POST',
    body: JSON.stringify({ side: 'client', componentPath }),
  });
  const manifestResult = deserialize(await res.text());
  if (manifestResult.type !== 'success' || !manifestResult.data) {
    if (manifestResult.type === 'failure' && manifestResult.data)
      throw new Error(manifestResult.data.errorMsg as string);
    throw new Error('Failed to read remote directory');
  }
  return manifestResult.data.manifest as EditorComponentManifest;
}
