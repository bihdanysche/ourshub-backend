import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNumber, Min } from 'class-validator';

export class CreateSplitExpenseMemberDto {
  @ApiProperty({ description: 'User ID', example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  user: number;

  @ApiProperty({ description: 'Amount paid by user', example: 50.0 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  paid: number;

  @ApiProperty({ description: 'Amount user must pay', example: 25.0 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  mustPay: number;
}
