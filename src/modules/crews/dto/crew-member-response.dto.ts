import { CrewMemberRole } from '../enums/crew-member-role.enum';

export class CrewMemberResponseDto {
  id: number;
  userId: number;
  name: string;
  username: string | null;
  avatar: string | null;
  role: CrewMemberRole;
  alias: string | null;
  joinedAt: Date;
}
