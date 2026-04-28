import type { RegistryComponentManifest } from '$lib/components/Entity/types';

export class NanoforgeApi {
  async getRegistryComponentManifest(componentName: string): Promise<RegistryComponentManifest> {
    const res = await fetch('https://api.nanoforge.eu/registry/' + componentName, {
      method: 'GET',
    });
    return (await res.json()) as RegistryComponentManifest;
  }
}
