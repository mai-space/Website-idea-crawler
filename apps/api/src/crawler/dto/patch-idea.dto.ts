import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class PatchIdeaDto {
  @IsEnum(['open', 'accepted', 'rejected', 'deferred', 'done'])
  @IsOptional()
  status?: 'open' | 'accepted' | 'rejected' | 'deferred' | 'done';

  @IsString()
  @IsOptional()
  notes?: string;

  @IsInt()
  @Min(1)
  @Max(500)
  @IsOptional()
  customHours?: number;
}
