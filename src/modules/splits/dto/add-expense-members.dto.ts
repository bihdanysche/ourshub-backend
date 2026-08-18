import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, ValidateNested } from 'class-validator';
import { CreateSplitExpenseMemberDto } from './create-split-expense-member.dto';

export class AddExpenseMembersDto {
  @ApiProperty({ type: [CreateSplitExpenseMemberDto], description: 'Members to add to expense' })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateSplitExpenseMemberDto)
  members: CreateSplitExpenseMemberDto[];
}
