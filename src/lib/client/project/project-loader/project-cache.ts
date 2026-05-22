import { getConfig } from '$lib/client/config';

export interface ProjectDataCache {
  id: string;
  resolvable: string;
  lastOpened: number;
  name?: string;
  imageUrl?: string;
  invalid?: boolean;
}

export class ProjectCache {
  private static storageKey = 'projects';
  private static isOnline = getConfig().mode === 'online';

  static async getProjects(): Promise<ProjectDataCache[]> {
    if (this.isOnline) return ProjectCache.getOnlineProjects();
    const storedProjects = localStorage.getItem(this.storageKey);
    if (storedProjects) {
      return (JSON.parse(storedProjects) as ProjectDataCache[]).sort(
        (a, b) => b.lastOpened - a.lastOpened,
      );
    }
    return [];
  }

  static async getOnlineProjects(): Promise<ProjectDataCache[]> {
    // @todo to be implemented
    return [];
  }

  static async getProject(id: string): Promise<ProjectDataCache> {
    const projects = await this.getProjects();
    const project = projects.find((project) => project.id === id);
    if (project) return project;
    throw new Error('Project not found');
  }

  static async addProject(project: ProjectDataCache): Promise<void> {
    if (this.isOnline) return;
    const projects = await this.getProjects();
    projects.push(project);
    localStorage.setItem(this.storageKey, JSON.stringify(projects));
  }

  static async removeProject(id: string): Promise<void> {
    if (this.isOnline) return;
    let projects = await this.getProjects();
    projects = projects.filter((project) => project.id !== id);
    localStorage.setItem(this.storageKey, JSON.stringify(projects));
  }

  static async updateProject(id: string, updatedProject: Partial<ProjectDataCache>): Promise<void> {
    if (this.isOnline) return;
    const projects = await this.getProjects();
    const projectIndex = projects.findIndex((project) => project.id === id);

    if (projectIndex !== -1) {
      projects[projectIndex] = { ...projects[projectIndex], ...updatedProject };
      localStorage.setItem(this.storageKey, JSON.stringify(projects));
    }
  }

  static async invalidateProject(id: string): Promise<void> {
    return ProjectCache.updateProject(id, { invalid: true });
  }

  static async clearProjects(): Promise<void> {
    if (this.isOnline) return;
    localStorage.removeItem(this.storageKey);
  }

  static async addOrUpdateProject(project: ProjectDataCache): Promise<void> {
    if (this.isOnline) return;
    const projects = await this.getProjects();
    const projectIndex = projects.findIndex(
      (p) => p.id === project.id || p.resolvable === project.resolvable,
    );
    if (projectIndex !== -1) {
      projects[projectIndex] = { ...projects[projectIndex], ...project };
    } else {
      projects.push(project);
    }
    localStorage.setItem(this.storageKey, JSON.stringify(projects));
  }
}
