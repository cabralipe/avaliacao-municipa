import { useState, type ChangeEvent } from 'react';
import { useQuery } from '@tanstack/react-query';

import { apiClient } from '../api/client';
import type { PaginatedResponse } from '../types';

interface Options<T> {
  queryKey: (string | number)[];
  url: string;
  initialPageSize?: number;
  enabled?: boolean;
  params?: Record<string, unknown>;
}

export function usePaginatedResource<T>({
  queryKey,
  url,
  initialPageSize = 10,
  enabled = true,
  params = {},
}: Options<T>) {
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(initialPageSize);

  const query = useQuery({
    queryKey: [...queryKey, page, pageSize, params],
    queryFn: async () => {
      const { data } = await apiClient.get<PaginatedResponse<T>>(url, {
        params: { page: page + 1, page_size: pageSize, ...params },
      });
      return data;
    },
    keepPreviousData: true,
    enabled,
  });

  const handlePageChange = (_: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleRowsPerPageChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const value = Number(event.target.value);
    setPageSize(value);
    setPage(0);
  };

  return {
    ...query,
    results: query.data?.results ?? [],
    total: query.data?.count ?? 0,
    page,
    pageSize,
    setPage,
    setPageSize,
    handlePageChange,
    handleRowsPerPageChange,
  };
}
