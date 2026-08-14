import { ExpensePayHistoryType } from 'generated/prisma/client';
import { SplitUserResponseDto } from './split-item-response.dto';

export class SplitHistoryItemResponseDto {
  id: number;
  type: ExpensePayHistoryType;
  user: SplitUserResponseDto;
  amount: number;
  expenseTitle: string;
  splitTitle: string;
  msg: string | null;
  procByRequest: boolean;
  createdAt: Date;
}
