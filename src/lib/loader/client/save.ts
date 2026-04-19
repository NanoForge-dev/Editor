import { deserialize } from '$app/forms';
import { gameProps } from '$lib/loader/client/game.svelte';
import type { Save } from '$lib/loader/client/types/save.type';

export async function fetchSave(): Promise<void> {
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
  gameProps.save = saveResult.data.save as Save;
}
