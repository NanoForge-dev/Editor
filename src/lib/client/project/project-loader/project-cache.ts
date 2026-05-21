import { getConfig } from '$lib/client/config';

export interface ProjectDataCache {
  id: string;
  resolvable: string;
  lastOpened: string;
  name?: string;
  imageUrl?: string;
}

export class ProjectCache {
  private static storageKey = 'projects';
  private static isOnline = getConfig().mode === 'online';

  static async getProjects(): Promise<ProjectDataCache[]> {
    if (this.isOnline) return ProjectCache.getOnlineProjects();
    const storedProjects = localStorage.getItem(this.storageKey);
    if (storedProjects) {
      return JSON.parse(storedProjects);
    }
    return [];
  }

  static async getOnlineProjects(): Promise<ProjectDataCache[]> {
    // @todo to be implemented
    return [];
  }

  static async addProject(project: ProjectDataCache): Promise<void> {
    if (this.isOnline) return;
    const projects = await this.getProjects();
    projects.push(project);
    localStorage.setItem(this.storageKey, JSON.stringify(projects));
  }

  static async removeProject(projectName: string): Promise<void> {
    if (this.isOnline) return;
    let projects = await this.getProjects();
    projects = projects.filter((project) => project.name !== projectName);
    localStorage.setItem(this.storageKey, JSON.stringify(projects));
  }

  static async updateProject(updatedProject: ProjectDataCache): Promise<void> {
    if (this.isOnline) return;
    const projects = await this.getProjects();
    const projectIndex = projects.findIndex((project) => project.name === updatedProject.name);

    if (projectIndex !== -1) {
      projects[projectIndex] = updatedProject;
      localStorage.setItem(this.storageKey, JSON.stringify(projects));
    }
  }

  static async clearProjects(): Promise<void> {
    if (this.isOnline) return;
    localStorage.removeItem(this.storageKey);
  }
}
