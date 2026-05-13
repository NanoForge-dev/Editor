import { useActionHandler } from '@utils-server/request-handler';

export const fetchConfigAction = useActionHandler(
  async (handler) => {
    const { context } = handler;

    return {
      mode: context.online ? 'online' : 'offline',
    };
  },
  {
    projectOptional: true,
  },
);
