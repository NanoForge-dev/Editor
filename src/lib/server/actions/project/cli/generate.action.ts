import { useActionHandler } from '@utils-server/request-handler';

export const generateProjectAction = useActionHandler(async ({ cli }) => {
  cli.generate({ editor: true });
});
