import { CrewMemberRole } from '../enums/crew-member-role.enum';

export class CrewDetailResponseDto {
  id: number;
  title: string;
  avatar: string | null;
  cover: string | null;
  membersCount: number;
  activeSplitsCount: number;
  role: CrewMemberRole;
  inviteCode?: string | null;
  createdAt: Date;
}
