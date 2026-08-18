import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, TransformFnParams, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { SPLIT_LIMITS } from '../constants/splits.constants';
import { CreateSplitExpenseMemberDto } from './create-split-expense-member.dto';

export class CreateSplitExpenseDto {
  @ApiProperty({ description: 'Expense item title', example: 'Pizza' })
  @IsString()
  @Transform(({ value }: TransformFnParams): string =>
    typeof value === 'string' ? value.trim() : String(value ?? ''),
  )
  @MinLength(SPLIT_LIMITS.TITLE_MIN_LENGTH)
  @MaxLength(SPLIT_LIMITS.TITLE_MAX_LENGTH)
  @Matches(/^(?!\s)[\s\S]*(?<!\s)$/, {
    message:
      'Title must not start or end with whitespace and cannot be only spaces',
  })
  title: string;

  @ApiPropertyOptional({ description: 'Expense item description' })
  @IsOptional()
  @IsString()
  @Transform(({ value }: TransformFnParams): string | undefined =>
    typeof value === 'string' && value.trim().length > 0
      ? value.trim()
      : undefined,
  )
  @MinLength(SPLIT_LIMITS.DESC_MIN_LENGTH)
  @MaxLength(SPLIT_LIMITS.DESC_MAX_LENGTH)
  @Matches(/^(?!\s)[\s\S]*(?<!\s)$/, {
    message:
      'Desc must not start or end with whitespace and cannot be only spaces',
  })
  desc?: string;

  @ApiProperty({ description: 'Spender user ID', example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  spender: number;

  @ApiProperty({ type: [CreateSplitExpenseMemberDto], description: 'Members sharing this expense' })
  @IsArray()
  @ArrayMinSize(SPLIT_LIMITS.MIN_MEMBERS_PER_EXPENSE)
  @ValidateNested({ each: true })
  @Type(() => CreateSplitExpenseMemberDto)
  members: CreateSplitExpenseMemberDto[];
}
