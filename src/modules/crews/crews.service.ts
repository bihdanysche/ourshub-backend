import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Prisma } from 'generated/prisma/client';
import { PaginatedResponseDto } from 'src/common/dto/pagination/paginated-response.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { CREW_LIMITS } from './constants/crews.constants';
import { CreateCrewDto } from './dto/create-crew.dto';
import { CrewDetailResponseDto } from './dto/crew-detail-response.dto';
import { CrewInvitationPreviewDto } from './dto/crew-invitation-preview.dto';
import { CrewItemResponseDto } from './dto/crew-item-response.dto';
import { CrewMemberResponseDto } from './dto/crew-member-response.dto';
import { GetCrewMembersQueryDto } from './dto/get-crew-members-query.dto';
import { GetCrewsQueryDto } from './dto/get-crews-query.dto';
import { JoinCrewDto } from './dto/join-crew.dto';
import { UpdateCrewDto } from './dto/update-crew.dto';
import { UpdateMemberAliasDto } from './dto/update-member-alias.dto';
import { CrewMemberRole } from './enums/crew-member-role.enum';
import { CrewErrorCode } from './errors/crew-error.code.enum';

@Injectable()
export class CrewsService {
  constructor(private readonly prisma: PrismaService) {}

  async getCrews(
    userId: number,
    query: GetCrewsQueryDto,
  ): Promise<PaginatedResponseDto<CrewItemResponseDto>> {
    const where = {
      members: {
        some: {
          userId,
        },
      },
    };

    const total = await this.prisma.crew.count({ where });

    const crews = await this.prisma.crew.findMany({
      where,
      include: {
        members: {
          where: { userId },
          select: { role: true },
        },
        _count: {
          select: { members: true },
        },
      },
      orderBy: { createdAt: 'asc' },
      skip: query.skip,
      take: query.limit,
    });

    const items: CrewItemResponseDto[] = crews.map((crew) => ({
      id: crew.id,
      title: crew.title,
      avatar: crew.avatar,
      membersCount: crew._count.members,
      role: (crew.members[0]?.role) ?? CrewMemberRole.MEMBER,
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

  async createCrew(
    userId: number,
    dto: CreateCrewDto,
  ): Promise<{ ok: true }> {
    const userCrewsCount = await this.prisma.crewMember.count({
      where: { userId },
    });

    if (userCrewsCount >= CREW_LIMITS.MAX_CREWS_PER_USER) {
      throw new BadRequestException({
        error_code: CrewErrorCode.USER_CREWS_LIMIT_REACHED,
      });
    }

    const inviteCode = randomUUID();

    await this.prisma.$transaction(async (tx) => {
      const crew = await tx.crew.create({
        data: {
          title: dto.title,
        },
      });

      await tx.crewMember.create({
        data: {
          crewId: crew.id,
          userId,
          role: CrewMemberRole.OWNER,
        },
      });

      await tx.crewInvitationLink.create({
        data: {
          crewId: crew.id,
          inviteCode,
        },
      });
    });

    return { ok: true };
  }

  async getCrewById(
    userId: number,
    crewId: number,
  ): Promise<CrewDetailResponseDto> {
    const crew = await this.prisma.crew.findUnique({
      where: { id: crewId },
      include: {
        members: {
          where: { userId },
          select: { role: true },
        },
        invitationLink: {
          select: { inviteCode: true },
        },
        _count: {
          select: { members: true },
        },
      },
    });

    if (!crew || crew.members.length === 0) {
      throw new NotFoundException({
        error_code: CrewErrorCode.CREW_NOT_FOUND,
      });
    }

    const currentMember = crew.members[0];
    const isOwner = currentMember.role === CrewMemberRole.OWNER;

    const splitWhere: Prisma.SplitWhereInput = {
      crewId,
      archived: false,
    };

    if (!isOwner) {
      splitWhere.expenses = {
        some: {
          members: {
            some: {
              userId,
            },
          },
        },
      };
    }

    const activeSplitsCount = await this.prisma.split.count({
      where: splitWhere,
    });

    return {
      id: crew.id,
      title: crew.title,
      avatar: crew.avatar,
      cover: crew.cover,
      membersCount: crew._count.members,
      activeSplitsCount,
      role: currentMember.role,
      inviteCode: isOwner ? (crew.invitationLink?.inviteCode ?? null) : null,
      createdAt: crew.createdAt,
    };
  }

  async getCrewMembers(
    userId: number,
    crewId: number,
    query: GetCrewMembersQueryDto,
  ): Promise<PaginatedResponseDto<CrewMemberResponseDto>> {
    const currentMember = await this.prisma.crewMember.findUnique({
      where: {
        crewId_userId: {
          crewId,
          userId,
        },
      },
    });

    if (!currentMember) {
      throw new NotFoundException({
        error_code: CrewErrorCode.CREW_NOT_FOUND,
      });
    }

    const where: any = { crewId };

    if (query.q) {
      where.OR = [
        { user: { name: { contains: query.q, mode: 'insensitive' } } },
        { user: { username: { contains: query.q, mode: 'insensitive' } } },
        { alias: { contains: query.q, mode: 'insensitive' } },
      ];
    }

    const total = await this.prisma.crewMember.count({ where });

    const members = await this.prisma.crewMember.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
            avatar: true,
          },
        },
      },
      orderBy: [{ role: 'desc' }, { joinedAt: 'asc' }],
      skip: query.skip,
      take: query.limit,
    });

    const items: CrewMemberResponseDto[] = members.map((member) => ({
      id: member.id,
      userId: member.user.id,
      name: member.user.name,
      username: member.user.username,
      avatar: member.user.avatar,
      role: member.role,
      alias: member.alias,
      joinedAt: member.joinedAt,
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

  async updateMemberAlias(
    userId: number,
    crewId: number,
    memberId: number,
    dto: UpdateMemberAliasDto,
  ): Promise<{ ok: true }> {
    const currentMember = await this.prisma.crewMember.findUnique({
      where: {
        crewId_userId: {
          crewId,
          userId,
        },
      },
    });

    if (!currentMember) {
      throw new NotFoundException({
        error_code: CrewErrorCode.CREW_NOT_FOUND,
      });
    }

    const targetMember = await this.prisma.crewMember.findFirst({
      where: {
        id: memberId,
        crewId,
      },
    });

    if (!targetMember) {
      throw new NotFoundException({
        error_code: CrewErrorCode.MEMBER_NOT_FOUND,
      });
    }

    const isOwner = currentMember.role === CrewMemberRole.OWNER;
    const isSelf = targetMember.userId === userId;

    if (!isOwner && !isSelf) {
      throw new ForbiddenException({
        error_code: CrewErrorCode.CANNOT_EDIT_OTHER_MEMBER_ALIAS,
      });
    }

    await this.prisma.crewMember.update({
      where: { id: targetMember.id },
      data: {
        alias: dto.alias ?? null,
      },
    });

    return { ok: true };
  }

  async removeMember(
    userId: number,
    crewId: number,
    memberId: number,
  ): Promise<{ ok: true }> {
    const currentMember = await this.prisma.crewMember.findUnique({
      where: {
        crewId_userId: {
          crewId,
          userId,
        },
      },
    });

    if (!currentMember) {
      throw new NotFoundException({
        error_code: CrewErrorCode.CREW_NOT_FOUND,
      });
    }

    const targetMember = await this.prisma.crewMember.findFirst({
      where: {
        id: memberId,
        crewId,
      },
    });

    if (!targetMember) {
      throw new NotFoundException({
        error_code: CrewErrorCode.MEMBER_NOT_FOUND,
      });
    }

    const isSelf = targetMember.userId === userId;
    const isOwner = currentMember.role === CrewMemberRole.OWNER;

    if (isSelf && targetMember.role === CrewMemberRole.OWNER) {
      throw new BadRequestException({
        error_code: CrewErrorCode.CANNOT_LEAVE_AS_OWNER,
      });
    }

    if (!isSelf && !isOwner) {
      throw new ForbiddenException({
        error_code: CrewErrorCode.ONLY_OWNER_CAN_KICK_MEMBERS,
      });
    }

    const activeSplitMembers = await this.prisma.splitMember.findMany({
      where: {
        userId: targetMember.userId,
        splitExpense: {
          split: {
            crewId,
            archived: false,
          },
        },
      },
      select: {
        paid: true,
        mustPay: true,
      },
    });

    const hasUnpaidDebt = activeSplitMembers.some(
      (sm) => Math.round(sm.paid * 100) < Math.round(sm.mustPay * 100),
    );

    const activeSpenderExpenses = await this.prisma.splitExpense.findMany({
      where: {
        spenderId: targetMember.userId,
        split: {
          crewId,
          archived: false,
        },
      },
      select: {
        members: {
          select: {
            paid: true,
            mustPay: true,
          },
        },
      },
    });

    const hasUncollectedSpenderDebt = activeSpenderExpenses.some((exp) =>
      exp.members.some(
        (sm) => Math.round(sm.paid * 100) < Math.round(sm.mustPay * 100),
      ),
    );

    if (hasUnpaidDebt || hasUncollectedSpenderDebt) {
      throw new BadRequestException({
        error_code: isSelf
          ? CrewErrorCode.CANNOT_LEAVE_WITH_UNPAID_SPLITS
          : CrewErrorCode.CANNOT_KICK_MEMBER_WITH_UNPAID_SPLITS,
      });
    }

    await this.prisma.crewMember.delete({
      where: { id: targetMember.id },
    });

    return { ok: true };
  }

  async updateCrew(
    userId: number,
    crewId: number,
    dto: UpdateCrewDto,
  ): Promise<{ ok: true }> {
    const currentMember = await this.prisma.crewMember.findUnique({
      where: {
        crewId_userId: {
          crewId,
          userId,
        },
      },
    });

    if (!currentMember) {
      throw new NotFoundException({
        error_code: CrewErrorCode.CREW_NOT_FOUND,
      });
    }

    if (currentMember.role !== CrewMemberRole.OWNER) {
      throw new ForbiddenException({
        error_code: CrewErrorCode.ONLY_OWNER_CAN_UPDATE_CREW,
      });
    }

    await this.prisma.crew.update({
      where: { id: crewId },
      data: {
        title: dto.title,
      },
    });

    return { ok: true };
  }

  async deleteCrew(userId: number, crewId: number): Promise<{ ok: true }> {
    const currentMember = await this.prisma.crewMember.findUnique({
      where: {
        crewId_userId: {
          crewId,
          userId,
        },
      },
    });

    if (!currentMember) {
      throw new NotFoundException({
        error_code: CrewErrorCode.CREW_NOT_FOUND,
      });
    }

    if (currentMember.role !== CrewMemberRole.OWNER) {
      throw new ForbiddenException({
        error_code: CrewErrorCode.ONLY_OWNER_CAN_DELETE_CREW,
      });
    }

    await this.prisma.crew.delete({
      where: { id: crewId },
    });

    return { ok: true };
  }

  async getInvitationPreview(
    userId: number,
    code: string,
  ): Promise<CrewInvitationPreviewDto> {
    const invite = await this.prisma.crewInvitationLink.findUnique({
      where: { inviteCode: code },
      include: {
        crew: {
          include: {
            _count: {
              select: { members: true },
            },
          },
        },
      },
    });

    if (!invite) {
      throw new NotFoundException({
        error_code: CrewErrorCode.INVITATION_NOT_FOUND,
      });
    }

    const isMember = await this.prisma.crewMember.findUnique({
      where: {
        crewId_userId: {
          crewId: invite.crewId,
          userId,
        },
      },
    });

    if (isMember) {
      throw new ConflictException({
        error_code: CrewErrorCode.ALREADY_MEMBER,
      });
    }

    if (invite.crew._count.members >= CREW_LIMITS.MAX_MEMBERS_PER_CREW) {
      throw new BadRequestException({
        error_code: CrewErrorCode.CREW_IS_FULL,
      });
    }

    return {
      id: invite.crew.id,
      title: invite.crew.title,
      avatar: invite.crew.avatar,
      cover: invite.crew.cover,
      membersCount: invite.crew._count.members,
    };
  }

  async joinCrewByInvite(
    userId: number,
    code: string,
    dto: JoinCrewDto,
  ): Promise<{ ok: true; crewId: number }> {
    const invite = await this.prisma.crewInvitationLink.findUnique({
      where: { inviteCode: code },
      include: {
        crew: {
          include: {
            _count: {
              select: { members: true },
            },
          },
        },
      },
    });

    if (!invite) {
      throw new NotFoundException({
        error_code: CrewErrorCode.INVITATION_NOT_FOUND,
      });
    }

    const isMember = await this.prisma.crewMember.findUnique({
      where: {
        crewId_userId: {
          crewId: invite.crewId,
          userId,
        },
      },
    });

    if (isMember) {
      throw new ConflictException({
        error_code: CrewErrorCode.ALREADY_MEMBER,
      });
    }

    const userCrewsCount = await this.prisma.crewMember.count({
      where: { userId },
    });

    if (userCrewsCount >= CREW_LIMITS.MAX_CREWS_PER_USER) {
      throw new BadRequestException({
        error_code: CrewErrorCode.USER_CREWS_LIMIT_REACHED,
      });
    }

    if (invite.crew._count.members >= CREW_LIMITS.MAX_MEMBERS_PER_CREW) {
      throw new BadRequestException({
        error_code: CrewErrorCode.CREW_IS_FULL,
      });
    }

    await this.prisma.crewMember.create({
      data: {
        crewId: invite.crewId,
        userId,
        role: CrewMemberRole.MEMBER,
        alias: dto.alias ?? null,
      },
    });

    return {
      ok: true,
      crewId: invite.crewId,
    };
  }
}
