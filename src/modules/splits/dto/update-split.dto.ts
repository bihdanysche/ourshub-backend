import { Transform, TransformFnParams, Type } from 'class-transformer';
import {
  IsArray,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { SPLIT_LIMITS } from '../constants/splits.constants';
import { UpdateSplitExpenseDto } from './update-split-expense.dto';

export class UpdateSplitDto {
  @IsOptional()
  @IsString()
  @Transform(({ value }: TransformFnParams): string | undefined =>
    typeof value === 'string' && value.trim().length > 0
      ? value.trim()
      : undefined,
  )
  @MinLength(SPLIT_LIMITS.TITLE_MIN_LENGTH)
  @MaxLength(SPLIT_LIMITS.TITLE_MAX_LENGTH)
  @Matches(/^(?!\s)[\s\S]*(?<!\s)$/, {
    message:
      'Title must not start or end with whitespace and cannot be only spaces',
  })
  title?: string;

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

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateSplitExpenseDto)
  expenses?: UpdateSplitExpenseDto[];
}
