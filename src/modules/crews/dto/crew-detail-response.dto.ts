import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CrewMemberRole } from '../enums/crew-member-role.enum';

export class CrewDetailResponseDto {
  @ApiProperty({ description: 'Crew ID', example: 1 })
  id: number;

  @ApiProperty({ description: 'Crew title', example: 'Summer Trip' })
  title: string;

  @ApiPropertyOptional({ description: 'Avatar image key', nullable: true })
  avatar: string | null;

  @ApiPropertyOptional({ description: 'Cover image key', nullable: true })
  cover: string | null;

  @ApiProperty({ description: 'Total count of crew members', example: 5 })
  membersCount: number;

  @ApiProperty({ description: 'Count of active splits', example: 2 })
  activeSplitsCount: number;

  @ApiProperty({ enum: CrewMemberRole, description: 'Role of the current user in crew' })
  role: CrewMemberRole;

  @ApiPropertyOptional({ description: 'Invitation UUID code (visible to owner)', nullable: true })
  inviteCode?: string | null;

  @ApiProperty({ description: 'Creation date' })
  createdAt: Date;
}
