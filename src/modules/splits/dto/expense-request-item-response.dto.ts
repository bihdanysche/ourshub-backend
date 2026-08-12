import { SplitUserResponseDto } from './split-item-response.dto';

export class ExpenseRequestExpenseResponseDto {
  id: number;
  title: string;
  spender: SplitUserResponseDto;
}

export class ExpenseRequestSplitResponseDto {
  id: number;
  title: string;
}

export class ExpenseRequestItemResponseDto {
  id: number;
  amount: number;
  msg: string | null;
  createdAt: Date;
  user: SplitUserResponseDto;
  expense: ExpenseRequestExpenseResponseDto;
  split: ExpenseRequestSplitResponseDto;
}
