export interface PaginationParams {
  page: number;
  limit: number;
  skip: number;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

/**
 * Parses query parameters into Prisma-compatible pagination options
 */
export const getPaginationParams = (query: any): PaginationParams => {
  const page = Math.max(1, parseInt(query.page as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit as string) || 20)); // Max 100
  const skip = (page - 1) * limit;

  return { page, limit, skip };
};

/**
 * Generates the paginated response format
 */
export const createPaginatedResponse = <T>(
  data: T[],
  total: number,
  params: PaginationParams
): PaginatedResponse<T> => {
  return {
    data,
    meta: {
      page: params.page,
      limit: params.limit,
      total,
      totalPages: Math.ceil(total / params.limit),
    },
  };
};
