import { getUrl } from '@utils/http';

import { BaseRepository } from '../base.repository';
import type { Package, PaginateQuery, PaginateResult, SearchQuery } from '../types';

export class PackageRepository extends BaseRepository {
  getAll(query?: PaginateQuery & SearchQuery): Promise<PaginateResult<Package>> {
    return this.get(getUrl(`/packages`, query), { offline: true });
  }
}
