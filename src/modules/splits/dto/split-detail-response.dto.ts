import { SplitUserResponseDto } from './split-item-response.dto';

export class SplitMemberDetailDto {
  user: SplitUserResponseDto;
  paid: number;
  mustPay: number;
}

export class SplitExpenseDetailDto {
  id: number;
  title: string;
  desc: string | null;
  spender: SplitUserResponseDto;
  members: SplitMemberDetailDto[];
}

export class SplitDetailResponseDto {
  id: number;
  title: string;
  desc: string | null;
  archived: boolean;
  requestsCount: number;
  createdAt: Date;
  expenses: SplitExpenseDetailDto[];
}
