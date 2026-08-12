import { Transform, TransformFnParams, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';
import { PaginationQueryDto } from 'src/common/dto/pagination/pagination-query.dto';
import { SPLIT_LIMITS } from '../constants/splits.constants';

export class GetSplitsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(SPLIT_LIMITS.MAX_PAGE_LIMIT)
  limit: number = SPLIT_LIMITS.DEFAULT_PAGE_LIMIT;

  @IsOptional()
  @Transform(
    ({ value }: TransformFnParams): boolean =>
      value === 'true' || value === true,
  )
  @IsBoolean()
  isArchived: boolean = false;
}
