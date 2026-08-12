import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateExpenseRequestDto } from '../dto/create-expense-request.dto';
import { IncreaseItemDto } from '../dto/increase-item.dto';
import { PayOffItemDto } from '../dto/pay-off-item.dto';
import { SplitErrorCode } from '../errors/split-error.code.enum';
import { SplitsHelperService } from './splits-helper.service';

@Injectable()
export class SplitsPaymentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly helper: SplitsHelperService,
  ) {}

  async payOff(
    userId: number,
    splitId: number,
    expenseId: number,
    items: PayOffItemDto[],
  ): Promise<{ ok: true }> {
    const { split } = await this.helper.checkSplitAccess(userId, splitId);

    if (split.archived) {
      throw new BadRequestException({
        error_code: SplitErrorCode.SPLIT_IS_ARCHIVED,
      });
    }

    const expense = await this.prisma.splitExpense.findUnique({
      where: { id: expenseId },
    });

    if (!expense || expense.splitId !== splitId) {
      throw new NotFoundException({
        error_code: SplitErrorCode.EXPENSE_NOT_FOUND,
      });
    }

    if (expense.spenderId !== userId) {
      throw new ForbiddenException({
        error_code: SplitErrorCode.ONLY_SPENDER_CAN_MODIFY,
      });
    }

    await this.prisma.$transaction(async (tx) => {
      for (const item of items) {
        if (item.amount <= 0) {
          throw new BadRequestException({
            error_code: SplitErrorCode.INVALID_AMOUNT,
          });
        }

        const member = await tx.splitMember.findUnique({
          where: {
            splitExpenseId_userId: {
              splitExpenseId: expenseId,
              userId: item.user,
            },
          },
        });

        if (!member) {
          throw new NotFoundException({
            error_code: SplitErrorCode.NOT_A_CREW_MEMBER,
          });
        }

        const newPaid = this.helper.roundMoney(member.paid + item.amount);
        if (newPaid > this.helper.roundMoney(member.mustPay)) {
          throw new BadRequestException({
            error_code: SplitErrorCode.PAYMENT_EXCEEDS_MUST_PAY,
          });
        }

        await tx.splitMember.update({
          where: { id: member.id },
          data: { paid: newPaid },
        });

        await tx.expensePayHistory.create({
          data: {
            splitId,
            splitExpenseId: expenseId,
            userId: item.user,
            amount: this.helper.roundMoney(item.amount),
            type: 'PAY',
            msg: item.msg ?? null,
            procByRequest: false,
          },
        });
      }
    });

    await this.helper.checkAndAutoArchive(splitId);

    return { ok: true };
  }

  async increase(
    userId: number,
    splitId: number,
    expenseId: number,
    items: IncreaseItemDto[],
  ): Promise<{ ok: true }> {
    const { split } = await this.helper.checkSplitAccess(userId, splitId);

    if (split.archived) {
      throw new BadRequestException({
        error_code: SplitErrorCode.SPLIT_IS_ARCHIVED,
      });
    }

    const expense = await this.prisma.splitExpense.findUnique({
      where: { id: expenseId },
    });

    if (!expense || expense.splitId !== splitId) {
      throw new NotFoundException({
        error_code: SplitErrorCode.EXPENSE_NOT_FOUND,
      });
    }

    if (expense.spenderId !== userId) {
      throw new ForbiddenException({
        error_code: SplitErrorCode.ONLY_SPENDER_CAN_MODIFY,
      });
    }

    await this.prisma.$transaction(async (tx) => {
      for (const item of items) {
        if (item.amount <= 0) {
          throw new BadRequestException({
            error_code: SplitErrorCode.INVALID_AMOUNT,
          });
        }

        const member = await tx.splitMember.findUnique({
          where: {
            splitExpenseId_userId: {
              splitExpenseId: expenseId,
              userId: item.user,
            },
          },
        });

        if (!member) {
          throw new NotFoundException({
            error_code: SplitErrorCode.NOT_A_CREW_MEMBER,
          });
        }

        const newMustPay = this.helper.roundMoney(member.mustPay + item.amount);

        await tx.splitMember.update({
          where: { id: member.id },
          data: { mustPay: newMustPay },
        });

        await tx.expensePayHistory.create({
          data: {
            splitId,
            splitExpenseId: expenseId,
            userId: item.user,
            amount: this.helper.roundMoney(item.amount),
            type: 'INC',
            msg: item.msg ?? null,
            procByRequest: false,
          },
        });
      }
    });

    return { ok: true };
  }

  async createExpenseRequest(
    userId: number,
    splitId: number,
    expenseId: number,
    dto: CreateExpenseRequestDto,
  ): Promise<{ ok: true }> {
    const { split } = await this.helper.checkSplitAccess(userId, splitId);

    if (split.archived) {
      throw new BadRequestException({
        error_code: SplitErrorCode.SPLIT_IS_ARCHIVED,
      });
    }

    const expense = await this.prisma.splitExpense.findUnique({
      where: { id: expenseId },
    });

    if (!expense || expense.splitId !== splitId) {
      throw new NotFoundException({
        error_code: SplitErrorCode.EXPENSE_NOT_FOUND,
      });
    }

    if (expense.spenderId === userId) {
      throw new ForbiddenException({
        error_code: SplitErrorCode.CANNOT_REQUEST_OWN_EXPENSE,
      });
    }

    const member = await this.prisma.splitMember.findUnique({
      where: {
        splitExpenseId_userId: {
          splitExpenseId: expenseId,
          userId,
        },
      },
    });

    if (!member) {
      throw new ForbiddenException({
        error_code: SplitErrorCode.NOT_SPLIT_MEMBER,
      });
    }

    const currentDebt = this.helper.roundMoney(member.mustPay - member.paid);

    const pendingRequests = await this.prisma.expenseRequest.findMany({
      where: {
        expenseId,
        userId,
      },
    });

    const pendingSum = pendingRequests.reduce(
      (sum, r) => sum + r.amount,
      0,
    );

    const remainingAvailableDebt = this.helper.roundMoney(
      currentDebt - pendingSum,
    );

    if (
      remainingAvailableDebt <= 0 ||
      this.helper.roundMoney(dto.amount) > remainingAvailableDebt
    ) {
      throw new BadRequestException({
        error_code: SplitErrorCode.REQUEST_AMOUNT_EXCEEDS_REMAINING_DEBT,
      });
    }

    await this.prisma.expenseRequest.create({
      data: {
        userId,
        expenseId,
        amount: this.helper.roundMoney(dto.amount),
        msg: dto.msg ?? null,
      },
    });

    return { ok: true };
  }

  async cancelExpenseRequest(
    userId: number,
    splitId: number,
    expenseId: number,
    requestId: number,
  ): Promise<{ ok: true }> {
    const { split } = await this.helper.checkSplitAccess(userId, splitId);

    if (split.archived) {
      throw new BadRequestException({
        error_code: SplitErrorCode.SPLIT_IS_ARCHIVED,
      });
    }

    const request = await this.prisma.expenseRequest.findUnique({
      where: { id: requestId },
    });

    if (!request || request.expenseId !== expenseId) {
      throw new NotFoundException({
        error_code: SplitErrorCode.REQUEST_NOT_FOUND,
      });
    }

    if (request.userId !== userId) {
      throw new ForbiddenException({
        error_code: SplitErrorCode.ONLY_REQUEST_USER_CAN_CANCEL,
      });
    }

    await this.prisma.expenseRequest.delete({
      where: { id: requestId },
    });

    return { ok: true };
  }

  async declineExpenseRequest(
    userId: number,
    splitId: number,
    expenseId: number,
    requestId: number,
  ): Promise<{ ok: true }> {
    const { split } = await this.helper.checkSplitAccess(userId, splitId);

    if (split.archived) {
      throw new BadRequestException({
        error_code: SplitErrorCode.SPLIT_IS_ARCHIVED,
      });
    }

    const request = await this.prisma.expenseRequest.findUnique({
      where: { id: requestId },
      include: { expense: true },
    });

    if (!request || request.expenseId !== expenseId) {
      throw new NotFoundException({
        error_code: SplitErrorCode.REQUEST_NOT_FOUND,
      });
    }

    if (request.expense.spenderId !== userId) {
      throw new ForbiddenException({
        error_code: SplitErrorCode.ONLY_SPENDER_CAN_MODIFY,
      });
    }

    await this.prisma.expenseRequest.delete({
      where: { id: requestId },
    });

    return { ok: true };
  }

  async acceptExpenseRequest(
    userId: number,
    splitId: number,
    expenseId: number,
    requestId: number,
  ): Promise<{ ok: true }> {
    const { split } = await this.helper.checkSplitAccess(userId, splitId);

    if (split.archived) {
      throw new BadRequestException({
        error_code: SplitErrorCode.SPLIT_IS_ARCHIVED,
      });
    }

    const request = await this.prisma.expenseRequest.findUnique({
      where: { id: requestId },
      include: { expense: true },
    });

    if (!request || request.expenseId !== expenseId) {
      throw new NotFoundException({
        error_code: SplitErrorCode.REQUEST_NOT_FOUND,
      });
    }

    if (request.expense.spenderId !== userId) {
      throw new ForbiddenException({
        error_code: SplitErrorCode.ONLY_SPENDER_CAN_MODIFY,
      });
    }

    await this.prisma.$transaction(async (tx) => {
      const member = await tx.splitMember.findUnique({
        where: {
          splitExpenseId_userId: {
            splitExpenseId: expenseId,
            userId: request.userId,
          },
        },
      });

      if (!member) {
        throw new NotFoundException({
          error_code: SplitErrorCode.NOT_A_CREW_MEMBER,
        });
      }

      const newPaid = this.helper.roundMoney(member.paid + request.amount);

      await tx.splitMember.update({
        where: { id: member.id },
        data: { paid: newPaid },
      });

      await tx.expenseRequest.delete({
        where: { id: requestId },
      });

      await tx.expensePayHistory.create({
        data: {
          splitId,
          splitExpenseId: expenseId,
          userId: request.userId,
          amount: this.helper.roundMoney(request.amount),
          type: 'PAY',
          msg: request.msg ?? null,
          procByRequest: true,
        },
      });
    });

    await this.helper.checkAndAutoArchive(splitId);

    return { ok: true };
  }
}
