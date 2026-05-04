import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class UpdateSiteDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsEnum(['typo3', 'wordpress', 'generic'])
  @IsOptional()
  cms?: 'typo3' | 'wordpress' | 'generic';

  @IsInt()
  @Min(1)
  @Max(10)
  @IsOptional()
  priority?: number;

  @IsBoolean()
  @IsOptional()
  scheduleEnabled?: boolean;

  /** Five-field cron, e.g. `0 4 * * *` (daily 04:00 UTC) */
  @IsString()
  @IsOptional()
  @MaxLength(128)
  scheduleCron?: string | null;
}
