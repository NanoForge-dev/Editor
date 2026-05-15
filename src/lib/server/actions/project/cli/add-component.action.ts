import { useActionHandler } from '@utils-server/request-handler';

class AddComponentBody {
  componentNames!: [string, ...string[]];
  server: true | undefined;
}

export const addComponentProjectAction = useActionHandler(
  async ({ api, body, cli }) => {
    const registryComponents = await Promise.all(
      body.componentNames.map(async (c) => {
        const rc = await api.registry.getComponent(c);
        if (rc.type !== 'component')
          throw new Error(`Can only add component: ${c} is a ${rc.type}`);
        return rc;
      }),
    );

    cli.install(body.componentNames, { server: body.server });
    return {
      newComponentsPaths: registryComponents.map((rc) => rc._file),
    };
  },
  {
    body: AddComponentBody,
  },
);
