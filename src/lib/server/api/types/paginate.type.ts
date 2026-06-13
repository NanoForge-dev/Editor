export interface PaginateQuery {
  page?: number;
  limit?: number;
}

export interface SearchQuery {
  search?: string;
}

export type PaginateResult<T> = {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};
