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
import {
  ApiBody,
  ApiConsumes,
  ApiCookieAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { PaginatedResponseDto } from 'src/common/dto/pagination/paginated-response.dto';
import { AuthRequired } from 'src/modules/auth/decorators/auth-required.decorator';
import { CurrentUser } from 'src/modules/auth/decorators/current-user.decorator';
import { CreatePostDto } from './dto/create-post.dto';
import { GetPostsQueryDto } from './dto/get-posts-query.dto';
import { PostItemResponseDto } from './dto/post-item-response.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { PostsService } from './posts.service';

@ApiTags('posts')
@ApiCookieAuth('access_token')
@Controller('posts')
@AuthRequired()
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Get(':crewId')
  @ApiOperation({ summary: 'Get paginated posts for a crew' })
  @ApiResponse({ status: 200, description: 'Paginated posts' })
  async getPosts(
    @CurrentUser('id') userId: number,
    @Param('crewId', ParseIntPipe) crewId: number,
    @Query() query: GetPostsQueryDto,
  ): Promise<PaginatedResponseDto<PostItemResponseDto>> {
    return await this.postsService.getPosts(userId, crewId, query);
  }

  @Post(':crewId')
  @ApiOperation({ summary: 'Create a post in crew with optional attachments' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 201, description: 'Post created' })
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
  @ApiOperation({ summary: 'Update post content and manage attachments' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 200, description: 'Post updated' })
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
  @ApiOperation({ summary: 'Upload attachments to an existing post' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 201, description: 'Attachments uploaded' })
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
  @ApiOperation({ summary: 'Delete a single post attachment' })
  @ApiResponse({ status: 200, description: 'Attachment deleted' })
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
  @ApiOperation({ summary: 'Delete a post and its attachments' })
  @ApiResponse({ status: 200, description: 'Post deleted' })
  async deletePost(
    @CurrentUser('id') userId: number,
    @Param('crewId', ParseIntPipe) crewId: number,
    @Param('postId', ParseIntPipe) postId: number,
  ): Promise<{ ok: true }> {
    return await this.postsService.deletePost(userId, crewId, postId);
  }
}
