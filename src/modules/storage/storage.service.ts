import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(private readonly configService: ConfigService) {
    const endpoint = this.configService.getOrThrow<string>('MINIO_ENDPOINT');
    const port = this.configService.getOrThrow<number>('MINIO_PORT');
    const accessKeyId =
      this.configService.getOrThrow<string>('MINIO_ACCESS_KEY');
    const secretAccessKey =
      this.configService.getOrThrow<string>('MINIO_SECRET_KEY');
    this.bucket = this.configService.getOrThrow<string>('MINIO_BUCKET');

    this.client = new S3Client({
      endpoint: `http://${endpoint}:${port}`,
      region: 'us-east-1',
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
      forcePathStyle: true,
    });
  }

  async upload(file: Express.Multer.File, key: string) {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      }),
    );

    return key;
  }

  async uploadBuffer(buffer: Buffer, key: string, contentType: string) {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      }),
    );

    return key;
  }

  async get(key: string, range?: string) {
    return await this.client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Range: range,
      }),
    );
  }

  async delete(key: string) {
    if (!key || key.startsWith('http://') || key.startsWith('https://')) {
      return;
    }

    try {
      await this.client.send(
        new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }),
      );
    } catch (err) {
      this.logger.warn(`Failed to delete storage key ${key}: ${err}`);
    }
  }
}
