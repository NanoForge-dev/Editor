import { useActionHandler } from '@utils-server/request-handler';

export class ReaddirFsBody {
  path?: string;
}

export const readdirFsAction = useActionHandler(
  async ({ project, body }) => {
    const dir = project.client.fs.getDirectory(body.path ?? '');
    return dir.read(true);
  },
  { body: ReaddirFsBody },
);
