import { HttpParams } from '@angular/common/http';

import { MaybePaged, PageResult } from './phase2.models';

/** Normalizes a list that may be a bare array or a `{items, totalCount}` page. */
export function toPage<T>(raw: MaybePaged<T> | null | undefined, page = 1): PageResult<T> {
  if (Array.isArray(raw)) {
    return { items: raw, totalCount: raw.length, page, pageSize: raw.length };
  }
  const items = raw?.items ?? [];
  const paged = raw as { page?: number; pageSize?: number; totalCount?: number } | null;
  return {
    items,
    totalCount: paged?.totalCount ?? items.length,
    page: paged?.page ?? page,
    pageSize: paged?.pageSize ?? items.length,
  };
}

/** Query string from a plain object, skipping empty values. */
export function paramsOf(values: Record<string, string | number | boolean | null | undefined>) {
  let params = new HttpParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== null && value !== '') params = params.set(key, value);
  }
  return params;
}
