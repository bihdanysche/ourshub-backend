import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsInt, Min } from 'class-validator';

export class RemoveExpenseMembersDto {
  @ApiProperty({ type: [Number], description: 'Array of user IDs to remove from expense' })
  @IsArray()
  @ArrayMinSize(1)
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  userIds: number[];
}
