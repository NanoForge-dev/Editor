import { useActionHandler } from '@utils-server/request-handler';

export const buildProjectAction = useActionHandler(async ({ cli }) => {
  cli.generate({ editor: true });
  cli.build({ editor: true });
});
