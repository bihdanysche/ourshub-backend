import { Test, TestingModule } from '@nestjs/testing';
import { CrewMemberRole } from 'src/modules/crews/enums/crew-member-role.enum';
import { StorageService } from 'src/modules/storage/storage.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { PostErrorCode } from './errors/post-error.code.enum';
import { PostsService } from './posts.service';

describe('PostsService', () => {
  let service: PostsService;

  const mockStorageService = {
    upload: jest.fn(),
    uploadBuffer: jest.fn().mockResolvedValue('key'),
    get: jest.fn(),
    delete: jest.fn().mockResolvedValue(undefined),
  };

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
    postAttachment: {
      create: jest.fn(),
      findFirst: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PostsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: StorageService, useValue: mockStorageService },
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

      const promise = service.getPosts(1, 10, { page: 1, limit: 20, skip: 0 });
      await expect(promise).rejects.toMatchObject({
        response: { error_code: PostErrorCode.CREW_NOT_FOUND },
      });
    });

    it('should return paginated posts with author info, attachments, and youIsAuthor flag', async () => {
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
          attachments: [
            {
              id: 1,
              key: 'posts/attachments/100_abc_video.mp4',
              name: 'video.mp4',
              mimeType: 'video/mp4',
              size: 1024,
              createdAt: mockCreatedAt,
            },
          ],
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
        attachments: [
          {
            id: 1,
            key: 'posts/attachments/100_abc_video.mp4',
            name: 'video.mp4',
            mimeType: 'video/mp4',
            size: 1024,
            createdAt: mockCreatedAt,
          },
        ],
        createdAt: mockCreatedAt,
        updatedAt: mockUpdatedAt,
      });
      expect(result.meta.total).toBe(1);
    });
  });

  describe('createPost', () => {
    it('should throw CREW_NOT_FOUND if user is not a member of the crew', async () => {
      mockPrismaService.crewMember.findUnique.mockResolvedValue(null);

      const promise = service.createPost(1, 10, { content: 'Hello' });
      await expect(promise).rejects.toMatchObject({
        response: { error_code: PostErrorCode.CREW_NOT_FOUND },
      });
    });

    it('should throw ATTACHMENT_TOO_LARGE if file exceeds 200MB', async () => {
      mockPrismaService.crewMember.findUnique.mockResolvedValue({
        crewId: 10,
        userId: 1,
        role: CrewMemberRole.MEMBER,
      });

      const hugeFile = {
        originalname: 'big_video.mp4',
        mimetype: 'video/mp4',
        size: 201 * 1024 * 1024,
        buffer: Buffer.from('test'),
      } as Express.Multer.File;

      const promise = service.createPost(1, 10, { content: 'Hello' }, [hugeFile]);
      await expect(promise).rejects.toMatchObject({
        response: { error_code: PostErrorCode.ATTACHMENT_TOO_LARGE },
      });
    });

    it('should throw MAX_ATTACHMENTS_EXCEEDED if more than 15 files are attached', async () => {
      mockPrismaService.crewMember.findUnique.mockResolvedValue({
        crewId: 10,
        userId: 1,
        role: CrewMemberRole.MEMBER,
      });

      const files = Array.from({ length: 16 }, (_, i) => ({
        originalname: `file${i}.png`,
        mimetype: 'image/png',
        size: 100,
        buffer: Buffer.from('test'),
      })) as Express.Multer.File[];

      const promise = service.createPost(1, 10, { content: 'Hello' }, files);
      await expect(promise).rejects.toMatchObject({
        response: { error_code: PostErrorCode.MAX_ATTACHMENTS_EXCEEDED },
      });
    });

    it('should create post with attachments and return ok: true', async () => {
      mockPrismaService.crewMember.findUnique.mockResolvedValue({
        crewId: 10,
        userId: 1,
        role: CrewMemberRole.MEMBER,
      });
      mockPrismaService.post.create.mockResolvedValue({ id: 100 });
      mockPrismaService.postAttachment.create.mockResolvedValue({ id: 1 });

      const mockFile = {
        originalname: 'photo.jpg',
        mimetype: 'image/jpeg',
        size: 500,
        buffer: Buffer.from('test'),
      } as Express.Multer.File;

      const result = await service.createPost(1, 10, { content: 'New Post' }, [mockFile]);

      expect(mockPrismaService.post.create).toHaveBeenCalledWith({
        data: {
          crewId: 10,
          authorId: 1,
          content: 'New Post',
        },
      });
      expect(mockStorageService.uploadBuffer).toHaveBeenCalled();
      expect(mockPrismaService.postAttachment.create).toHaveBeenCalled();
      expect(result).toEqual({ ok: true });
    });
  });

  describe('updatePost', () => {
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
        attachments: [],
      });

      const promise = service.updatePost(2, 10, 100, { content: 'New text' });
      await expect(promise).rejects.toMatchObject({
        response: { error_code: PostErrorCode.ONLY_AUTHOR_CAN_EDIT_POST },
      });
    });

    it('should update post content if user is author', async () => {
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
        attachments: [],
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
    it('should allow post deletion and clean up attachments from storage', async () => {
      mockPrismaService.crewMember.findUnique.mockResolvedValue({
        crewId: 10,
        userId: 1,
        role: CrewMemberRole.MEMBER,
      });
      mockPrismaService.post.findUnique.mockResolvedValue({
        id: 100,
        crewId: 10,
        authorId: 1,
        attachments: [
          { id: 1, key: 'posts/attachments/100_key.mp4' },
        ],
      });
      mockPrismaService.post.delete.mockResolvedValue({ id: 100 });

      const result = await service.deletePost(1, 10, 100);

      expect(mockStorageService.delete).toHaveBeenCalledWith('posts/attachments/100_key.mp4');
      expect(mockPrismaService.post.delete).toHaveBeenCalledWith({
        where: { id: 100 },
      });
      expect(result).toEqual({ ok: true });
    });
  });

  describe('deletePostAttachment', () => {
    it('should throw ATTACHMENT_NOT_FOUND if attachment does not exist', async () => {
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
      mockPrismaService.postAttachment.findFirst.mockResolvedValue(null);

      const promise = service.deletePostAttachment(1, 10, 100, 999);
      await expect(promise).rejects.toMatchObject({
        response: { error_code: PostErrorCode.ATTACHMENT_NOT_FOUND },
      });
    });

    it('should delete attachment from storage and DB', async () => {
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
      mockPrismaService.postAttachment.findFirst.mockResolvedValue({
        id: 1,
        postId: 100,
        key: 'posts/attachments/100_att.png',
      });
      mockPrismaService.postAttachment.delete.mockResolvedValue({});

      const result = await service.deletePostAttachment(1, 10, 100, 1);

      expect(mockStorageService.delete).toHaveBeenCalledWith('posts/attachments/100_att.png');
      expect(mockPrismaService.postAttachment.delete).toHaveBeenCalledWith({
        where: { id: 1 },
      });
      expect(result).toEqual({ ok: true });
    });
  });
});
