import { IsEnum, IsInt, IsOptional, IsString, IsUrl, Max, Min } from 'class-validator';

export class CreateSiteDto {
  @IsString()
  name: string;

  @IsUrl()
  url: string;

  @IsEnum(['typo3', 'wordpress', 'generic'])
  @IsOptional()
  cms?: 'typo3' | 'wordpress' | 'generic';

  @IsInt()
  @Min(1)
  @Max(10)
  @IsOptional()
  priority?: number;
}
