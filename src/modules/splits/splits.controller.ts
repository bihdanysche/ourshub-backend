import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseArrayPipe,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { PaginatedResponseDto } from 'src/common/dto/pagination/paginated-response.dto';
import { AuthRequired } from 'src/modules/auth/decorators/auth-required.decorator';
import { CurrentUser } from 'src/modules/auth/decorators/current-user.decorator';
import { AddExpenseMembersDto } from './dto/add-expense-members.dto';
import { AddExpenseDto } from './dto/add-expense.dto';
import { CreateExpenseRequestDto } from './dto/create-expense-request.dto';
import { CreateSplitExpenseMemberDto } from './dto/create-split-expense-member.dto';
import { CreateSplitExpenseDto } from './dto/create-split-expense.dto';
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
import { SplitsService } from './splits.service';

@Controller('splits')
@AuthRequired()
export class SplitsController {
  constructor(private readonly splitsService: SplitsService) {}

  @Get('all/:crewId')
  async getSplits(
    @CurrentUser('id') userId: number,
    @Param('crewId', ParseIntPipe) crewId: number,
    @Query() query: GetSplitsQueryDto,
  ): Promise<PaginatedResponseDto<SplitItemResponseDto>> {
    return await this.splitsService.getSplits(userId, crewId, query);
  }

  @Post('create/:crewId')
  async createSplit(
    @CurrentUser('id') userId: number,
    @Param('crewId', ParseIntPipe) crewId: number,
    @Body() dto: CreateSplitDto,
  ): Promise<{ ok: true }> {
    return await this.splitsService.createSplit(userId, crewId, dto);
  }

  @Get(':splitId')
  async getSplitById(
    @CurrentUser('id') userId: number,
    @Param('splitId', ParseIntPipe) splitId: number,
  ): Promise<SplitDetailResponseDto> {
    return await this.splitsService.getSplitById(userId, splitId);
  }

  @Patch(':splitId')
  async updateSplit(
    @CurrentUser('id') userId: number,
    @Param('splitId', ParseIntPipe) splitId: number,
    @Body() dto: UpdateSplitDto,
  ): Promise<{ ok: true }> {
    return await this.splitsService.updateSplit(userId, splitId, dto);
  }

  @Delete(':splitId/archive')
  async archiveSplit(
    @CurrentUser('id') userId: number,
    @Param('splitId', ParseIntPipe) splitId: number,
  ): Promise<{ ok: true }> {
    return await this.splitsService.archiveSplit(userId, splitId);
  }

  @Put(':splitId/:expenseId/pay-off')
  async payOff(
    @CurrentUser('id') userId: number,
    @Param('splitId', ParseIntPipe) splitId: number,
    @Param('expenseId', ParseIntPipe) expenseId: number,
    @Body(new ParseArrayPipe({ items: PayOffItemDto })) items: PayOffItemDto[],
  ): Promise<{ ok: true }> {
    return await this.splitsService.payOff(userId, splitId, expenseId, items);
  }

  @Put(':splitId/:expenseId/increase')
  async increase(
    @CurrentUser('id') userId: number,
    @Param('splitId', ParseIntPipe) splitId: number,
    @Param('expenseId', ParseIntPipe) expenseId: number,
    @Body(new ParseArrayPipe({ items: IncreaseItemDto }))
    items: IncreaseItemDto[],
  ): Promise<{ ok: true }> {
    return await this.splitsService.increase(userId, splitId, expenseId, items);
  }

  @Get(':splitId/history')
  async getHistory(
    @CurrentUser('id') userId: number,
    @Param('splitId', ParseIntPipe) splitId: number,
    @Query() query: GetSplitHistoryQueryDto,
  ): Promise<PaginatedResponseDto<SplitHistoryItemResponseDto>> {
    return await this.splitsService.getHistory(userId, splitId, query);
  }

  @Post([':splitId/add-expensive', ':splitId/add-expense'])
  async addExpense(
    @CurrentUser('id') userId: number,
    @Param('splitId', ParseIntPipe) splitId: number,
    @Body() body: AddExpenseDto | CreateSplitExpenseDto[],
  ): Promise<{ ok: true }> {
    const dto: AddExpenseDto = Array.isArray(body)
      ? { expenses: body }
      : body;
    return await this.splitsService.addExpense(userId, splitId, dto);
  }

  @Post(':splitId/:expenseId/add-members')
  async addMembersToExpense(
    @CurrentUser('id') userId: number,
    @Param('splitId', ParseIntPipe) splitId: number,
    @Param('expenseId', ParseIntPipe) expenseId: number,
    @Body() body: AddExpenseMembersDto | CreateSplitExpenseMemberDto[],
  ): Promise<{ ok: true }> {
    const dto: AddExpenseMembersDto = Array.isArray(body)
      ? { members: body }
      : body;
    return await this.splitsService.addMembersToExpense(
      userId,
      splitId,
      expenseId,
      dto,
    );
  }

  @Get(':splitId/expense-requests')
  async getExpenseRequests(
    @CurrentUser('id') userId: number,
    @Param('splitId', ParseIntPipe) splitId: number,
    @Query() query: GetExpenseRequestsQueryDto,
  ): Promise<PaginatedResponseDto<ExpenseRequestItemResponseDto>> {
    return await this.splitsService.getExpenseRequests(userId, splitId, query);
  }

  @Post(':splitId/:expenseId/expense-request')
  async createExpenseRequest(
    @CurrentUser('id') userId: number,
    @Param('splitId', ParseIntPipe) splitId: number,
    @Param('expenseId', ParseIntPipe) expenseId: number,
    @Body() dto: CreateExpenseRequestDto,
  ): Promise<{ ok: true }> {
    return await this.splitsService.createExpenseRequest(
      userId,
      splitId,
      expenseId,
      dto,
    );
  }

  @Delete(':splitId/:expenseId/:expenseRequestId/decline')
  async declineExpenseRequest(
    @CurrentUser('id') userId: number,
    @Param('splitId', ParseIntPipe) splitId: number,
    @Param('expenseId', ParseIntPipe) expenseId: number,
    @Param('expenseRequestId', ParseIntPipe) requestId: number,
  ): Promise<{ ok: true }> {
    return await this.splitsService.declineExpenseRequest(
      userId,
      splitId,
      expenseId,
      requestId,
    );
  }

  @Post(':splitId/:expenseId/:expenseRequestId/accept')
  async acceptExpenseRequest(
    @CurrentUser('id') userId: number,
    @Param('splitId', ParseIntPipe) splitId: number,
    @Param('expenseId', ParseIntPipe) expenseId: number,
    @Param('expenseRequestId', ParseIntPipe) requestId: number,
  ): Promise<{ ok: true }> {
    return await this.splitsService.acceptExpenseRequest(
      userId,
      splitId,
      expenseId,
      requestId,
    );
  }

  @Delete(':splitId/:expenseId/remove-members')
  async removeMembersFromExpense(
    @CurrentUser('id') userId: number,
    @Param('splitId', ParseIntPipe) splitId: number,
    @Param('expenseId', ParseIntPipe) expenseId: number,
    @Body() body: RemoveExpenseMembersDto | number[],
  ): Promise<{ ok: true }> {
    const dto: RemoveExpenseMembersDto = Array.isArray(body)
      ? { userIds: body }
      : body;
    return await this.splitsService.removeMembersFromExpense(
      userId,
      splitId,
      expenseId,
      dto,
    );
  }

  @Delete(':splitId/:expenseId/:expenseRequestId')
  async cancelExpenseRequest(
    @CurrentUser('id') userId: number,
    @Param('splitId', ParseIntPipe) splitId: number,
    @Param('expenseId', ParseIntPipe) expenseId: number,
    @Param('expenseRequestId', ParseIntPipe) requestId: number,
  ): Promise<{ ok: true }> {
    return await this.splitsService.cancelExpenseRequest(
      userId,
      splitId,
      expenseId,
      requestId,
    );
  }

  @Delete(':splitId/:expenseId')
  async deleteExpense(
    @CurrentUser('id') userId: number,
    @Param('splitId', ParseIntPipe) splitId: number,
    @Param('expenseId', ParseIntPipe) expenseId: number,
  ): Promise<{ ok: true }> {
    return await this.splitsService.deleteExpense(userId, splitId, expenseId);
  }
}
