import { Transform, TransformFnParams, Type } from 'class-transformer';
import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { SPLIT_LIMITS } from '../constants/splits.constants';

export class IncreaseItemDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  user: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsOptional()
  @IsString()
  @Transform(({ value }: TransformFnParams): string | undefined =>
    typeof value === 'string' && value.trim().length > 0
      ? value.trim()
      : undefined,
  )
  @MinLength(SPLIT_LIMITS.MSG_MIN_LENGTH)
  @MaxLength(SPLIT_LIMITS.MSG_MAX_LENGTH)
  @Matches(/^(?!\s)[\s\S]*(?<!\s)$/, {
    message:
      'Msg must not start or end with whitespace and cannot be only spaces',
  })
  msg?: string;
}
