import { Type } from 'class-transformer';
import { IsInt, IsNumber, Min } from 'class-validator';

export class CreateSplitExpenseMemberDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  user: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  paid: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  mustPay: number;
}
