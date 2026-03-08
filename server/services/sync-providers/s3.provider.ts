/* ── S3 同步 Provider ── */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3'
import type { SyncProvider, SyncFileInfo, S3ProviderConfig } from './types.js'

const SYNC_FILENAME = 'vortix-sync.dat'

export class S3Provider implements SyncProvider {
  private client: S3Client
  private bucket: string
  private key: string

  constructor(config: S3ProviderConfig) {
    if (!config.bucket) throw new Error('S3 Bucket 不能为空')
    if (!config.accessKey || !config.secretKey) throw new Error('S3 AccessKey/SecretKey 不能为空')

    this.bucket = config.bucket
    const dir = config.path || 'vortix'
    this.key = dir.endsWith('/') ? `${dir}${SYNC_FILENAME}` : `${dir}/${SYNC_FILENAME}`

    this.client = new S3Client({
      region: config.region || 'us-east-1',
      endpoint: config.endpoint || undefined,
      forcePathStyle: config.style === 'path',
      credentials: {
        accessKeyId: config.accessKey,
        secretAccessKey: config.secretKey,
      },
      ...(config.tlsVerify === false && {
        tls: false,
      }),
    })
  }

  async upload(data: Buffer): Promise<void> {
    await this.client.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: this.key,
      Body: data,
      ContentType: 'application/octet-stream',
    }))
  }

  async download(): Promise<Buffer> {
    const res = await this.client.send(new GetObjectCommand({
      Bucket: this.bucket,
      Key: this.key,
    }))
    if (!res.Body) throw new Error('S3 同步文件为空')
    const bytes = await res.Body.transformToByteArray()
    return Buffer.from(bytes)
  }

  async delete(): Promise<void> {
    await this.client.send(new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: this.key,
    }))
  }

  async status(): Promise<SyncFileInfo> {
    try {
      const res = await this.client.send(new HeadObjectCommand({
        Bucket: this.bucket,
        Key: this.key,
      }))
      return {
        exists: true,
        lastModified: res.LastModified?.toISOString() ?? null,
        size: res.ContentLength ?? null,
      }
    } catch {
      return { exists: false, lastModified: null, size: null }
    }
  }
}
