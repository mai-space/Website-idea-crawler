import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

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
}
