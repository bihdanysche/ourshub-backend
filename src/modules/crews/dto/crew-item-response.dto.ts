import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CrewMemberRole } from '../enums/crew-member-role.enum';

export class CrewItemResponseDto {
  @ApiProperty({ description: 'Crew ID', example: 1 })
  id: number;

  @ApiProperty({ description: 'Crew title', example: 'Summer Trip' })
  title: string;

  @ApiPropertyOptional({ description: 'Avatar key', nullable: true })
  avatar: string | null;

  @ApiProperty({ description: 'Number of members', example: 4 })
  membersCount: number;

  @ApiProperty({ enum: CrewMemberRole, description: 'User role in crew' })
  role: CrewMemberRole;
}
