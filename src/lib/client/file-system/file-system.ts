import type { Project } from '$lib/client/project';

export class ProjectFileSystem {
  constructor(private readonly core: Project) {}
}
