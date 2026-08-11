import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PaginatedResponseDto } from 'src/common/dto/pagination/paginated-response.dto';
import { CrewMemberRole } from 'src/modules/crews/enums/crew-member-role.enum';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreatePostDto } from './dto/create-post.dto';
import { GetPostsQueryDto } from './dto/get-posts-query.dto';
import { PostItemResponseDto } from './dto/post-item-response.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { PostErrorCode } from './errors/post-error.code.enum';

@Injectable()
export class PostsService {
  constructor(private readonly prisma: PrismaService) {}

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

    await this.prisma.post.create({
      data: {
        crewId,
        authorId: userId,
        content: dto.content,
      },
    });

    return { ok: true };
  }

  async updatePost(
    userId: number,
    crewId: number,
    postId: number,
    dto: UpdatePostDto,
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

    if (post.authorId !== userId) {
      throw new ForbiddenException({
        error_code: PostErrorCode.ONLY_AUTHOR_CAN_EDIT_POST,
      });
    }

    await this.prisma.post.update({
      where: { id: postId },
      data: {
        content: dto.content,
      },
    });

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

    await this.prisma.post.delete({
      where: { id: postId },
    });

    return { ok: true };
  }
}
