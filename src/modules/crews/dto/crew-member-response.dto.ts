import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CrewMemberRole } from '../enums/crew-member-role.enum';

export class CrewMemberResponseDto {
  @ApiProperty({ description: 'CrewMember record ID', example: 10 })
  id: number;

  @ApiProperty({ description: 'User ID', example: 5 })
  userId: number;

  @ApiProperty({ description: 'User name', example: 'Jane Doe' })
  name: string;

  @ApiPropertyOptional({ description: 'Username', nullable: true })
  username: string | null;

  @ApiPropertyOptional({ description: 'Avatar key', nullable: true })
  avatar: string | null;

  @ApiProperty({ enum: CrewMemberRole, description: 'Member role in crew' })
  role: CrewMemberRole;

  @ApiPropertyOptional({ description: 'Alias inside crew', nullable: true })
  alias: string | null;

  @ApiProperty({ description: 'Date joined' })
  joinedAt: Date;
}
