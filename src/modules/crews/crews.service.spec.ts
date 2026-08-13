import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from 'src/prisma/prisma.service';
import { StorageService } from 'src/modules/storage/storage.service';
import { CREW_LIMITS } from './constants/crews.constants';
import { CrewsService } from './crews.service';
import { CrewMemberRole } from './enums/crew-member-role.enum';
import { CrewErrorCode } from './errors/crew-error.code.enum';

describe('CrewsService', () => {
  let service: CrewsService;

  const mockStorageService = {
    upload: jest.fn(),
    uploadBuffer: jest.fn().mockResolvedValue('key'),
    get: jest.fn(),
    delete: jest.fn().mockResolvedValue(undefined),
  };

  const mockPrismaService = {
    crew: {
      count: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    crewMember: {
      count: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    crewInvitationLink: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    splitMember: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    splitExpense: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    split: {
      count: jest.fn().mockResolvedValue(2),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CrewsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: StorageService, useValue: mockStorageService },
      ],
    }).compile();

    service = module.get<CrewsService>(CrewsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getCrews', () => {
    it('should return paginated crews for user', async () => {
      mockPrismaService.crew.count.mockResolvedValue(1);
      mockPrismaService.crew.findMany.mockResolvedValue([
        {
          id: 1,
          title: 'Night City Legends',
          avatar: 'https://avatar.png',
          members: [{ role: CrewMemberRole.OWNER }],
          _count: { members: 5 },
        },
      ]);

      const result = await service.getCrews(1, {
        page: 1,
        limit: 5,
        skip: 0,
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toEqual({
        id: 1,
        title: 'Night City Legends',
        avatar: 'https://avatar.png',
        membersCount: 5,
        role: CrewMemberRole.OWNER,
      });
      expect(result.meta).toEqual({
        page: 1,
        limit: 5,
        total: 1,
        totalPages: 1,
        hasNextPage: false,
        hasPrevPage: false,
      });
    });
  });

  describe('createCrew', () => {
    it('should throw USER_CREWS_LIMIT_REACHED if user is in max allowed crews', async () => {
      mockPrismaService.crewMember.count.mockResolvedValue(
        CREW_LIMITS.MAX_CREWS_PER_USER,
      );

      await expect(
        service.createCrew(1, { title: 'New Crew' }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.createCrew(1, { title: 'New Crew' }),
      ).rejects.toMatchObject({
        response: {
          error_code: CrewErrorCode.USER_CREWS_LIMIT_REACHED,
        },
      });
    });

    it('should create crew and invitation link in transaction', async () => {
      mockPrismaService.crewMember.count.mockResolvedValue(2);

      const createdCrew = {
        id: 10,
        title: 'Cyber Syndicate',
        avatar: null,
        cover: null,
        createdAt: new Date(),
      };

      const createdInvitation = {
        id: 1,
        crewId: 10,
        inviteCode: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
      };

      mockPrismaService.$transaction.mockImplementation(
        async (cb: (tx: typeof mockPrismaService) => Promise<unknown>) => {
          const tx = {
            crew: { create: jest.fn().mockResolvedValue(createdCrew) },
            crewMember: { create: jest.fn().mockResolvedValue({}) },
            crewInvitationLink: {
              create: jest.fn().mockResolvedValue(createdInvitation),
            },
          } as unknown as typeof mockPrismaService;
          return await cb(tx);
        },
      );

      const result = await service.createCrew(1, { title: 'Cyber Syndicate' });

      expect(result).toEqual({ ok: true });
    });
  });

  describe('getCrewById', () => {
    it('should throw CREW_NOT_FOUND if crew does not exist or user is not a member', async () => {
      mockPrismaService.crew.findUnique.mockResolvedValue(null);

      await expect(service.getCrewById(1, 99)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.getCrewById(1, 99)).rejects.toMatchObject({
        response: {
          error_code: CrewErrorCode.CREW_NOT_FOUND,
        },
      });
    });

    it('should return crew details with invite code for OWNER', async () => {
      const now = new Date();
      mockPrismaService.crew.findUnique.mockResolvedValue({
        id: 1,
        title: 'Crew One',
        avatar: 'https://avatar.png',
        cover: 'https://cover.png',
        createdAt: now,
        members: [{ role: CrewMemberRole.OWNER }],
        invitationLink: { inviteCode: 'uuid-1234' },
        _count: { members: 3 },
      });

      const result = await service.getCrewById(1, 1);

      expect(result).toEqual({
        id: 1,
        title: 'Crew One',
        avatar: 'https://avatar.png',
        cover: 'https://cover.png',
        membersCount: 3,
        activeSplitsCount: 2,
        role: CrewMemberRole.OWNER,
        inviteCode: 'uuid-1234',
        createdAt: now,
      });
    });

    it('should return crew details without invite code for MEMBER', async () => {
      const now = new Date();
      mockPrismaService.crew.findUnique.mockResolvedValue({
        id: 1,
        title: 'Crew One',
        avatar: null,
        cover: null,
        createdAt: now,
        members: [{ role: CrewMemberRole.MEMBER }],
        invitationLink: { inviteCode: 'uuid-1234' },
        _count: { members: 3 },
      });

      const result = await service.getCrewById(2, 1);

      expect(result.inviteCode).toBeNull();
      expect(result.role).toBe(CrewMemberRole.MEMBER);
    });
  });

  describe('getCrewMembers', () => {
    it('should throw CREW_NOT_FOUND if user is not member of crew', async () => {
      mockPrismaService.crewMember.findUnique.mockResolvedValue(null);

      await expect(
        service.getCrewMembers(1, 5, { page: 1, limit: 10, skip: 0 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should return paginated members', async () => {
      mockPrismaService.crewMember.findUnique.mockResolvedValue({ id: 1 });
      mockPrismaService.crewMember.count.mockResolvedValue(1);
      const joinedAt = new Date();
      mockPrismaService.crewMember.findMany.mockResolvedValue([
        {
          id: 1,
          crewId: 5,
          userId: 1,
          role: CrewMemberRole.OWNER,
          alias: 'Boss',
          joinedAt,
          user: {
            id: 1,
            name: 'Pavel',
            username: 'pavel',
            avatar: null,
          },
        },
      ]);

      const result = await service.getCrewMembers(1, 5, {
        page: 1,
        limit: 10,
        skip: 0,
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toEqual({
        id: 1,
        userId: 1,
        name: 'Pavel',
        username: 'pavel',
        avatar: null,
        role: CrewMemberRole.OWNER,
        alias: 'Boss',
        joinedAt,
      });
    });
  });

  describe('updateMemberAlias', () => {
    it('should throw CREW_NOT_FOUND if current user is not in crew', async () => {
      mockPrismaService.crewMember.findUnique.mockResolvedValue(null);

      await expect(
        service.updateMemberAlias(1, 5, 2, { alias: 'New' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw MEMBER_NOT_FOUND if target member is not in crew', async () => {
      mockPrismaService.crewMember.findUnique.mockResolvedValue({
        id: 1,
        role: CrewMemberRole.OWNER,
      });
      mockPrismaService.crewMember.findFirst.mockResolvedValue(null);

      await expect(
        service.updateMemberAlias(1, 5, 99, { alias: 'New' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw CANNOT_EDIT_OTHER_MEMBER_ALIAS if regular member tries to edit another user', async () => {
      mockPrismaService.crewMember.findUnique.mockResolvedValue({
        id: 1,
        userId: 1,
        role: CrewMemberRole.MEMBER,
      });
      mockPrismaService.crewMember.findFirst.mockResolvedValue({
        id: 2,
        userId: 2,
        role: CrewMemberRole.MEMBER,
      });

      await expect(
        service.updateMemberAlias(1, 5, 2, { alias: 'New' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow member to edit their own alias', async () => {
      mockPrismaService.crewMember.findUnique.mockResolvedValue({
        id: 1,
        userId: 1,
        role: CrewMemberRole.MEMBER,
      });
      mockPrismaService.crewMember.findFirst.mockResolvedValue({
        id: 1,
        userId: 1,
        role: CrewMemberRole.MEMBER,
      });
      mockPrismaService.crewMember.update.mockResolvedValue({});

      const result = await service.updateMemberAlias(1, 5, 1, {
        alias: 'SelfAlias',
      });

      expect(mockPrismaService.crewMember.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { alias: 'SelfAlias' },
      });
      expect(result).toEqual({ ok: true });
    });

    it('should allow owner to edit any member alias', async () => {
      mockPrismaService.crewMember.findUnique.mockResolvedValue({
        id: 1,
        userId: 1,
        role: CrewMemberRole.OWNER,
      });
      mockPrismaService.crewMember.findFirst.mockResolvedValue({
        id: 2,
        userId: 2,
        role: CrewMemberRole.MEMBER,
      });
      mockPrismaService.crewMember.update.mockResolvedValue({});

      const result = await service.updateMemberAlias(1, 5, 2, {
        alias: 'AssignedAlias',
      });

      expect(mockPrismaService.crewMember.update).toHaveBeenCalledWith({
        where: { id: 2 },
        data: { alias: 'AssignedAlias' },
      });
      expect(result).toEqual({ ok: true });
    });
  });

  describe('removeMember', () => {
    it('should throw CANNOT_LEAVE_AS_OWNER if owner attempts self-leave', async () => {
      mockPrismaService.crewMember.findUnique.mockResolvedValue({
        id: 1,
        userId: 1,
        role: CrewMemberRole.OWNER,
      });
      mockPrismaService.crewMember.findFirst.mockResolvedValue({
        id: 1,
        userId: 1,
        role: CrewMemberRole.OWNER,
      });

      await expect(service.removeMember(1, 5, 1)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.removeMember(1, 5, 1)).rejects.toMatchObject({
        response: {
          error_code: CrewErrorCode.CANNOT_LEAVE_AS_OWNER,
        },
      });
    });

    it('should allow regular member to self-leave', async () => {
      mockPrismaService.crewMember.findUnique.mockResolvedValue({
        id: 2,
        userId: 2,
        role: CrewMemberRole.MEMBER,
      });
      mockPrismaService.crewMember.findFirst.mockResolvedValue({
        id: 2,
        userId: 2,
        role: CrewMemberRole.MEMBER,
      });
      mockPrismaService.crewMember.delete.mockResolvedValue({});

      const result = await service.removeMember(2, 5, 2);

      expect(mockPrismaService.crewMember.delete).toHaveBeenCalledWith({
        where: { id: 2 },
      });
      expect(result).toEqual({ ok: true });
    });

    it('should throw ONLY_OWNER_CAN_KICK_MEMBERS if regular member tries to kick another member', async () => {
      mockPrismaService.crewMember.findUnique.mockResolvedValue({
        id: 2,
        userId: 2,
        role: CrewMemberRole.MEMBER,
      });
      mockPrismaService.crewMember.findFirst.mockResolvedValue({
        id: 3,
        userId: 3,
        role: CrewMemberRole.MEMBER,
      });

      await expect(service.removeMember(2, 5, 3)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should allow owner to kick another member', async () => {
      mockPrismaService.crewMember.findUnique.mockResolvedValue({
        id: 1,
        userId: 1,
        role: CrewMemberRole.OWNER,
      });
      mockPrismaService.crewMember.findFirst.mockResolvedValue({
        id: 3,
        userId: 3,
        role: CrewMemberRole.MEMBER,
      });
      mockPrismaService.crewMember.delete.mockResolvedValue({});

      const result = await service.removeMember(1, 5, 3);

      expect(mockPrismaService.crewMember.delete).toHaveBeenCalledWith({
        where: { id: 3 },
      });
      expect(result).toEqual({ ok: true });
    });
  });

  describe('updateCrew', () => {
    it('should throw CREW_NOT_FOUND if current user is not in crew', async () => {
      mockPrismaService.crewMember.findUnique.mockResolvedValue(null);

      await expect(
        service.updateCrew(1, 5, { title: 'Updated Title' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ONLY_OWNER_CAN_UPDATE_CREW if member is not owner', async () => {
      mockPrismaService.crewMember.findUnique.mockResolvedValue({
        id: 2,
        userId: 2,
        role: CrewMemberRole.MEMBER,
      });

      await expect(
        service.updateCrew(2, 5, { title: 'Updated Title' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow owner to update crew title', async () => {
      mockPrismaService.crewMember.findUnique.mockResolvedValue({
        id: 1,
        userId: 1,
        role: CrewMemberRole.OWNER,
      });
      mockPrismaService.crew.update.mockResolvedValue({});

      const result = await service.updateCrew(1, 5, {
        title: 'New Cool Title',
      });

      expect(mockPrismaService.crew.update).toHaveBeenCalledWith({
        where: { id: 5 },
        data: { title: 'New Cool Title' },
      });
      expect(result).toEqual({ ok: true });
    });
  });

  describe('deleteCrew', () => {
    it('should throw ONLY_OWNER_CAN_DELETE_CREW if member is not owner', async () => {
      mockPrismaService.crewMember.findUnique.mockResolvedValue({
        id: 2,
        userId: 2,
        role: CrewMemberRole.MEMBER,
      });

      await expect(service.deleteCrew(2, 5)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should allow owner to delete crew', async () => {
      mockPrismaService.crewMember.findUnique.mockResolvedValue({
        id: 1,
        userId: 1,
        role: CrewMemberRole.OWNER,
      });
      mockPrismaService.crew.delete.mockResolvedValue({});

      const result = await service.deleteCrew(1, 5);

      expect(mockPrismaService.crew.delete).toHaveBeenCalledWith({
        where: { id: 5 },
      });
      expect(result).toEqual({ ok: true });
    });
  });

  describe('getInvitationPreview', () => {
    it('should throw INVITATION_NOT_FOUND if invitation code does not exist', async () => {
      mockPrismaService.crewInvitationLink.findUnique.mockResolvedValue(null);

      await expect(
        service.getInvitationPreview(1, 'invalid-uuid'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ALREADY_MEMBER if user is already member of the crew', async () => {
      mockPrismaService.crewInvitationLink.findUnique.mockResolvedValue({
        crewId: 5,
        crew: { id: 5, _count: { members: 3 } },
      });
      mockPrismaService.crewMember.findUnique.mockResolvedValue({ id: 1 });

      await expect(
        service.getInvitationPreview(1, 'valid-uuid'),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw CREW_IS_FULL if crew reached 15 members limit', async () => {
      mockPrismaService.crewInvitationLink.findUnique.mockResolvedValue({
        crewId: 5,
        crew: {
          id: 5,
          title: 'Full Crew',
          avatar: null,
          cover: null,
          _count: { members: CREW_LIMITS.MAX_MEMBERS_PER_CREW },
        },
      });
      mockPrismaService.crewMember.findUnique.mockResolvedValue(null);

      await expect(
        service.getInvitationPreview(1, 'valid-uuid'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should return preview info if valid', async () => {
      mockPrismaService.crewInvitationLink.findUnique.mockResolvedValue({
        crewId: 5,
        crew: {
          id: 5,
          title: 'Cool Crew',
          avatar: 'https://avatar.png',
          cover: null,
          _count: { members: 4 },
        },
      });
      mockPrismaService.crewMember.findUnique.mockResolvedValue(null);

      const result = await service.getInvitationPreview(1, 'valid-uuid');

      expect(result).toEqual({
        id: 5,
        title: 'Cool Crew',
        avatar: 'https://avatar.png',
        cover: null,
        membersCount: 4,
      });
    });
  });

  describe('joinCrewByInvite', () => {
    it('should throw USER_CREWS_LIMIT_REACHED if user has reached max crews', async () => {
      mockPrismaService.crewInvitationLink.findUnique.mockResolvedValue({
        crewId: 5,
        crew: { id: 5, _count: { members: 4 } },
      });
      mockPrismaService.crewMember.findUnique.mockResolvedValue(null);
      mockPrismaService.crewMember.count.mockResolvedValue(
        CREW_LIMITS.MAX_CREWS_PER_USER,
      );

      await expect(
        service.joinCrewByInvite(1, 'valid-uuid', {}),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw CREW_IS_FULL if crew is full', async () => {
      mockPrismaService.crewInvitationLink.findUnique.mockResolvedValue({
        crewId: 5,
        crew: {
          id: 5,
          _count: { members: CREW_LIMITS.MAX_MEMBERS_PER_CREW },
        },
      });
      mockPrismaService.crewMember.findUnique.mockResolvedValue(null);
      mockPrismaService.crewMember.count.mockResolvedValue(2);

      await expect(
        service.joinCrewByInvite(1, 'valid-uuid', {}),
      ).rejects.toThrow(BadRequestException);
    });

    it('should successfully join crew and return ok: true and crewId', async () => {
      mockPrismaService.crewInvitationLink.findUnique.mockResolvedValue({
        crewId: 5,
        crew: { id: 5, _count: { members: 4 } },
      });
      mockPrismaService.crewMember.findUnique.mockResolvedValue(null);
      mockPrismaService.crewMember.count.mockResolvedValue(2);
      mockPrismaService.crewMember.create.mockResolvedValue({});

      const result = await service.joinCrewByInvite(1, 'valid-uuid', {
        alias: 'NewAlias',
      });

      expect(mockPrismaService.crewMember.create).toHaveBeenCalledWith({
        data: {
          crewId: 5,
          userId: 1,
          role: CrewMemberRole.MEMBER,
          alias: 'NewAlias',
        },
      });
      expect(result).toEqual({ ok: true, crewId: 5 });
    });
  });

  describe('deleteCrewAvatar & deleteCrewCover', () => {
    it('should throw ForbiddenException if user is not crew owner', async () => {
      mockPrismaService.crewMember.findUnique.mockResolvedValue({
        crewId: 5,
        userId: 1,
        role: CrewMemberRole.MEMBER,
      });

      await expect(service.deleteCrewAvatar(1, 5)).rejects.toThrow(ForbiddenException);
      await expect(service.deleteCrewCover(1, 5)).rejects.toThrow(ForbiddenException);
    });

    it('should delete avatar if user is owner and avatar exists', async () => {
      mockPrismaService.crewMember.findUnique.mockResolvedValue({
        crewId: 5,
        userId: 1,
        role: CrewMemberRole.OWNER,
      });
      mockPrismaService.crew.findUnique.mockResolvedValue({
        id: 5,
        avatar: 'crews/avatars/5_old.png',
        cover: 'crews/covers/5_old.png',
      });
      mockPrismaService.crew.update.mockResolvedValue({});

      const resultAvatar = await service.deleteCrewAvatar(1, 5);
      expect(resultAvatar).toEqual({ ok: true });
      expect(mockStorageService.delete).toHaveBeenCalledWith('crews/avatars/5_old.png');

      const resultCover = await service.deleteCrewCover(1, 5);
      expect(resultCover).toEqual({ ok: true });
      expect(mockStorageService.delete).toHaveBeenCalledWith('crews/covers/5_old.png');
    });
  });
});
