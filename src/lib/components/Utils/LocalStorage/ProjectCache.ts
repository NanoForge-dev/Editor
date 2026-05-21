export interface ProjectDataCache {
  id: string;
  name: string;
  path: string;
  imageUrl: string;
}

class ProjectCache {
  private static storageKey = 'projects';

  static getProjects(): Array<ProjectDataCache> {
    const storedProjects = localStorage.getItem(this.storageKey);
    if (storedProjects) {
      return JSON.parse(storedProjects);
    }
    return [];
  }

  static addProject(project: ProjectDataCache) {
    const projects = this.getProjects();
    projects.push(project);
    localStorage.setItem(this.storageKey, JSON.stringify(projects));
  }

  static removeProject(projectName: string) {
    let projects = this.getProjects();
    projects = projects.filter((project) => project.name !== projectName);
    localStorage.setItem(this.storageKey, JSON.stringify(projects));
  }

  static updateProject(updatedProject: ProjectDataCache) {
    const projects = this.getProjects();
    const projectIndex = projects.findIndex((project) => project.name === updatedProject.name);

    if (projectIndex !== -1) {
      projects[projectIndex] = updatedProject;
      localStorage.setItem(this.storageKey, JSON.stringify(projects));
    }
  }

  static clearProjects() {
    localStorage.removeItem(this.storageKey);
  }
}

export default ProjectCache;
