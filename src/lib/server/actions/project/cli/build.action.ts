import { useActionHandler } from '@utils-server/request-handler';

export const buildProjectAction = useActionHandler(async ({ cli }) => {
  cli.build({ editor: true });
});
