import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SessionResponseDto {
  @ApiProperty({ description: 'Session ID', example: 101 })
  id: number;

  @ApiProperty({ description: 'IP address', example: '127.0.0.1' })
  ip: string;

  @ApiProperty({ description: 'User agent string' })
  agent: string;

  @ApiPropertyOptional({ description: 'GeoIP location', nullable: true })
  location: string | null;

  @ApiProperty({ description: 'Session creation timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Session last used timestamp' })
  lastUsedAt: Date;

  @ApiProperty({ description: 'Session expiration timestamp' })
  expiresAt: Date;

  @ApiProperty({ description: 'Whether this session is the active request session' })
  isCurrent: boolean;
}
