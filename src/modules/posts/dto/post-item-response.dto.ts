import { ApiProperty } from '@nestjs/swagger';
import { PostAttachmentResponseDto } from './post-attachment-response.dto';
import { PostAuthorResponseDto } from './post-author-response.dto';

export class PostItemResponseDto {
  @ApiProperty({ description: 'Post ID', example: 12 })
  id: number;

  @ApiProperty({ description: 'Post text content', example: 'Welcome to the crew!' })
  content: string;

  @ApiProperty({ description: 'Flag indicating if requesting user is the post author' })
  youIsAuthor: boolean;

  @ApiProperty({ type: PostAuthorResponseDto })
  author: PostAuthorResponseDto;

  @ApiProperty({ type: [PostAttachmentResponseDto] })
  attachments: PostAttachmentResponseDto[];

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Last updated timestamp' })
  updatedAt: Date;
}
