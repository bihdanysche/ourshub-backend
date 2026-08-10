import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { PaginationQueryDto } from 'src/common/dto/pagination/pagination-query.dto';
import { CREW_LIMITS } from '../constants/crews.constants';

export class GetCrewMembersQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(CREW_LIMITS.MAX_MEMBERS_LIMIT)
  limit: number = CREW_LIMITS.DEFAULT_MEMBERS_LIMIT;
}
