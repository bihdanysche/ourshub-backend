import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class EditProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(30)
  @Matches(/^(?!\s)[\s\S]*(?<!\s)$/, {
    message: 'Name must not start or end with a whitespace and cannot be only spaces',
  })
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(30)
  @Matches(/^[a-zA-Z][a-zA-Z0-9_.]{2,29}$/, {
    message:
      'Username must start with a latin letter and contain only latin letters, digits, underscores, or dots',
  })
  username?: string;
}
