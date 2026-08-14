import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from 'generated/prisma/client';
import { PaginatedResponseDto } from 'src/common/dto/pagination/paginated-response.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { ExpenseRequestItemResponseDto } from '../dto/expense-request-item-response.dto';
import {
  ExpenseRequestRoleFilter,
  GetExpenseRequestsQueryDto,
} from '../dto/get-expense-requests-query.dto';
import { GetSplitHistoryQueryDto } from '../dto/get-split-history-query.dto';
import { GetSplitsQueryDto } from '../dto/get-splits-query.dto';
import { SplitDetailResponseDto } from '../dto/split-detail-response.dto';
import { SplitHistoryItemResponseDto } from '../dto/split-history-item-response.dto';
import {
  SplitItemResponseDto,
  SplitUserResponseDto,
} from '../dto/split-item-response.dto';
import { SplitErrorCode } from '../errors/split-error.code.enum';
import { SplitsHelperService } from './splits-helper.service';

@Injectable()
export class SplitsQueryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly helper: SplitsHelperService,
  ) {}

  async getSplits(
    userId: number,
    crewId: number,
    query: GetSplitsQueryDto,
  ): Promise<PaginatedResponseDto<SplitItemResponseDto>> {
    const { isOwner } = await this.helper.checkCrewMembership(userId, crewId);

    const where: Prisma.SplitWhereInput = {
      crewId,
      archived: query.isArchived,
    };

    if (!isOwner) {
      where.expenses = {
        some: {
          members: {
            some: {
              userId,
            },
          },
        },
      };
    }

    const total = await this.prisma.split.count({ where });

    const splits = await this.prisma.split.findMany({
      where,
      include: {
        expenses: {
          include: {
            spender: {
              select: {
                id: true,
                name: true,
                username: true,
                avatar: true,
                crewMembers: {
                  where: { crewId },
                  select: { alias: true },
                },
              },
            },
            members: {
              select: {
                userId: true,
                paid: true,
                mustPay: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: query.skip,
      take: query.limit,
    });

    const items: SplitItemResponseDto[] = splits.map((split) => {
      const authorsMap = new Map<number, SplitUserResponseDto>();
      let totalPaid = 0;
      let totalMustPay = 0;

      for (const exp of split.expenses) {
        if (!authorsMap.has(exp.spender.id)) {
          authorsMap.set(exp.spender.id, {
            id: exp.spender.id,
            name: exp.spender.name,
            alias: exp.spender.crewMembers[0]?.alias ?? null,
            username: exp.spender.username,
            avatar: exp.spender.avatar,
          });
        }

        for (const m of exp.members) {
          totalPaid += m.paid;
          totalMustPay += m.mustPay;
        }
      }

      return {
        id: split.id,
        title: split.title,
        archived: split.archived,
        createdAt: split.createdAt,
        authors: Array.from(authorsMap.values()),
        totalPaid: this.helper.roundMoney(totalPaid),
        totalMustPay: this.helper.roundMoney(totalMustPay),
      };
    });

    const totalPages = Math.ceil(total / query.limit) || 1;

    return {
      items,
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages,
        hasNextPage: query.page < totalPages,
        hasPrevPage: query.page > 1,
      },
    };
  }

  async getSplitById(
    userId: number,
    splitId: number,
  ): Promise<SplitDetailResponseDto> {
    const { split } = await this.helper.checkSplitAccess(userId, splitId);

    const fullSplit = await this.prisma.split.findUnique({
      where: { id: splitId },
      include: {
        expenses: {
          include: {
            spender: {
              select: {
                id: true,
                name: true,
                username: true,
                avatar: true,
                crewMembers: {
                  where: { crewId: split.crewId },
                  select: { alias: true },
                },
              },
            },
            members: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    username: true,
                    avatar: true,
                    crewMembers: {
                      where: { crewId: split.crewId },
                      select: { alias: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!fullSplit) {
      throw new NotFoundException({
        error_code: SplitErrorCode.SPLIT_NOT_FOUND,
      });
    }

    const requestsCount = await this.prisma.expenseRequest.count({
      where: {
        expense: {
          splitId,
        },
        OR: [
          { userId },
          { expense: { spenderId: userId } },
        ],
      },
    });

    return {
      id: fullSplit.id,
      title: fullSplit.title,
      desc: fullSplit.desc,
      archived: fullSplit.archived,
      requestsCount,
      createdAt: fullSplit.createdAt,
      expenses: fullSplit.expenses.map((exp) => ({
        id: exp.id,
        title: exp.title,
        desc: exp.desc,
        spender: {
          id: exp.spender.id,
          name: exp.spender.name,
          alias: exp.spender.crewMembers[0]?.alias ?? null,
          username: exp.spender.username,
          avatar: exp.spender.avatar,
        },
        members: exp.members.map((m) => ({
          user: {
            id: m.user.id,
            name: m.user.name,
            alias: m.user.crewMembers[0]?.alias ?? null,
            username: m.user.username,
            avatar: m.user.avatar,
          },
          paid: this.helper.roundMoney(m.paid),
          mustPay: this.helper.roundMoney(m.mustPay),
        })),
      })),
    };
  }

  async getHistory(
    userId: number,
    splitId: number,
    query: GetSplitHistoryQueryDto,
  ): Promise<PaginatedResponseDto<SplitHistoryItemResponseDto>> {
    const { split } = await this.helper.checkSplitAccess(userId, splitId);

    const where: Prisma.ExpensePayHistoryWhereInput = { splitId };

    if (query.userId) {
      where.userId = query.userId;
    }

    if (query.q) {
      where.msg = { contains: query.q, mode: 'insensitive' };
    }

    const total = await this.prisma.expensePayHistory.count({ where });

    const histories = await this.prisma.expensePayHistory.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
            avatar: true,
            crewMembers: {
              where: { crewId: split.crewId },
              select: { alias: true },
            },
          },
        },
        splitExpense: {
          select: { title: true },
        },
        split: {
          select: { title: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: query.skip,
      take: query.limit,
    });

    const items: SplitHistoryItemResponseDto[] = histories.map((h) => ({
      id: h.id,
      type: h.type,
      user: {
        id: h.user.id,
        name: h.user.name,
        alias: h.user.crewMembers[0]?.alias ?? null,
        username: h.user.username,
        avatar: h.user.avatar,
      },
      amount: this.helper.roundMoney(h.amount),
      expenseTitle: h.splitExpense.title,
      splitTitle: h.split.title,
      msg: h.msg,
      procByRequest: h.procByRequest,
      createdAt: h.createdAt,
    }));

    const totalPages = Math.ceil(total / query.limit) || 1;

    return {
      items,
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages,
        hasNextPage: query.page < totalPages,
        hasPrevPage: query.page > 1,
      },
    };
  }

  async getExpenseRequests(
    userId: number,
    splitId: number,
    query: GetExpenseRequestsQueryDto,
  ): Promise<PaginatedResponseDto<ExpenseRequestItemResponseDto>> {
    const { split } = await this.helper.checkSplitAccess(userId, splitId);

    const where: Prisma.ExpenseRequestWhereInput = {
      expense: {
        splitId,
      },
    };

    if (query.userId) {
      where.userId = query.userId;
    }

    if (query.role === ExpenseRequestRoleFilter.AS_SPENDER) {
      where.expense = {
        splitId,
        spenderId: userId,
      };
    } else if (query.role === ExpenseRequestRoleFilter.AS_USER) {
      where.userId = userId;
    } else {
      // ALL: where user is either the requesting debtor or the expense spender
      where.OR = [
        { userId },
        { expense: { splitId, spenderId: userId } },
      ];
    }

    const total = await this.prisma.expenseRequest.count({ where });

    const requests = await this.prisma.expenseRequest.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
            avatar: true,
            crewMembers: {
              where: { crewId: split.crewId },
              select: { alias: true },
            },
          },
        },
        expense: {
          select: {
            id: true,
            title: true,
            spender: {
              select: {
                id: true,
                name: true,
                username: true,
                avatar: true,
                crewMembers: {
                  where: { crewId: split.crewId },
                  select: { alias: true },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: query.skip,
      take: query.limit,
    });

    const items: ExpenseRequestItemResponseDto[] = requests.map((req) => ({
      id: req.id,
      amount: this.helper.roundMoney(req.amount),
      msg: req.msg,
      createdAt: req.createdAt,
      user: {
        id: req.user.id,
        name: req.user.name,
        alias: req.user.crewMembers[0]?.alias ?? null,
        username: req.user.username,
        avatar: req.user.avatar,
      },
      expense: {
        id: req.expense.id,
        title: req.expense.title,
        spender: {
          id: req.expense.spender.id,
          name: req.expense.spender.name,
          alias: req.expense.spender.crewMembers[0]?.alias ?? null,
          username: req.expense.spender.username,
          avatar: req.expense.spender.avatar,
        },
      },
      split: {
        id: split.id,
        title: split.title,
      },
    }));

    const totalPages = Math.ceil(total / query.limit) || 1;

    return {
      items,
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages,
        hasNextPage: query.page < totalPages,
        hasPrevPage: query.page > 1,
      },
    };
  }
}
