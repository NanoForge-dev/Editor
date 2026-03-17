// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import child_process from 'node:child_process';

declare global {
  namespace App {
    // interface Error {}
    // interface Locals {}
    // interface PageData {}
    // interface PageState {}
    // interface Platform {}
  }
}

declare module 'svelte-kit-sessions' {
  interface SessionData {
    path: string;
    projectPid?: number;
  }
}

export {};
