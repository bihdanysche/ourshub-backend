export class SessionResponseDto {
  id: number;
  ip: string;
  agent: string;
  location: string | null;
  createdAt: Date;
  lastUsedAt: Date;
  expiresAt: Date;
  isCurrent: boolean;
}
