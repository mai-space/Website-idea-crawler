import { ArrayMaxSize, ArrayMinSize, IsArray, IsEnum, IsUUID } from 'class-validator';

const STATUSES = ['open', 'accepted', 'rejected', 'deferred', 'done'] as const;

export class BulkIdeasDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsUUID('4', { each: true })
  ids!: string[];

  @IsEnum(STATUSES)
  status!: (typeof STATUSES)[number];
}
