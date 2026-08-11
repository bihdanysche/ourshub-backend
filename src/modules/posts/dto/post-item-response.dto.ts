import { PostAuthorResponseDto } from './post-author-response.dto';

export class PostItemResponseDto {
  id: number;
  content: string;
  youIsAuthor: boolean;
  author: PostAuthorResponseDto;
  createdAt: Date;
  updatedAt: Date;
}
