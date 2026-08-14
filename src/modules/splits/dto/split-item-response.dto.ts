export class SplitUserResponseDto {
  id: number;
  name: string;
  alias: string | null;
  username: string | null;
  avatar: string | null;
}

export class SplitItemResponseDto {
  id: number;
  title: string;
  archived: boolean;
  createdAt: Date;
  authors: SplitUserResponseDto[];
  totalPaid: number;
  totalMustPay: number;
}
