import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Query,
} from '@nestjs/common';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { SimulateService } from '../simulate/simulate.service';

@Controller('exports')
export class ExportsController {
  constructor(private readonly simulateService: SimulateService) {}

  @Get('run/:id/s3')
  async exportRunToS3(
    @Param('id') runId: string,
    @Query('format') format?: 'csv' | 'json',
  ) {
    if ((process.env.S3_EXPORTS_ENABLED ?? 'false').toLowerCase() !== 'true') {
      return {
        error: 's3_exports_disabled',
        message: 'Enable by setting S3_EXPORTS_ENABLED=true',
      };
    }
    const bucket = process.env.S3_BUCKET;
    const region = process.env.AWS_REGION;

    if (!bucket || !region)
      throw new BadRequestException('Missing S3_BUCKET or AWS_REGION');

    const s3 = new S3Client({ region });
    const exportFormat = (format ?? 'csv').toLowerCase() as 'csv' | 'json';

    let bodyString: string;
    let key: string;

    if (exportFormat === 'json') {
      const json = await this.simulateService.exportRunJson(runId);
      bodyString = JSON.stringify(json);
      key = `exports/run-${runId}.json`;
    } else {
      const { content } = await this.simulateService.exportRunCsv(runId);
      bodyString = content;
      key = `exports/run-${runId}.csv`;
    }

    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: bodyString,
        ContentType: exportFormat === 'json' ? 'application/json' : 'text/csv',
      }),
    );

    return { ok: true, bucket, key };
  }
}
