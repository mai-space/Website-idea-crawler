import { Type } from 'class-transformer';
import { IsBooleanString, IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

const COMPLEXITY = ['low', 'medium', 'high'] as const;
const STATUS = ['open', 'accepted', 'rejected', 'deferred', 'done'] as const;
const AREAS = ['content', 'seo', 'feature', 'ux'] as const;
const SORT = ['impact', 'effort', 'created_at'] as const;

export class ListIdeasQueryDto {
  @IsOptional()
  @IsEnum(COMPLEXITY)
  complexity?: (typeof COMPLEXITY)[number];

  @IsOptional()
  @IsBooleanString()
  requires_dev?: string;

  @IsOptional()
  @IsEnum(AREAS)
  area?: (typeof AREAS)[number];

  @IsOptional()
  @IsEnum(STATUS)
  status?: (typeof STATUS)[number];

  @IsOptional()
  @IsEnum(SORT)
  sort?: (typeof SORT)[number];

  @IsOptional()
  @IsUUID()
  site_id?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
