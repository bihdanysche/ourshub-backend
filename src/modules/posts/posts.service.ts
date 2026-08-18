import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PaginatedResponseDto } from 'src/common/dto/pagination/paginated-response.dto';
import { CrewMemberRole } from 'src/modules/crews/enums/crew-member-role.enum';
import { StorageService } from 'src/modules/storage/storage.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { POST_LIMITS } from './constants/posts.constants';
import { CreatePostDto } from './dto/create-post.dto';
import { GetPostsQueryDto } from './dto/get-posts-query.dto';
import { PostItemResponseDto } from './dto/post-item-response.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { PostErrorCode } from './errors/post-error.code.enum';

@Injectable()
export class PostsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
  ) {}

  async getPosts(
    userId: number,
    crewId: number,
    query: GetPostsQueryDto,
  ): Promise<PaginatedResponseDto<PostItemResponseDto>> {
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
        error_code: PostErrorCode.CREW_NOT_FOUND,
      });
    }

    const total = await this.prisma.post.count({
      where: { crewId },
    });

    const posts = await this.prisma.post.findMany({
      where: { crewId },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            name: true,
            avatar: true,
            crewMembers: {
              where: { crewId },
              select: { alias: true },
            },
          },
        },
        attachments: {
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: query.skip,
      take: query.limit,
    });

    const items: PostItemResponseDto[] = posts.map((post) => ({
      id: post.id,
      content: post.content,
      youIsAuthor: post.authorId === userId,
      author: {
        id: post.author.id,
        username: post.author.username,
        name: post.author.name,
        alias: post.author.crewMembers[0]?.alias ?? null,
        avatar: post.author.avatar,
      },
      attachments: post.attachments.map((att) => ({
        id: att.id,
        key: att.key,
        name: att.name,
        mimeType: att.mimeType,
        size: att.size,
        createdAt: att.createdAt,
      })),
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
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

  async createPost(
    userId: number,
    crewId: number,
    dto: CreatePostDto,
    files?: Express.Multer.File[],
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
        error_code: PostErrorCode.CREW_NOT_FOUND,
      });
    }

    if (files && files.length > 0) {
      if (files.length > POST_LIMITS.MAX_ATTACHMENTS_PER_POST) {
        throw new BadRequestException({
          error_code: PostErrorCode.MAX_ATTACHMENTS_EXCEEDED,
        });
      }

      for (const file of files) {
        if (file.size > POST_LIMITS.MAX_ATTACHMENT_SIZE_BYTES) {
          throw new BadRequestException({
            error_code: PostErrorCode.ATTACHMENT_TOO_LARGE,
          });
        }
      }
    }

    const post = await this.prisma.post.create({
      data: {
        crewId,
        authorId: userId,
        content: dto.content,
      },
    });

    if (files && files.length > 0) {
      await this.processAttachments(post.id, files);
    }

    return { ok: true };
  }

  async updatePost(
    userId: number,
    crewId: number,
    postId: number,
    dto: UpdatePostDto,
    files?: Express.Multer.File[],
    removeAttachmentIds?: number[],
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
        error_code: PostErrorCode.CREW_NOT_FOUND,
      });
    }

    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      include: { attachments: true },
    });

    if (!post || post.crewId !== crewId) {
      throw new NotFoundException({
        error_code: PostErrorCode.POST_NOT_FOUND,
      });
    }

    if (post.authorId !== userId) {
      throw new ForbiddenException({
        error_code: PostErrorCode.ONLY_AUTHOR_CAN_EDIT_POST,
      });
    }

    let remainingAttachments = post.attachments;

    if (removeAttachmentIds && removeAttachmentIds.length > 0) {
      const idsToRemove = new Set(removeAttachmentIds);
      const attachmentsToDelete = post.attachments.filter((att) =>
        idsToRemove.has(att.id),
      );

      for (const att of attachmentsToDelete) {
        await this.storageService.delete(att.key);
      }

      await this.prisma.postAttachment.deleteMany({
        where: {
          id: { in: Array.from(idsToRemove) },
          postId,
        },
      });

      remainingAttachments = post.attachments.filter(
        (att) => !idsToRemove.has(att.id),
      );
    }

    const newFilesCount = files ? files.length : 0;
    if (
      remainingAttachments.length + newFilesCount >
      POST_LIMITS.MAX_ATTACHMENTS_PER_POST
    ) {
      throw new BadRequestException({
        error_code: PostErrorCode.MAX_ATTACHMENTS_EXCEEDED,
      });
    }

    if (files && files.length > 0) {
      for (const file of files) {
        if (file.size > POST_LIMITS.MAX_ATTACHMENT_SIZE_BYTES) {
          throw new BadRequestException({
            error_code: PostErrorCode.ATTACHMENT_TOO_LARGE,
          });
        }
      }
    }

    await this.prisma.post.update({
      where: { id: postId },
      data: {
        content: dto.content,
      },
    });

    if (files && files.length > 0) {
      await this.processAttachments(post.id, files);
    }

    return { ok: true };
  }

  async deletePost(
    userId: number,
    crewId: number,
    postId: number,
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
        error_code: PostErrorCode.CREW_NOT_FOUND,
      });
    }

    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      include: { attachments: true },
    });

    if (!post || post.crewId !== crewId) {
      throw new NotFoundException({
        error_code: PostErrorCode.POST_NOT_FOUND,
      });
    }

    const isAuthor = post.authorId === userId;
    const isOwner = currentMember.role === CrewMemberRole.OWNER;

    if (!isAuthor && !isOwner) {
      throw new ForbiddenException({
        error_code: PostErrorCode.ONLY_AUTHOR_OR_OWNER_CAN_DELETE_POST,
      });
    }

    for (const att of post.attachments) {
      await this.storageService.delete(att.key);
    }

    await this.prisma.post.delete({
      where: { id: postId },
    });

    return { ok: true };
  }

  async uploadPostAttachments(
    userId: number,
    crewId: number,
    postId: number,
    files: Express.Multer.File[],
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
        error_code: PostErrorCode.CREW_NOT_FOUND,
      });
    }

    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      include: { attachments: true },
    });

    if (!post || post.crewId !== crewId) {
      throw new NotFoundException({
        error_code: PostErrorCode.POST_NOT_FOUND,
      });
    }

    if (post.authorId !== userId) {
      throw new ForbiddenException({
        error_code: PostErrorCode.ONLY_AUTHOR_CAN_EDIT_POST,
      });
    }

    if (!files || files.length === 0) {
      return { ok: true };
    }

    if (
      post.attachments.length + files.length >
      POST_LIMITS.MAX_ATTACHMENTS_PER_POST
    ) {
      throw new BadRequestException({
        error_code: PostErrorCode.MAX_ATTACHMENTS_EXCEEDED,
      });
    }

    for (const file of files) {
      if (file.size > POST_LIMITS.MAX_ATTACHMENT_SIZE_BYTES) {
        throw new BadRequestException({
          error_code: PostErrorCode.ATTACHMENT_TOO_LARGE,
        });
      }
    }

    if (files && files.length > 0) {
      await this.processAttachments(post.id, files);
    }

    return { ok: true };
  }

  async deletePostAttachment(
    userId: number,
    crewId: number,
    postId: number,
    attachmentId: number,
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
        error_code: PostErrorCode.CREW_NOT_FOUND,
      });
    }

    const post = await this.prisma.post.findUnique({
      where: { id: postId },
    });

    if (!post || post.crewId !== crewId) {
      throw new NotFoundException({
        error_code: PostErrorCode.POST_NOT_FOUND,
      });
    }

    const isAuthor = post.authorId === userId;
    const isOwner = currentMember.role === CrewMemberRole.OWNER;

    if (!isAuthor && !isOwner) {
      throw new ForbiddenException({
        error_code: PostErrorCode.ONLY_AUTHOR_CAN_EDIT_POST,
      });
    }

    const attachment = await this.prisma.postAttachment.findFirst({
      where: {
        id: attachmentId,
        postId,
      },
    });

    if (!attachment) {
      throw new NotFoundException({
        error_code: PostErrorCode.ATTACHMENT_NOT_FOUND,
      });
    }

    await this.storageService.delete(attachment.key);

    await this.prisma.postAttachment.delete({
      where: { id: attachment.id },
    });

    return { ok: true };
  }

  private async processAttachments(
    postId: number,
    files: Express.Multer.File[],
  ): Promise<void> {
    await Promise.all(
      files.map(async (file) => {
        const key = `posts/attachments/${postId}_${randomUUID()}_${file.originalname}`;
        await this.storageService.uploadBuffer(
          file.buffer,
          key,
          file.mimetype,
        );

        await this.prisma.postAttachment.create({
          data: {
            postId,
            key,
            name: file.originalname,
            mimeType: file.mimetype,
            size: file.size,
          },
        });
      }),
    );
  }
}
