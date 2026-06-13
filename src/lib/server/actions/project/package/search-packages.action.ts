import { Expose } from 'class-transformer';
import { IsNumber, IsOptional, IsString } from 'class-validator';

import type { Package, PaginateResult } from '$lib/server/api';

import { useActionHandler } from '@utils-server/request-handler';

export class SearchPackagesBody {
  @Expose()
  @IsString()
  @IsOptional()
  search?: string;

  @Expose()
  @IsNumber()
  @IsOptional()
  page?: number;

  @Expose()
  @IsNumber()
  @IsOptional()
  limit?: number;
}

export const searchPackagesAction = useActionHandler(
  async ({ body, api }): Promise<PaginateResult<Package>> => {
    return api.packages.getAll(body);
  },
  {
    body: SearchPackagesBody,
  },
);
