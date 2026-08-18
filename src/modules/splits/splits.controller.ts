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
import { ApiCookieAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
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

@ApiTags('splits')
@ApiCookieAuth('access_token')
@Controller('splits')
@AuthRequired()
export class SplitsController {
  constructor(private readonly splitsService: SplitsService) {}

  @Get('all/:crewId')
  @ApiOperation({ summary: 'Get paginated splits for crew' })
  @ApiResponse({ status: 200, description: 'Paginated splits' })
  async getSplits(
    @CurrentUser('id') userId: number,
    @Param('crewId', ParseIntPipe) crewId: number,
    @Query() query: GetSplitsQueryDto,
  ): Promise<PaginatedResponseDto<SplitItemResponseDto>> {
    return await this.splitsService.getSplits(userId, crewId, query);
  }

  @Post('create/:crewId')
  @ApiOperation({ summary: 'Create a new split in crew' })
  @ApiResponse({ status: 201, description: 'Split created' })
  async createSplit(
    @CurrentUser('id') userId: number,
    @Param('crewId', ParseIntPipe) crewId: number,
    @Body() dto: CreateSplitDto,
  ): Promise<{ ok: true }> {
    return await this.splitsService.createSplit(userId, crewId, dto);
  }

  @Get(':splitId')
  @ApiOperation({ summary: 'Get split details by ID' })
  @ApiResponse({ status: 200, type: SplitDetailResponseDto })
  async getSplitById(
    @CurrentUser('id') userId: number,
    @Param('splitId', ParseIntPipe) splitId: number,
  ): Promise<SplitDetailResponseDto> {
    return await this.splitsService.getSplitById(userId, splitId);
  }

  @Patch(':splitId')
  @ApiOperation({ summary: 'Update split details' })
  @ApiResponse({ status: 200, description: 'Split updated' })
  async updateSplit(
    @CurrentUser('id') userId: number,
    @Param('splitId', ParseIntPipe) splitId: number,
    @Body() dto: UpdateSplitDto,
  ): Promise<{ ok: true }> {
    return await this.splitsService.updateSplit(userId, splitId, dto);
  }

  @Delete(':splitId/archive')
  @ApiOperation({ summary: 'Archive split (when fully settled)' })
  @ApiResponse({ status: 200, description: 'Split archived' })
  async archiveSplit(
    @CurrentUser('id') userId: number,
    @Param('splitId', ParseIntPipe) splitId: number,
  ): Promise<{ ok: true }> {
    return await this.splitsService.archiveSplit(userId, splitId);
  }

  @Put(':splitId/:expenseId/pay-off')
  @ApiOperation({ summary: 'Pay off debt for expense items (spender only)' })
  @ApiResponse({ status: 200, description: 'Payments processed' })
  async payOff(
    @CurrentUser('id') userId: number,
    @Param('splitId', ParseIntPipe) splitId: number,
    @Param('expenseId', ParseIntPipe) expenseId: number,
    @Body(new ParseArrayPipe({ items: PayOffItemDto })) items: PayOffItemDto[],
  ): Promise<{ ok: true }> {
    return await this.splitsService.payOff(userId, splitId, expenseId, items);
  }

  @Put(':splitId/:expenseId/increase')
  @ApiOperation({ summary: 'Increase member debt for expense (spender only)' })
  @ApiResponse({ status: 200, description: 'Debts updated' })
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
  @ApiOperation({ summary: 'Get split payment/increase history audit log' })
  @ApiResponse({ status: 200, description: 'Paginated split history' })
  async getHistory(
    @CurrentUser('id') userId: number,
    @Param('splitId', ParseIntPipe) splitId: number,
    @Query() query: GetSplitHistoryQueryDto,
  ): Promise<PaginatedResponseDto<SplitHistoryItemResponseDto>> {
    return await this.splitsService.getHistory(userId, splitId, query);
  }

  @Post([':splitId/add-expensive', ':splitId/add-expense'])
  @ApiOperation({ summary: 'Add new expense items to split' })
  @ApiResponse({ status: 201, description: 'Expenses added' })
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
  @ApiOperation({ summary: 'Add members to existing expense' })
  @ApiResponse({ status: 201, description: 'Members added' })
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
  @ApiOperation({ summary: 'Get payment requests for split' })
  @ApiResponse({ status: 200, description: 'Paginated expense requests' })
  async getExpenseRequests(
    @CurrentUser('id') userId: number,
    @Param('splitId', ParseIntPipe) splitId: number,
    @Query() query: GetExpenseRequestsQueryDto,
  ): Promise<PaginatedResponseDto<ExpenseRequestItemResponseDto>> {
    return await this.splitsService.getExpenseRequests(userId, splitId, query);
  }

  @Post(':splitId/:expenseId/expense-request')
  @ApiOperation({ summary: 'Create payment confirmation request (debtor)' })
  @ApiResponse({ status: 201, description: 'Expense request created' })
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
  @ApiOperation({ summary: 'Decline payment request (spender only)' })
  @ApiResponse({ status: 200, description: 'Request declined' })
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
  @ApiOperation({ summary: 'Accept payment request (spender only)' })
  @ApiResponse({ status: 200, description: 'Request accepted and payment applied' })
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
  @ApiOperation({ summary: 'Remove members from expense (spender only)' })
  @ApiResponse({ status: 200, description: 'Members removed from expense' })
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
  @ApiOperation({ summary: 'Cancel payment request (requester debtor only)' })
  @ApiResponse({ status: 200, description: 'Request canceled' })
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
  @ApiOperation({ summary: 'Delete expense item from split (spender only)' })
  @ApiResponse({ status: 200, description: 'Expense deleted' })
  async deleteExpense(
    @CurrentUser('id') userId: number,
    @Param('splitId', ParseIntPipe) splitId: number,
    @Param('expenseId', ParseIntPipe) expenseId: number,
  ): Promise<{ ok: true }> {
    return await this.splitsService.deleteExpense(userId, splitId, expenseId);
  }
}
