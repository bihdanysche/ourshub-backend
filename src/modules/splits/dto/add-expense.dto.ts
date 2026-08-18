import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, ValidateNested } from 'class-validator';
import { CreateSplitExpenseDto } from './create-split-expense.dto';

export class AddExpenseDto {
  @ApiProperty({ type: [CreateSplitExpenseDto], description: 'List of new expenses to add' })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateSplitExpenseDto)
  expenses: CreateSplitExpenseDto[];
}
