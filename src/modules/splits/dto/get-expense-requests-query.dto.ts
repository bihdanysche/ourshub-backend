import { Transform, Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import { PaginationQueryDto } from 'src/common/dto/pagination/pagination-query.dto';

export enum ExpenseRequestRoleFilter {
  AS_SPENDER = 'as_spender',
  AS_USER = 'as_user',
  ALL = 'all',
}

export class GetExpenseRequestsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  userId?: number;

  @IsOptional()
  @IsEnum(ExpenseRequestRoleFilter)
  role: ExpenseRequestRoleFilter = ExpenseRequestRoleFilter.ALL;

  constructor() {
    super();
    this.limit = 15;
  }
}
