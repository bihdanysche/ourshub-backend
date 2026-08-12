import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsInt, Min } from 'class-validator';

export class RemoveExpenseMembersDto {
  @IsArray()
  @ArrayMinSize(1)
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  userIds: number[];
}
