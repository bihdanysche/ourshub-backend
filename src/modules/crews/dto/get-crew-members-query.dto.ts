import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, TransformFnParams, Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { PaginationQueryDto } from 'src/common/dto/pagination/pagination-query.dto';
import { CREW_LIMITS } from '../constants/crews.constants';

export class GetCrewMembersQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Search query for name, username, or alias' })
  @IsOptional()
  @IsString()
  @Transform(({ value }: TransformFnParams): string | undefined =>
    typeof value === 'string' && value.trim().length > 0
      ? value.trim()
      : undefined,
  )
  q?: string;

  @ApiPropertyOptional({ default: CREW_LIMITS.DEFAULT_MEMBERS_LIMIT, description: 'Members per page limit' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(CREW_LIMITS.MAX_MEMBERS_LIMIT)
  limit: number = CREW_LIMITS.DEFAULT_MEMBERS_LIMIT;
}
