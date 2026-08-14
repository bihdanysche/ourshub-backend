import { Controller, Get, Query, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { StorageService } from './storage.service';

@Controller('storage')
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  @Get()
  async get(
    @Query('k') key: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    if (!key || key.startsWith('http://') || key.startsWith('https://')) {
      return res.sendStatus(404);
    }

    try {
      const range = req.headers.range;
      const file = await this.storageService.get(key, range);

      if (!file.Body) {
        return res.sendStatus(404);
      }

      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

      if (file.ContentType) {
        res.setHeader('Content-Type', file.ContentType);
      }

      if (file.ContentLength !== undefined) {
        res.setHeader('Content-Length', file.ContentLength.toString());
      }

      if (file.ContentRange) {
        res.setHeader('Content-Range', file.ContentRange);
      }

      const statusCode =
        file.$metadata?.httpStatusCode ?? (file.ContentRange ? 206 : 200);
      res.status(statusCode);

      const body = file.Body as NodeJS.ReadableStream;
      body.pipe(res);
    } catch (err: unknown) {
      const httpStatusCode = (err as { $metadata?: { httpStatusCode?: number } })?.$metadata?.httpStatusCode;
      if (httpStatusCode === 416) {
        return res.sendStatus(416);
      }
      return res.sendStatus(404);
    }
  }
}
