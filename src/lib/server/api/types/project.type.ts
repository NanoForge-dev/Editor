export interface ApiProject {
  id: string;
  code: string;
  name: string;
  description: string;
  gatewayProjectRegistryUrl: string;
  gatewayProjectRegistryMetadata: {
    dir: string | null;
    sshKey: string;
  };
}
