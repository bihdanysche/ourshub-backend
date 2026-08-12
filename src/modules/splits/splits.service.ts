import { Injectable } from '@nestjs/common';
import { PaginatedResponseDto } from 'src/common/dto/pagination/paginated-response.dto';
import { AddExpenseMembersDto } from './dto/add-expense-members.dto';
import { AddExpenseDto } from './dto/add-expense.dto';
import { CreateExpenseRequestDto } from './dto/create-expense-request.dto';
import { CreateSplitDto } from './dto/create-split.dto';
import { ExpenseRequestItemResponseDto } from './dto/expense-request-item-response.dto';
import { GetExpenseRequestsQueryDto } from './dto/get-expense-requests-query.dto';
import { GetSplitHistoryQueryDto } from './dto/get-split-history-query.dto';
import { GetSplitsQueryDto } from './dto/get-splits-query.dto';
import { IncreaseItemDto } from './dto/increase-item.dto';
import { PayOffItemDto } from './dto/pay-off-item.dto';
import { RemoveExpenseMembersDto } from './dto/remove-expense-members.dto';
import { SplitDetailResponseDto } from './dto/split-detail-response.dto';
import { SplitHistoryItemResponseDto } from './dto/split-history-item-response.dto';
import { SplitItemResponseDto } from './dto/split-item-response.dto';
import { UpdateSplitDto } from './dto/update-split.dto';
import { SplitsManagementService } from './services/splits-management.service';
import { SplitsPaymentService } from './services/splits-payment.service';
import { SplitsQueryService } from './services/splits-query.service';

@Injectable()
export class SplitsService {
  constructor(
    private readonly queryService: SplitsQueryService,
    private readonly managementService: SplitsManagementService,
    private readonly paymentService: SplitsPaymentService,
  ) {}

  async getSplits(
    userId: number,
    crewId: number,
    query: GetSplitsQueryDto,
  ): Promise<PaginatedResponseDto<SplitItemResponseDto>> {
    return await this.queryService.getSplits(userId, crewId, query);
  }

  async createSplit(
    userId: number,
    crewId: number,
    dto: CreateSplitDto,
  ): Promise<{ ok: true }> {
    return await this.managementService.createSplit(userId, crewId, dto);
  }

  async getSplitById(
    userId: number,
    splitId: number,
  ): Promise<SplitDetailResponseDto> {
    return await this.queryService.getSplitById(userId, splitId);
  }

  async updateSplit(
    userId: number,
    splitId: number,
    dto: UpdateSplitDto,
  ): Promise<{ ok: true }> {
    return await this.managementService.updateSplit(userId, splitId, dto);
  }

  async archiveSplit(
    userId: number,
    splitId: number,
  ): Promise<{ ok: true }> {
    return await this.managementService.archiveSplit(userId, splitId);
  }

  async payOff(
    userId: number,
    splitId: number,
    expenseId: number,
    items: PayOffItemDto[],
  ): Promise<{ ok: true }> {
    return await this.paymentService.payOff(userId, splitId, expenseId, items);
  }

  async increase(
    userId: number,
    splitId: number,
    expenseId: number,
    items: IncreaseItemDto[],
  ): Promise<{ ok: true }> {
    return await this.paymentService.increase(
      userId,
      splitId,
      expenseId,
      items,
    );
  }

  async getHistory(
    userId: number,
    splitId: number,
    query: GetSplitHistoryQueryDto,
  ): Promise<PaginatedResponseDto<SplitHistoryItemResponseDto>> {
    return await this.queryService.getHistory(userId, splitId, query);
  }

  async addExpense(
    userId: number,
    splitId: number,
    dto: AddExpenseDto,
  ): Promise<{ ok: true }> {
    return await this.managementService.addExpense(userId, splitId, dto);
  }

  async addMembersToExpense(
    userId: number,
    splitId: number,
    expenseId: number,
    dto: AddExpenseMembersDto,
  ): Promise<{ ok: true }> {
    return await this.managementService.addMembersToExpense(
      userId,
      splitId,
      expenseId,
      dto,
    );
  }

  async deleteExpense(
    userId: number,
    splitId: number,
    expenseId: number,
  ): Promise<{ ok: true }> {
    return await this.managementService.deleteExpense(userId, splitId, expenseId);
  }

  async removeMembersFromExpense(
    userId: number,
    splitId: number,
    expenseId: number,
    dto: RemoveExpenseMembersDto,
  ): Promise<{ ok: true }> {
    return await this.managementService.removeMembersFromExpense(
      userId,
      splitId,
      expenseId,
      dto,
    );
  }

  async getExpenseRequests(
    userId: number,
    splitId: number,
    query: GetExpenseRequestsQueryDto,
  ): Promise<PaginatedResponseDto<ExpenseRequestItemResponseDto>> {
    return await this.queryService.getExpenseRequests(userId, splitId, query);
  }

  async createExpenseRequest(
    userId: number,
    splitId: number,
    expenseId: number,
    dto: CreateExpenseRequestDto,
  ): Promise<{ ok: true }> {
    return await this.paymentService.createExpenseRequest(
      userId,
      splitId,
      expenseId,
      dto,
    );
  }

  async cancelExpenseRequest(
    userId: number,
    splitId: number,
    expenseId: number,
    requestId: number,
  ): Promise<{ ok: true }> {
    return await this.paymentService.cancelExpenseRequest(
      userId,
      splitId,
      expenseId,
      requestId,
    );
  }

  async declineExpenseRequest(
    userId: number,
    splitId: number,
    expenseId: number,
    requestId: number,
  ): Promise<{ ok: true }> {
    return await this.paymentService.declineExpenseRequest(
      userId,
      splitId,
      expenseId,
      requestId,
    );
  }

  async acceptExpenseRequest(
    userId: number,
    splitId: number,
    expenseId: number,
    requestId: number,
  ): Promise<{ ok: true }> {
    return await this.paymentService.acceptExpenseRequest(
      userId,
      splitId,
      expenseId,
      requestId,
    );
  }
}
