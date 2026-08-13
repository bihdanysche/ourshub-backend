import { BadRequestException } from '@nestjs/common';
import sharp from 'sharp';

export interface ImageErrorCodes {
  IMAGE_REQUIRED: string;
  INVALID_IMAGE_FORMAT: string;
  IMAGE_TOO_LARGE: string;
  INVALID_IMAGE_ASPECT_RATIO: string;
}

export interface ProcessedImageResult {
  buffer: Buffer;
  extension: string;
  contentType: string;
}

export async function processAndValidateImage(
  file: Express.Multer.File | undefined,
  options: {
    maxSizeBytes: number;
    targetAspectRatio: number;
    errorCodes: ImageErrorCodes;
  },
): Promise<ProcessedImageResult> {
  const { maxSizeBytes, targetAspectRatio, errorCodes } = options;

  if (!file || !file.buffer || file.buffer.length === 0) {
    throw new BadRequestException({
      error_code: errorCodes.IMAGE_REQUIRED,
    });
  }

  if (file.size > maxSizeBytes) {
    throw new BadRequestException({
      error_code: errorCodes.IMAGE_TOO_LARGE,
    });
  }

  let metadata: sharp.Metadata;
  try {
    metadata = await sharp(file.buffer).metadata();
  } catch {
    throw new BadRequestException({
      error_code: errorCodes.INVALID_IMAGE_FORMAT,
    });
  }

  const format = metadata.format?.toLowerCase();
  const filenameExt = file.originalname?.split('.').pop()?.toLowerCase();

  const isHeic =
    format === 'heif' ||
    format === 'heic' ||
    filenameExt === 'heic' ||
    filenameExt === 'heif';

  const isSupportedFormat =
    isHeic ||
    format === 'png' ||
    format === 'jpeg' ||
    format === 'jpg' ||
    ['image/png', 'image/jpeg', 'image/jpg', 'image/heic', 'image/heif'].includes(
      file.mimetype?.toLowerCase(),
    );

  if (!isSupportedFormat) {
    throw new BadRequestException({
      error_code: errorCodes.INVALID_IMAGE_FORMAT,
    });
  }

  const width = metadata.width;
  const height = metadata.height;

  if (!width || !height || width <= 0 || height <= 0) {
    throw new BadRequestException({
      error_code: errorCodes.INVALID_IMAGE_FORMAT,
    });
  }

  const actualRatio = width / height;
  const diff = Math.abs(actualRatio - targetAspectRatio);

  if (diff / targetAspectRatio > 0.03) {
    throw new BadRequestException({
      error_code: errorCodes.INVALID_IMAGE_ASPECT_RATIO,
    });
  }

  if (isHeic) {
    const pngBuffer = await sharp(file.buffer).toFormat('png').toBuffer();
    return {
      buffer: pngBuffer,
      extension: 'png',
      contentType: 'image/png',
    };
  }

  let ext = format === 'jpeg' ? 'jpg' : (format ?? 'png');
  if (ext === 'heif' || ext === 'heic') {
    ext = 'png';
  }

  return {
    buffer: file.buffer,
    extension: ext,
    contentType: file.mimetype || `image/${ext}`,
  };
}
