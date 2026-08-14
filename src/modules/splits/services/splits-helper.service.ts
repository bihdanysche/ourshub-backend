import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from 'generated/prisma/client';
import { CrewMemberRole } from 'src/modules/crews/enums/crew-member-role.enum';
import { PrismaService } from 'src/prisma/prisma.service';
import { SplitErrorCode } from '../errors/split-error.code.enum';

export type SplitWithExpensesAndMembers = Prisma.SplitGetPayload<{
  include: {
    expenses: {
      include: {
        members: true;
      };
    };
  };
}>;

@Injectable()
export class SplitsHelperService {
  constructor(private readonly prisma: PrismaService) {}

  roundMoney(val: number): number {
    return Math.round(val * 100) / 100;
  }

  async checkCrewMembership(
    userId: number,
    crewId: number,
  ): Promise<{ isOwner: boolean }> {
    const member = await this.prisma.crewMember.findUnique({
      where: {
        crewId_userId: { crewId, userId },
      },
    });

    if (!member) {
      throw new NotFoundException({
        error_code: SplitErrorCode.CREW_NOT_FOUND,
      });
    }

    return { isOwner: member.role === CrewMemberRole.OWNER };
  }

  async checkSplitAccess(
    userId: number,
    splitId: number,
  ): Promise<{
    split: SplitWithExpensesAndMembers;
    isCrewOwner: boolean;
    isSplitMember: boolean;
  }> {
    const split = await this.prisma.split.findUnique({
      where: { id: splitId },
      include: {
        expenses: {
          include: {
            members: true,
          },
        },
      },
    });

    if (!split) {
      throw new NotFoundException({
        error_code: SplitErrorCode.SPLIT_NOT_FOUND,
      });
    }

    const { isOwner: isCrewOwner } = await this.checkCrewMembership(
      userId,
      split.crewId,
    );

    const isSplitMember = split.expenses.some((exp) =>
      exp.members.some((m) => m.userId === userId),
    );

    if (!isCrewOwner && !isSplitMember) {
      throw new ForbiddenException({
        error_code: SplitErrorCode.NOT_SPLIT_MEMBER,
      });
    }

    return { split, isCrewOwner, isSplitMember };
  }

  async validateCrewUsersExist(
    crewId: number,
    userIds: number[],
  ): Promise<void> {
    const uniqueIds = Array.from(new Set(userIds));
    const membersCount = await this.prisma.crewMember.count({
      where: {
        crewId,
        userId: { in: uniqueIds },
      },
    });

    if (membersCount !== uniqueIds.length) {
      throw new BadRequestException({
        error_code: SplitErrorCode.NOT_A_CREW_MEMBER,
      });
    }
  }

  async checkAndAutoArchive(splitId: number): Promise<void> {
    const split = await this.prisma.split.findUnique({
      where: { id: splitId },
      include: {
        expenses: {
          include: {
            members: true,
          },
        },
      },
    });

    if (!split || split.archived) return;

    let allPaid = true;
    for (const exp of split.expenses) {
      for (const m of exp.members) {
        if (this.roundMoney(m.paid) < this.roundMoney(m.mustPay)) {
          allPaid = false;
          break;
        }
      }
      if (!allPaid) break;
    }

    if (allPaid) {
      await this.prisma.split.update({
        where: { id: splitId },
        data: { archived: true },
      });
    }
  }
}
