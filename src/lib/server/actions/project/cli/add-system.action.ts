import { useActionHandler } from '@utils-server/request-handler';

class AddSystemBody {
  systemNames!: [string, ...string[]];
  server: true | undefined;
}

export const addSystemProjectAction = useActionHandler(
  async ({ api, body, cli }) => {
    const registrySystems = await Promise.all(
      body.systemNames.map(async (c) => {
        const rc = await api.registry.getComponent(c);
        if (rc.type !== 'system') throw new Error(`Can only add system: ${c} is a ${rc.type}`);
        return rc;
      }),
    );

    cli.install(body.systemNames, { server: body.server });
    return {
      newSystemsPaths: registrySystems.map((rc) => rc._file),
    };
  },
  {
    body: AddSystemBody,
  },
);
