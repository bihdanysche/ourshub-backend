import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { PaginationQueryDto } from 'src/common/dto/pagination/pagination-query.dto';
import { POST_LIMITS } from '../constants/posts.constants';

export class GetPostsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(POST_LIMITS.MAX_PAGE_LIMIT)
  limit: number = POST_LIMITS.DEFAULT_PAGE_LIMIT;
}
