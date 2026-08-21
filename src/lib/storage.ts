import { promises as fs, createWriteStream, createReadStream } from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import path from 'node:path';
import { config, isS3Configured, isBlobConfigured } from './config';

/** A body to store: an in-memory buffer or a streaming web ReadableStream. */
export type PutBody = Buffer | ReadableStream<Uint8Array>;

export interface StorageAdapter {
  /** Store data and return a locator (a key, or a full URL for blob storage). */
  put(key: string, data: PutBody, contentType: string): Promise<string>;
  get(key: string): Promise<Buffer | null>;
  /** Stream a stored file without loading it fully into memory. */
  getStream(key: string): Promise<ReadableStream<Uint8Array> | null>;
  delete(key: string): Promise<void>;
  /** Client-facing URL for a stored file (signed for S3, API route for local). */
  getFileUrl(key: string, projectId: string): Promise<string>;
  /** Resolve to a local filesystem path (downloads into `dir` for S3/blob). */
  toLocalFile(key: string, dir: string): Promise<string>;
}

const LOCAL_ROOT = path.resolve(process.cwd(), process.env.STORAGE_DIR || '.storage');

async function streamToFile(stream: ReadableStream<Uint8Array>, full: string): Promise<void> {
  await pipeline(Readable.fromWeb(stream as any), createWriteStream(full));
}

class LocalStorageAdapter implements StorageAdapter {
  private resolve(key: string): string {
    const safe = path.normalize(key).replace(/^(\.\.[/\\])+/, '');
    return path.join(LOCAL_ROOT, safe);
  }

  async put(key: string, data: PutBody, _contentType: string): Promise<string> {
    const full = this.resolve(key);
    await fs.mkdir(path.dirname(full), { recursive: true });
    if (data instanceof Uint8Array) {
      await fs.writeFile(full, data);
    } else {
      await streamToFile(data, full);
    }
    return key;
  }

  async get(key: string): Promise<Buffer | null> {
    try {
      return await fs.readFile(this.resolve(key));
    } catch {
      return null;
    }
  }

  async getStream(key: string): Promise<ReadableStream<Uint8Array> | null> {
    const full = this.resolve(key);
    try {
      await fs.access(full);
    } catch {
      return null;
    }
    return Readable.toWeb(createReadStream(full)) as ReadableStream<Uint8Array>;
  }

  async delete(key: string): Promise<void> {
    await fs.rm(this.resolve(key), { force: true }).catch(() => {});
  }

  async getFileUrl(_key: string, projectId: string): Promise<string> {
    return `/api/videos/${projectId}/file`;
  }

  async toLocalFile(key: string, _dir: string): Promise<string> {
    return this.resolve(key);
  }
}

class S3StorageAdapter implements StorageAdapter {
  private s3: {
    client: any;
    GetObjectCommand: any;
    PutObjectCommand: any;
    DeleteObjectCommand: any;
    getSignedUrl: any;
  } | null = null;

  private async client() {
    if (this.s3) return this.s3;
    const { S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectCommand } = await import(
      '@aws-sdk/client-s3'
    );
    const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
    const client = new S3Client({
      region: process.env.STORAGE_REGION || 'us-east-1',
      endpoint: config.storage.endpoint,
      forcePathStyle: true,
      credentials: {
        accessKeyId: config.storage.accessKey!,
        secretAccessKey: config.storage.secretKey!,
      },
    });
    this.s3 = { client, GetObjectCommand, PutObjectCommand, DeleteObjectCommand, getSignedUrl };
    return this.s3;
  }

  async put(key: string, data: PutBody, contentType: string): Promise<string> {
    const { client, PutObjectCommand } = await this.client();
    const body = data instanceof Uint8Array ? data : Readable.fromWeb(data as any);
    await client.send(
      new PutObjectCommand({
        Bucket: config.storage.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
    return key;
  }

  async get(key: string): Promise<Buffer | null> {
    const { client, GetObjectCommand } = await this.client();
    try {
      const res = await client.send(new GetObjectCommand({ Bucket: config.storage.bucket, Key: key }));
      const bytes = await res.Body.transformToByteArray();
      return Buffer.from(bytes);
    } catch {
      return null;
    }
  }

  async getStream(key: string): Promise<ReadableStream<Uint8Array> | null> {
    const { client, GetObjectCommand } = await this.client();
    try {
      const res = await client.send(new GetObjectCommand({ Bucket: config.storage.bucket, Key: key }));
      const body: any = res.Body;
      if (body?.getReader) return body as ReadableStream<Uint8Array>;
      if (body?.pipe) return Readable.toWeb(body) as ReadableStream<Uint8Array>;
      return null;
    } catch {
      return null;
    }
  }

  async delete(key: string): Promise<void> {
    const { client, DeleteObjectCommand } = await this.client();
    await client
      .send(new DeleteObjectCommand({ Bucket: config.storage.bucket, Key: key }))
      .catch(() => {});
  }

  async getFileUrl(key: string): Promise<string> {
    const { client, GetObjectCommand, getSignedUrl } = await this.client();
    return getSignedUrl(client, new GetObjectCommand({ Bucket: config.storage.bucket, Key: key }), {
      expiresIn: 3600,
    });
  }

  async toLocalFile(key: string, dir: string): Promise<string> {
    const buf = await this.get(key);
    if (!buf) throw new Error(`Object not found: ${key}`);
    const full = path.join(dir, path.basename(key));
    await fs.writeFile(full, buf);
    return full;
  }
}

/** Vercel Blob — the app stores the public URL as the locator. */
class VercelBlobStorageAdapter implements StorageAdapter {
  async put(key: string, data: PutBody, contentType: string): Promise<string> {
    const { put } = await import('@vercel/blob');
    const res = await put(key, data as any, { contentType, access: 'public', addRandomSuffix: false });
    return res.url;
  }

  async get(locator: string): Promise<Buffer | null> {
    try {
      const res = await fetch(locator);
      if (!res.ok) return null;
      const buf = await res.arrayBuffer();
      return Buffer.from(buf);
    } catch {
      return null;
    }
  }

  async getStream(locator: string): Promise<ReadableStream<Uint8Array> | null> {
    try {
      const res = await fetch(locator);
      if (!res.ok || !res.body) return null;
      return res.body;
    } catch {
      return null;
    }
  }

  async delete(locator: string): Promise<void> {
    const { del } = await import('@vercel/blob');
    await del(locator).catch(() => {});
  }

  async getFileUrl(locator: string): Promise<string> {
    return locator; // already a public URL
  }

  async toLocalFile(locator: string, dir: string): Promise<string> {
    const buf = await this.get(locator);
    if (!buf) throw new Error(`Object not found: ${locator}`);
    const name = path.basename(new URL(locator).pathname) || 'file';
    const full = path.join(dir, name);
    await fs.writeFile(full, buf);
    return full;
  }
}

export const storage: StorageAdapter = isBlobConfigured
  ? new VercelBlobStorageAdapter()
  : isS3Configured
    ? new S3StorageAdapter()
    : new LocalStorageAdapter();
