import { CrewMemberRole } from '../enums/crew-member-role.enum';

export class CrewMemberEntity {
  id: number;
  crewId: number;
  userId: number;
  role: CrewMemberRole;
  alias: string | null;
  joinedAt: Date;
}
