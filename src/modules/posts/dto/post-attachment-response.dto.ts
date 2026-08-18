import { ApiProperty } from '@nestjs/swagger';

export class PostAttachmentResponseDto {
  @ApiProperty({ description: 'Attachment ID', example: 1 })
  id: number;

  @ApiProperty({ description: 'S3 storage key', example: 'posts/attachments/file.jpg' })
  key: string;

  @ApiProperty({ description: 'Original file name', example: 'photo.jpg' })
  name: string;

  @ApiProperty({ description: 'MIME type', example: 'image/jpeg' })
  mimeType: string;

  @ApiProperty({ description: 'File size in bytes', example: 102400 })
  size: number;

  @ApiProperty({ description: 'Upload timestamp' })
  createdAt: Date;
}
