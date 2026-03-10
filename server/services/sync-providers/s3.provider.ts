/* ── S3 同步 Provider ── */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3'
import type { SyncProvider, SyncFileInfo, S3ProviderConfig } from './types.js'

const SYNC_FILENAME = 'vortix-sync.json'
const LEGACY_FILENAME = 'vortix-sync.dat'

export class S3Provider implements SyncProvider {
  private client: S3Client
  private bucket: string
  private key: string
  private legacyKey: string

  constructor(config: S3ProviderConfig) {
    if (!config.bucket) throw new Error('S3 Bucket 不能为空')
    if (!config.accessKey || !config.secretKey) throw new Error('S3 AccessKey/SecretKey 不能为空')

    this.bucket = config.bucket
    const dir = config.path || 'vortix'
    const base = dir.endsWith('/') ? dir : `${dir}/`
    this.key = `${base}${SYNC_FILENAME}`
    this.legacyKey = `${base}${LEGACY_FILENAME}`

    this.client = new S3Client({
      region: config.region || 'us-east-1',
      endpoint: config.endpoint || undefined,
      forcePathStyle: config.style === 'path',
      credentials: {
        accessKeyId: config.accessKey,
        secretAccessKey: config.secretKey,
      },
      ...(config.tlsVerify === false && { tls: false }),
    })
  }

  async upload(data: Buffer): Promise<void> {
    await this.client.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: this.key,
      Body: data,
      ContentType: 'application/json',
    }))
    // 清理旧格式文件
    try {
      await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: this.legacyKey }))
    } catch { /* 不存在则忽略 */ }
  }

  async download(): Promise<Buffer> {
    // 优先新格式，fallback 旧格式
    for (const k of [this.key, this.legacyKey]) {
      try {
        const res = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: k }))
        if (!res.Body) continue
        const bytes = await res.Body.transformToByteArray()
        return Buffer.from(bytes)
      } catch { /* 继续 */ }
    }
    throw new Error('S3 同步文件不存在')
  }

  async delete(): Promise<void> {
    try { await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: this.key })) } catch { /* */ }
    try { await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: this.legacyKey })) } catch { /* */ }
  }

  async status(): Promise<SyncFileInfo> {
    for (const k of [this.key, this.legacyKey]) {
      try {
        const res = await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: k }))
        return {
          exists: true,
          lastModified: res.LastModified?.toISOString() ?? null,
          size: res.ContentLength ?? null,
        }
      } catch { /* 继续 */ }
    }
    return { exists: false, lastModified: null, size: null }
  }

  async test(): Promise<void> {
    const testKey = this.key.replace(/[^/]+$/, '.vortix-test')
    await this.client.send(new PutObjectCommand({
      Bucket: this.bucket, Key: testKey, Body: Buffer.from('ok'), ContentType: 'text/plain',
    }))
    try {
      await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: testKey }))
    } catch { /* 清理失败不影响结果 */ }
  }
}
