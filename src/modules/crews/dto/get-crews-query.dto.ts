import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { PaginationQueryDto } from 'src/common/dto/pagination/pagination-query.dto';
import { CREW_LIMITS } from '../constants/crews.constants';

export class GetCrewsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ default: CREW_LIMITS.DEFAULT_CREWS_LIMIT, description: 'Crews per page limit' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(CREW_LIMITS.MAX_CREWS_LIMIT)
  limit: number = CREW_LIMITS.DEFAULT_CREWS_LIMIT;
}
