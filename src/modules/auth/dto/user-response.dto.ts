import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UserResponseDto {
  @ApiProperty({ description: 'User ID', example: 1 })
  id: number;

  @ApiPropertyOptional({ description: 'Username', example: 'john_doe', nullable: true })
  username: string | null;

  @ApiProperty({ description: 'Full name', example: 'John Doe' })
  name: string;

  @ApiPropertyOptional({ description: 'Avatar storage key or URL', nullable: true })
  avatar: string | null;
}
