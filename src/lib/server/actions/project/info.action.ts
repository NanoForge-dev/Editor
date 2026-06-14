import { Expose } from 'class-transformer';
import { IsOptional, IsString } from 'class-validator';

import { useActionHandler } from '@utils-server/request-handler';

export interface InfoProject {
  name: string;
  language: 'ts' | 'js';
  hasServer: boolean;
}

export class InfoProjectBody {
  @Expose()
  @IsString()
  @IsOptional()
  name?: string;
}

export const getInfoProjectAction = useActionHandler(async ({ fs }) => {
  const configFile = fs.getFile('nanoforge.config.json');
  const config = await configFile.readJson();

  return {
    name: config.name,
    language: config.language,
    hasServer: config.server?.enabled ?? false,
  };
});

export const setInfoProjectAction = useActionHandler(
  async ({ body, fs }) => {
    const configFile = fs.getFile('nanoforge.config.json');
    const config = await configFile.readJson();

    if (body.name) config.name = body.name;

    configFile.writeJson(config);
  },
  { body: InfoProjectBody },
);
