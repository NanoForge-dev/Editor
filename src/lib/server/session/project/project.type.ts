export interface SessionProject {
  path: string;
  gateway?: {
    id: string;
    sshKey: string;
  };
}
