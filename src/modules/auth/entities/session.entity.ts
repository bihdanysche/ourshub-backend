export class SessionEntity {
  id: number;
  userId: number;
  ip: string;
  agent: string;
  location: string | null;
  createdAt: Date;
  lastUsedAt: Date;
  expiresAt: Date;
}
