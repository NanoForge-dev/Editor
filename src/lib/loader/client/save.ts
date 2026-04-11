import { deserialize } from '$app/forms';
import type { Save } from '$lib/loader/client/types/save.type';

export async function fetchSave(): Promise<Save> {
  const res = await fetch(`/game-loader?/getSave`, {
    method: 'POST',
    body: JSON.stringify({ side: 'client' }),
  });

  const saveResult = deserialize(await res.text());
  if (saveResult.type !== 'success' || !saveResult.data) {
    if (saveResult.type === 'failure' && saveResult.data)
      throw new Error(saveResult.data.errorMsg as string);
    throw new Error('Failed to read remote directory');
  }
  return saveResult.data.save as Save;
}
