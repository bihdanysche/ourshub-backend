import { ApiProperty } from '@nestjs/swagger';
import { Transform, TransformFnParams } from 'class-transformer';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { CREW_LIMITS } from '../constants/crews.constants';

export class UpdateCrewDto {
  @ApiProperty({ description: 'Updated crew title', example: 'Updated Crew Name' })
  @IsString()
  @Transform(({ value }: TransformFnParams): string =>
    typeof value === 'string' ? value.trim() : String(value ?? ''),
  )
  @MinLength(CREW_LIMITS.TITLE_MIN_LENGTH)
  @MaxLength(CREW_LIMITS.TITLE_MAX_LENGTH)
  @Matches(/^(?!\s)[\s\S]*(?<!\s)$/, {
    message: 'Title must not start or end with a whitespace and cannot be only spaces',
  })
  title: string;
}
