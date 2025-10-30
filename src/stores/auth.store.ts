import { writable } from 'svelte/store';

export const authStore = writable<{
  accessToken: string | null;
  refreshToken: string | null;
  tokenExpiresAt: Date | null;
}>({
  accessToken: null,
  refreshToken: null,
  tokenExpiresAt: null,
});
