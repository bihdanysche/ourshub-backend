import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CrewInvitationPreviewDto {
  @ApiProperty({ description: 'Crew ID', example: 1 })
  id: number;

  @ApiProperty({ description: 'Crew title', example: 'Summer Trip' })
  title: string;

  @ApiPropertyOptional({ description: 'Avatar image key', nullable: true })
  avatar: string | null;

  @ApiPropertyOptional({ description: 'Cover image key', nullable: true })
  cover: string | null;

  @ApiProperty({ description: 'Members count', example: 5 })
  membersCount: number;
}
