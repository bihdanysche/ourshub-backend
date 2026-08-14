import { PostAttachmentResponseDto } from './post-attachment-response.dto';
import { PostAuthorResponseDto } from './post-author-response.dto';

export class PostItemResponseDto {
  id: number;
  content: string;
  youIsAuthor: boolean;
  author: PostAuthorResponseDto;
  attachments: PostAttachmentResponseDto[];
  createdAt: Date;
  updatedAt: Date;
}
