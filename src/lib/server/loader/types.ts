export type Part = 'client' | 'server';

export interface Manifest {
  version: string;
  files: { path: string }[];
}
