import { useActionHandler } from '@utils-server/request-handler';

export interface GatewayProject {
  name: string;
  gatewayId: string;
}

export const getGatewayProjectsAction = useActionHandler(
  async ({ api }) => {
    const projects = await api.projects.getProjects();

    return projects.map((project) => ({
      gatewayId: project.id,
      name: project.name,
    }));
  },
  { onlineOnly: true, projectOptional: true },
);
