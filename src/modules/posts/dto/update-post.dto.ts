import { Transform, TransformFnParams } from 'class-transformer';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { POST_LIMITS } from '../constants/posts.constants';

export class UpdatePostDto {
  @IsString()
  @Transform(({ value }: TransformFnParams): string =>
    typeof value === 'string' ? value.trim() : String(value ?? ''),
  )
  @MinLength(POST_LIMITS.CONTENT_MIN_LENGTH)
  @MaxLength(POST_LIMITS.CONTENT_MAX_LENGTH)
  @Matches(/^(?!\s)[\s\S]*(?<!\s)$/, {
    message:
      'Content must not start or end with whitespace and cannot be only spaces',
  })
  content: string;
}
