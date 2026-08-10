export class UserEntity {
  id: number;
  tg_id: string;
  tg_sub: string;
  username: string | null;
  username_lower: string | null;
  name: string;
  avatar: string | null;
  createdAt: Date;
}
