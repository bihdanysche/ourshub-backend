import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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

export class PayOffItemDto {
  @ApiProperty({ description: 'Debtor user ID', example: 2 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  user: number;

  @ApiProperty({ description: 'Payment amount', example: 15.0 })
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount: number;

  @ApiPropertyOptional({ description: 'Optional payment note/message' })
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
