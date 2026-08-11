import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { CrewMemberRole } from 'src/modules/crews/enums/crew-member-role.enum';
import { PrismaService } from 'src/prisma/prisma.service';
import { PostErrorCode } from './errors/post-error.code.enum';
import { PostsService } from './posts.service';

describe('PostsService', () => {
  let service: PostsService;

  const mockPrismaService = {
    crewMember: {
      findUnique: jest.fn(),
    },
    post: {
      count: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PostsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<PostsService>(PostsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getPosts', () => {
    it('should throw CREW_NOT_FOUND if user is not a member of the crew', async () => {
      mockPrismaService.crewMember.findUnique.mockResolvedValue(null);

      await expect(
        service.getPosts(1, 10, { page: 1, limit: 20, skip: 0 }),
      ).rejects.toThrow(
        expect.objectContaining({
          response: { error_code: PostErrorCode.CREW_NOT_FOUND },
        }),
      );
    });

    it('should return paginated posts with author info and youIsAuthor flag', async () => {
      mockPrismaService.crewMember.findUnique.mockResolvedValue({
        crewId: 10,
        userId: 1,
        role: CrewMemberRole.MEMBER,
      });
      mockPrismaService.post.count.mockResolvedValue(1);

      const mockCreatedAt = new Date();
      const mockUpdatedAt = new Date();

      mockPrismaService.post.findMany.mockResolvedValue([
        {
          id: 100,
          crewId: 10,
          authorId: 1,
          content: 'Hello World',
          createdAt: mockCreatedAt,
          updatedAt: mockUpdatedAt,
          author: {
            id: 1,
            username: 'cyberpunk',
            name: 'V',
            avatar: 'https://avatar.png',
            crewMembers: [{ alias: 'Choom' }],
          },
        },
      ]);

      const result = await service.getPosts(1, 10, {
        page: 1,
        limit: 20,
        skip: 0,
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toEqual({
        id: 100,
        content: 'Hello World',
        youIsAuthor: true,
        author: {
          id: 1,
          username: 'cyberpunk',
          name: 'V',
          alias: 'Choom',
          avatar: 'https://avatar.png',
        },
        createdAt: mockCreatedAt,
        updatedAt: mockUpdatedAt,
      });
      expect(result.meta.total).toBe(1);
    });
  });

  describe('createPost', () => {
    it('should throw CREW_NOT_FOUND if user is not a member of the crew', async () => {
      mockPrismaService.crewMember.findUnique.mockResolvedValue(null);

      await expect(
        service.createPost(1, 10, { content: 'New Post' }),
      ).rejects.toThrow(
        expect.objectContaining({
          response: { error_code: PostErrorCode.CREW_NOT_FOUND },
        }),
      );
    });

    it('should create post and return ok: true', async () => {
      mockPrismaService.crewMember.findUnique.mockResolvedValue({
        crewId: 10,
        userId: 1,
        role: CrewMemberRole.MEMBER,
      });
      mockPrismaService.post.create.mockResolvedValue({ id: 100 });

      const result = await service.createPost(1, 10, { content: 'New Post' });

      expect(mockPrismaService.post.create).toHaveBeenCalledWith({
        data: {
          crewId: 10,
          authorId: 1,
          content: 'New Post',
        },
      });
      expect(result).toEqual({ ok: true });
    });
  });

  describe('updatePost', () => {
    it('should throw CREW_NOT_FOUND if user is not a member of the crew', async () => {
      mockPrismaService.crewMember.findUnique.mockResolvedValue(null);

      await expect(
        service.updatePost(1, 10, 100, { content: 'Updated Post' }),
      ).rejects.toThrow(
        expect.objectContaining({
          response: { error_code: PostErrorCode.CREW_NOT_FOUND },
        }),
      );
    });

    it('should throw POST_NOT_FOUND if post does not exist or belongs to another crew', async () => {
      mockPrismaService.crewMember.findUnique.mockResolvedValue({
        crewId: 10,
        userId: 1,
        role: CrewMemberRole.MEMBER,
      });
      mockPrismaService.post.findUnique.mockResolvedValue(null);

      await expect(
        service.updatePost(1, 10, 100, { content: 'Updated Post' }),
      ).rejects.toThrow(
        expect.objectContaining({
          response: { error_code: PostErrorCode.POST_NOT_FOUND },
        }),
      );
    });

    it('should throw ONLY_AUTHOR_CAN_EDIT_POST if user is not author', async () => {
      mockPrismaService.crewMember.findUnique.mockResolvedValue({
        crewId: 10,
        userId: 2,
        role: CrewMemberRole.OWNER,
      });
      mockPrismaService.post.findUnique.mockResolvedValue({
        id: 100,
        crewId: 10,
        authorId: 1,
        content: 'Original',
      });

      await expect(
        service.updatePost(2, 10, 100, { content: 'Updated Post' }),
      ).rejects.toThrow(
        expect.objectContaining({
          response: { error_code: PostErrorCode.ONLY_AUTHOR_CAN_EDIT_POST },
        }),
      );
    });

    it('should update post if user is author', async () => {
      mockPrismaService.crewMember.findUnique.mockResolvedValue({
        crewId: 10,
        userId: 1,
        role: CrewMemberRole.MEMBER,
      });
      mockPrismaService.post.findUnique.mockResolvedValue({
        id: 100,
        crewId: 10,
        authorId: 1,
        content: 'Original',
      });
      mockPrismaService.post.update.mockResolvedValue({ id: 100 });

      const result = await service.updatePost(1, 10, 100, {
        content: 'Updated Post',
      });

      expect(mockPrismaService.post.update).toHaveBeenCalledWith({
        where: { id: 100 },
        data: { content: 'Updated Post' },
      });
      expect(result).toEqual({ ok: true });
    });
  });

  describe('deletePost', () => {
    it('should throw CREW_NOT_FOUND if user is not a member of the crew', async () => {
      mockPrismaService.crewMember.findUnique.mockResolvedValue(null);

      await expect(service.deletePost(1, 10, 100)).rejects.toThrow(
        expect.objectContaining({
          response: { error_code: PostErrorCode.CREW_NOT_FOUND },
        }),
      );
    });

    it('should throw POST_NOT_FOUND if post does not exist', async () => {
      mockPrismaService.crewMember.findUnique.mockResolvedValue({
        crewId: 10,
        userId: 1,
        role: CrewMemberRole.MEMBER,
      });
      mockPrismaService.post.findUnique.mockResolvedValue(null);

      await expect(service.deletePost(1, 10, 100)).rejects.toThrow(
        expect.objectContaining({
          response: { error_code: PostErrorCode.POST_NOT_FOUND },
        }),
      );
    });

    it('should throw ONLY_AUTHOR_OR_OWNER_CAN_DELETE_POST if user is neither author nor owner', async () => {
      mockPrismaService.crewMember.findUnique.mockResolvedValue({
        crewId: 10,
        userId: 2,
        role: CrewMemberRole.MEMBER,
      });
      mockPrismaService.post.findUnique.mockResolvedValue({
        id: 100,
        crewId: 10,
        authorId: 1,
      });

      await expect(service.deletePost(2, 10, 100)).rejects.toThrow(
        expect.objectContaining({
          response: {
            error_code: PostErrorCode.ONLY_AUTHOR_OR_OWNER_CAN_DELETE_POST,
          },
        }),
      );
    });

    it('should allow post deletion if user is post author', async () => {
      mockPrismaService.crewMember.findUnique.mockResolvedValue({
        crewId: 10,
        userId: 1,
        role: CrewMemberRole.MEMBER,
      });
      mockPrismaService.post.findUnique.mockResolvedValue({
        id: 100,
        crewId: 10,
        authorId: 1,
      });
      mockPrismaService.post.delete.mockResolvedValue({ id: 100 });

      const result = await service.deletePost(1, 10, 100);

      expect(mockPrismaService.post.delete).toHaveBeenCalledWith({
        where: { id: 100 },
      });
      expect(result).toEqual({ ok: true });
    });

    it('should allow post deletion if user is crew owner even if not post author', async () => {
      mockPrismaService.crewMember.findUnique.mockResolvedValue({
        crewId: 10,
        userId: 2,
        role: CrewMemberRole.OWNER,
      });
      mockPrismaService.post.findUnique.mockResolvedValue({
        id: 100,
        crewId: 10,
        authorId: 1,
      });
      mockPrismaService.post.delete.mockResolvedValue({ id: 100 });

      const result = await service.deletePost(2, 10, 100);

      expect(mockPrismaService.post.delete).toHaveBeenCalledWith({
        where: { id: 100 },
      });
      expect(result).toEqual({ ok: true });
    });
  });
});
