import { BadRequestException, ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { UserEntity } from 'src/modules/auth/entities/user.entity';
import { PrismaService } from 'src/prisma/prisma.service';
import { MeErrorCode } from './errors/me-error.code.enum';
import { MeService } from './me.service';

describe('MeService', () => {
  let service: MeService;
  let prisma: PrismaService;

  const mockUser: UserEntity = {
    id: 1,
    tg_id: 123456,
    tg_sub: 'tg_sub_1',
    name: 'Original Name',
    avatar: 'https://avatar.png',
    username: 'original_user',
    username_lower: 'original_user',
    createdAt: new Date(),
  };

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MeService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<MeService>(MeService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('editProfile', () => {
    it('should throw BadRequestException EMPTY_UPDATE_PAYLOAD if no fields are provided', async () => {
      await expect(service.editProfile(mockUser, {})).rejects.toThrow(
        BadRequestException,
      );

      await expect(service.editProfile(mockUser, {})).rejects.toMatchObject({
        response: {
          error_code: MeErrorCode.EMPTY_UPDATE_PAYLOAD,
        },
      });
    });

    it('should update name only', async () => {
      const updatedUser = { ...mockUser, name: 'New Name' };
      mockPrismaService.user.update.mockResolvedValue(updatedUser);

      const result = await service.editProfile(mockUser, { name: 'New Name' });

      expect(prisma.user.findUnique).not.toHaveBeenCalled();
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: { name: 'New Name' },
      });
      expect(result).toEqual({
        id: mockUser.id,
        username: mockUser.username,
        name: 'New Name',
        avatar: mockUser.avatar,
      });
    });

    it('should update username only and set username_lower', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      const updatedUser = {
        ...mockUser,
        username: 'New_User',
        username_lower: 'new_user',
      };
      mockPrismaService.user.update.mockResolvedValue(updatedUser);

      const result = await service.editProfile(mockUser, {
        username: 'New_User',
      });

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { username_lower: 'new_user' },
      });
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: {
          username: 'New_User',
          username_lower: 'new_user',
        },
      });
      expect(result.username).toBe('New_User');
    });

    it('should allow changing casing of own username without conflict', async () => {
      const updatedUser = {
        ...mockUser,
        username: 'Original_User',
        username_lower: 'original_user',
      };
      mockPrismaService.user.update.mockResolvedValue(updatedUser);

      const result = await service.editProfile(mockUser, {
        username: 'Original_User',
      });

      expect(prisma.user.findUnique).not.toHaveBeenCalled();
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: {
          username: 'Original_User',
          username_lower: 'original_user',
        },
      });
      expect(result.username).toBe('Original_User');
    });

    it('should throw ConflictException USERNAME_ALREADY_TAKEN if username is taken by another user', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 2,
        username: 'taken_user',
        username_lower: 'taken_user',
      });

      await expect(
        service.editProfile(mockUser, { username: 'Taken_User' }),
      ).rejects.toThrow(ConflictException);

      await expect(
        service.editProfile(mockUser, { username: 'Taken_User' }),
      ).rejects.toMatchObject({
        response: {
          error_code: MeErrorCode.USERNAME_ALREADY_TAKEN,
        },
      });
    });

    it('should update both name and username simultaneously', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      const updatedUser = {
        ...mockUser,
        name: 'Brand New Name',
        username: 'Brand_New_User',
        username_lower: 'brand_new_user',
      };
      mockPrismaService.user.update.mockResolvedValue(updatedUser);

      const result = await service.editProfile(mockUser, {
        name: 'Brand New Name',
        username: 'Brand_New_User',
      });

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: {
          name: 'Brand New Name',
          username: 'Brand_New_User',
          username_lower: 'brand_new_user',
        },
      });
      expect(result.name).toBe('Brand New Name');
      expect(result.username).toBe('Brand_New_User');
    });
  });
});
