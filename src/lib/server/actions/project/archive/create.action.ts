import { useActionHandler } from '@utils-server/request-handler';

export interface CreateArchiveResult {
  id: string;
}

export const createArchiveAction = useActionHandler(async ({ archive }) => {
  const id = await archive.create();
  return { id };
});
