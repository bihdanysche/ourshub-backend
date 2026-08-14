import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { SPLIT_LIMITS } from '../constants/splits.constants';
import { AddExpenseMembersDto } from '../dto/add-expense-members.dto';
import { AddExpenseDto } from '../dto/add-expense.dto';
import { CreateSplitDto } from '../dto/create-split.dto';
import { RemoveExpenseMembersDto } from '../dto/remove-expense-members.dto';
import { UpdateSplitDto } from '../dto/update-split.dto';
import { SplitErrorCode } from '../errors/split-error.code.enum';
import { SplitsHelperService } from './splits-helper.service';

@Injectable()
export class SplitsManagementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly helper: SplitsHelperService,
  ) {}

  async createSplit(
    userId: number,
    crewId: number,
    dto: CreateSplitDto,
  ): Promise<{ ok: true }> {
    await this.helper.checkCrewMembership(userId, crewId);

    if (
      dto.expenses.length < SPLIT_LIMITS.MIN_EXPENSES ||
      dto.expenses.length > SPLIT_LIMITS.MAX_EXPENSES
    ) {
      throw new BadRequestException({
        error_code:
          dto.expenses.length < SPLIT_LIMITS.MIN_EXPENSES
            ? SplitErrorCode.MIN_EXPENSES_REQUIRED
            : SplitErrorCode.MAX_EXPENSES_REACHED,
      });
    }

    const allUserIdsInPayload: number[] = [];
    for (const exp of dto.expenses) {
      allUserIdsInPayload.push(exp.spender);
      for (const m of exp.members) {
        allUserIdsInPayload.push(m.user);
      }
    }
    await this.helper.validateCrewUsersExist(crewId, allUserIdsInPayload);

    for (const exp of dto.expenses) {
      const memberUserIds = exp.members.map((m) => m.user);
      if (new Set(memberUserIds).size !== memberUserIds.length) {
        throw new BadRequestException({
          error_code: SplitErrorCode.DUPLICATE_MEMBERS,
        });
      }

      const hasSpender = memberUserIds.includes(exp.spender);
      const effectiveMembersCount = hasSpender
        ? memberUserIds.length
        : memberUserIds.length + 1;

      if (effectiveMembersCount < SPLIT_LIMITS.MIN_MEMBERS_PER_EXPENSE) {
        throw new BadRequestException({
          error_code: SplitErrorCode.MIN_MEMBERS_REQUIRED,
        });
      }
    }

    await this.prisma.$transaction(async (tx) => {
      const split = await tx.split.create({
        data: {
          title: dto.title,
          desc: dto.desc ?? null,
          crewId,
        },
      });

      for (const expDto of dto.expenses) {
        const expense = await tx.splitExpense.create({
          data: {
            splitId: split.id,
            title: expDto.title,
            desc: expDto.desc ?? null,
            spenderId: expDto.spender,
          },
        });

        const membersToInsertMap = new Map<
          number,
          { paid: number; mustPay: number }
        >();

        for (const m of expDto.members) {
          membersToInsertMap.set(m.user, {
            paid: this.helper.roundMoney(m.paid),
            mustPay: this.helper.roundMoney(m.mustPay),
          });
        }

        if (!membersToInsertMap.has(expDto.spender)) {
          membersToInsertMap.set(expDto.spender, { paid: 0, mustPay: 0 });
        }

        const memberData = Array.from(membersToInsertMap.entries()).map(
          ([uId, vals]) => ({
            splitExpenseId: expense.id,
            userId: uId,
            paid: vals.paid,
            mustPay: vals.mustPay,
          }),
        );

        await tx.splitMember.createMany({
          data: memberData,
        });
      }
    });

    return { ok: true };
  }

  async updateSplit(
    userId: number,
    splitId: number,
    dto: UpdateSplitDto,
  ): Promise<{ ok: true }> {
    const { split } = await this.helper.checkSplitAccess(userId, splitId);

    if (split.archived) {
      throw new BadRequestException({
        error_code: SplitErrorCode.SPLIT_IS_ARCHIVED,
      });
    }

    await this.prisma.$transaction(async (tx) => {
      if (dto.title || dto.desc !== undefined) {
        await tx.split.update({
          where: { id: splitId },
          data: {
            title: dto.title,
            desc: dto.desc !== undefined ? dto.desc : undefined,
          },
        });
      }

      if (dto.expenses && dto.expenses.length > 0) {
        for (const expDto of dto.expenses) {
          const expense = split.expenses.find((e) => e.id === expDto.id);
          if (!expense) {
            throw new NotFoundException({
              error_code: SplitErrorCode.EXPENSE_NOT_FOUND,
            });
          }

          await tx.splitExpense.update({
            where: { id: expDto.id },
            data: {
              title: expDto.title,
              desc: expDto.desc !== undefined ? expDto.desc : undefined,
            },
          });
        }
      }
    });

    return { ok: true };
  }

  async archiveSplit(
    userId: number,
    splitId: number,
  ): Promise<{ ok: true }> {
    const { split } = await this.helper.checkSplitAccess(userId, splitId);

    if (split.archived) {
      throw new BadRequestException({
        error_code: SplitErrorCode.SPLIT_IS_ARCHIVED,
      });
    }

    await this.prisma.split.update({
      where: { id: splitId },
      data: { archived: true },
    });

    return { ok: true };
  }

  async addExpense(
    userId: number,
    splitId: number,
    dto: AddExpenseDto,
  ): Promise<{ ok: true }> {
    const { split } = await this.helper.checkSplitAccess(userId, splitId);

    if (split.archived) {
      throw new BadRequestException({
        error_code: SplitErrorCode.SPLIT_IS_ARCHIVED,
      });
    }

    const currentExpensesCount = split.expenses.length;
    if (
      currentExpensesCount + dto.expenses.length >
      SPLIT_LIMITS.MAX_EXPENSES
    ) {
      throw new BadRequestException({
        error_code: SplitErrorCode.MAX_EXPENSES_REACHED,
      });
    }

    const allUserIdsInPayload: number[] = [];
    for (const exp of dto.expenses) {
      allUserIdsInPayload.push(exp.spender);
      for (const m of exp.members) {
        allUserIdsInPayload.push(m.user);
      }
    }
    await this.helper.validateCrewUsersExist(split.crewId, allUserIdsInPayload);

    for (const exp of dto.expenses) {
      const memberUserIds = exp.members.map((m) => m.user);
      if (new Set(memberUserIds).size !== memberUserIds.length) {
        throw new BadRequestException({
          error_code: SplitErrorCode.DUPLICATE_MEMBERS,
        });
      }

      const hasSpender = memberUserIds.includes(exp.spender);
      const effectiveMembersCount = hasSpender
        ? memberUserIds.length
        : memberUserIds.length + 1;

      if (effectiveMembersCount < SPLIT_LIMITS.MIN_MEMBERS_PER_EXPENSE) {
        throw new BadRequestException({
          error_code: SplitErrorCode.MIN_MEMBERS_REQUIRED,
        });
      }
    }

    await this.prisma.$transaction(async (tx) => {
      for (const expDto of dto.expenses) {
        const expense = await tx.splitExpense.create({
          data: {
            splitId,
            title: expDto.title,
            desc: expDto.desc ?? null,
            spenderId: expDto.spender,
          },
        });

        const membersToInsertMap = new Map<
          number,
          { paid: number; mustPay: number }
        >();

        for (const m of expDto.members) {
          membersToInsertMap.set(m.user, {
            paid: this.helper.roundMoney(m.paid),
            mustPay: this.helper.roundMoney(m.mustPay),
          });
        }

        if (!membersToInsertMap.has(expDto.spender)) {
          membersToInsertMap.set(expDto.spender, { paid: 0, mustPay: 0 });
        }

        const memberData = Array.from(membersToInsertMap.entries()).map(
          ([uId, vals]) => ({
            splitExpenseId: expense.id,
            userId: uId,
            paid: vals.paid,
            mustPay: vals.mustPay,
          }),
        );

        await tx.splitMember.createMany({
          data: memberData,
        });
      }
    });

    return { ok: true };
  }

  async addMembersToExpense(
    userId: number,
    splitId: number,
    expenseId: number,
    dto: AddExpenseMembersDto,
  ): Promise<{ ok: true }> {
    const { split } = await this.helper.checkSplitAccess(userId, splitId);

    if (split.archived) {
      throw new BadRequestException({
        error_code: SplitErrorCode.SPLIT_IS_ARCHIVED,
      });
    }

    const expense = await this.prisma.splitExpense.findUnique({
      where: { id: expenseId },
      include: { members: true },
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

    const newMemberUserIds = dto.members.map((m) => m.user);
    if (new Set(newMemberUserIds).size !== newMemberUserIds.length) {
      throw new BadRequestException({
        error_code: SplitErrorCode.DUPLICATE_MEMBERS,
      });
    }

    await this.helper.validateCrewUsersExist(split.crewId, newMemberUserIds);

    const existingUserIds = new Set(expense.members.map((m) => m.userId));

    await this.prisma.$transaction(async (tx) => {
      for (const mDto of dto.members) {
        if (existingUserIds.has(mDto.user)) {
          throw new BadRequestException({
            error_code: SplitErrorCode.DUPLICATE_MEMBERS,
          });
        }

        await tx.splitMember.create({
          data: {
            splitExpenseId: expenseId,
            userId: mDto.user,
            paid: this.helper.roundMoney(mDto.paid),
            mustPay: this.helper.roundMoney(mDto.mustPay),
          },
        });
      }
    });

    return { ok: true };
  }

  async deleteExpense(
    userId: number,
    splitId: number,
    expenseId: number,
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

    if (split.expenses.length <= SPLIT_LIMITS.MIN_EXPENSES) {
      throw new BadRequestException({
        error_code: SplitErrorCode.MIN_EXPENSES_REQUIRED,
      });
    }

    await this.prisma.splitExpense.delete({
      where: { id: expenseId },
    });

    return { ok: true };
  }

  async removeMembersFromExpense(
    userId: number,
    splitId: number,
    expenseId: number,
    dto: RemoveExpenseMembersDto,
  ): Promise<{ ok: true }> {
    const { split } = await this.helper.checkSplitAccess(userId, splitId);

    if (split.archived) {
      throw new BadRequestException({
        error_code: SplitErrorCode.SPLIT_IS_ARCHIVED,
      });
    }

    const expense = await this.prisma.splitExpense.findUnique({
      where: { id: expenseId },
      include: { members: true },
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

    const toRemoveSet = new Set(dto.userIds);

    if (toRemoveSet.has(expense.spenderId)) {
      throw new BadRequestException({
        error_code: SplitErrorCode.CANNOT_REMOVE_SPENDER,
      });
    }

    const remainingMembersCount = expense.members.filter(
      (m) => !toRemoveSet.has(m.userId),
    ).length;

    if (remainingMembersCount < SPLIT_LIMITS.MIN_MEMBERS_PER_EXPENSE) {
      throw new BadRequestException({
        error_code: SplitErrorCode.MIN_MEMBERS_REQUIRED,
      });
    }

    await this.prisma.splitMember.deleteMany({
      where: {
        splitExpenseId: expenseId,
        userId: { in: dto.userIds },
      },
    });

    return { ok: true };
  }
}
