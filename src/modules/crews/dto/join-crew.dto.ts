import { Transform, TransformFnParams } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { CREW_LIMITS } from '../constants/crews.constants';

export class JoinCrewDto {
  @IsOptional()
  @Transform(({ value }: TransformFnParams): string | null => {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed.length === 0 ? null : trimmed;
    }
    return null;
  })
  @IsString()
  @MaxLength(CREW_LIMITS.ALIAS_MAX_LENGTH)
  alias?: string | null;
}
