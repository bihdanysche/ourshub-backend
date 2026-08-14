import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { PaginatedResponseDto } from 'src/common/dto/pagination/paginated-response.dto';
import { AuthRequired } from 'src/modules/auth/decorators/auth-required.decorator';
import { CurrentUser } from 'src/modules/auth/decorators/current-user.decorator';
import { CreatePostDto } from './dto/create-post.dto';
import { GetPostsQueryDto } from './dto/get-posts-query.dto';
import { PostItemResponseDto } from './dto/post-item-response.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { PostsService } from './posts.service';

@Controller('posts')
@AuthRequired()
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Get(':crewId')
  async getPosts(
    @CurrentUser('id') userId: number,
    @Param('crewId', ParseIntPipe) crewId: number,
    @Query() query: GetPostsQueryDto,
  ): Promise<PaginatedResponseDto<PostItemResponseDto>> {
    return await this.postsService.getPosts(userId, crewId, query);
  }

  @Post(':crewId')
  @UseInterceptors(AnyFilesInterceptor())
  async createPost(
    @CurrentUser('id') userId: number,
    @Param('crewId', ParseIntPipe) crewId: number,
    @Body() dto: CreatePostDto,
    @UploadedFiles() files?: Express.Multer.File[],
  ): Promise<{ ok: true }> {
    return await this.postsService.createPost(userId, crewId, dto, files);
  }

  @Patch(':crewId/:postId')
  @UseInterceptors(AnyFilesInterceptor())
  async updatePost(
    @CurrentUser('id') userId: number,
    @Param('crewId', ParseIntPipe) crewId: number,
    @Param('postId', ParseIntPipe) postId: number,
    @Body() dto: UpdatePostDto & { removeAttachmentIds?: string | number[] },
    @UploadedFiles() files?: Express.Multer.File[],
  ): Promise<{ ok: true }> {
    let removeIds: number[] | undefined;
    if (dto.removeAttachmentIds) {
      if (typeof dto.removeAttachmentIds === 'string') {
        try {
          const parsed = JSON.parse(dto.removeAttachmentIds) as unknown;
          if (Array.isArray(parsed)) {
            removeIds = parsed.map(Number).filter((n) => !isNaN(n));
          } else {
            removeIds = dto.removeAttachmentIds.split(',').map(Number).filter((n) => !isNaN(n));
          }
        } catch {
          removeIds = dto.removeAttachmentIds.split(',').map(Number).filter((n) => !isNaN(n));
        }
      } else if (Array.isArray(dto.removeAttachmentIds)) {
        removeIds = dto.removeAttachmentIds.map(Number).filter((n) => !isNaN(n));
      }
    }

    return await this.postsService.updatePost(
      userId,
      crewId,
      postId,
      dto,
      files,
      removeIds,
    );
  }

  @Post(':crewId/:postId/attachments')
  @UseInterceptors(AnyFilesInterceptor())
  async uploadPostAttachments(
    @CurrentUser('id') userId: number,
    @Param('crewId', ParseIntPipe) crewId: number,
    @Param('postId', ParseIntPipe) postId: number,
    @UploadedFiles() files: Express.Multer.File[],
  ): Promise<{ ok: true }> {
    return await this.postsService.uploadPostAttachments(
      userId,
      crewId,
      postId,
      files,
    );
  }

  @Delete(':crewId/:postId/attachments/:attachmentId')
  async deletePostAttachment(
    @CurrentUser('id') userId: number,
    @Param('crewId', ParseIntPipe) crewId: number,
    @Param('postId', ParseIntPipe) postId: number,
    @Param('attachmentId', ParseIntPipe) attachmentId: number,
  ): Promise<{ ok: true }> {
    return await this.postsService.deletePostAttachment(
      userId,
      crewId,
      postId,
      attachmentId,
    );
  }

  @Delete(':crewId/:postId')
  async deletePost(
    @CurrentUser('id') userId: number,
    @Param('crewId', ParseIntPipe) crewId: number,
    @Param('postId', ParseIntPipe) postId: number,
  ): Promise<{ ok: true }> {
    return await this.postsService.deletePost(userId, crewId, postId);
  }
}
