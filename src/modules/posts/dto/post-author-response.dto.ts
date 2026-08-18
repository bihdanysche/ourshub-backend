import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PostAuthorResponseDto {
  @ApiProperty({ description: 'Author user ID', example: 1 })
  id: number;

  @ApiPropertyOptional({ description: 'Username', nullable: true })
  username: string | null;

  @ApiProperty({ description: 'Author name', example: 'Jane' })
  name: string;

  @ApiPropertyOptional({ description: 'Alias inside crew', nullable: true })
  alias: string | null;

  @ApiPropertyOptional({ description: 'Avatar key', nullable: true })
  avatar: string | null;
}
