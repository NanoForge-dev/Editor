import { Expose } from 'class-transformer';
import { IsOptional, IsString } from 'class-validator';

import { useActionHandler } from '@utils-server/request-handler';

export class ReaddirFsBody {
  @Expose()
  @IsString()
  @IsOptional()
  path?: string;
}

export const readdirFsAction = useActionHandler(
  async ({ project, body }) => {
    const dir = project.client.fs.getDirectory(body.path ?? '');
    return dir.read(true);
  },
  { body: ReaddirFsBody },
);
