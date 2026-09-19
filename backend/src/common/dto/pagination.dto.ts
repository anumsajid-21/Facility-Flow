import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

/**
 * Shared query parameters for list endpoints:
 * pagination + a generic text search field where supported.
 */
export class PaginationDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  @IsOptional()
  @IsString()
  search?: string;
}

export interface Page<T> {
  data: T[];
  meta: { total: number; page: number; limit: number; pageCount: number };
}

export function buildPage<T>(items: T[], total: number, page: number, limit: number): Page<T> {
  return {
    data: items,
    meta: {
      total,
      page,
      limit,
      pageCount: Math.max(1, Math.ceil(total / limit)),
    },
  };
}