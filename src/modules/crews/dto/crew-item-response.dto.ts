import { CrewMemberRole } from '../enums/crew-member-role.enum';

export class CrewItemResponseDto {
  id: number;
  title: string;
  avatar: string | null;
  membersCount: number;
  role: CrewMemberRole;
}
