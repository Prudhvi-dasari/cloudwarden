/**
 * S3-Compatible & Cloudflare R2 Multi-Part Streaming Storage Engine
 * Handles high-concurrency chunked uploads, presigned URLs, and zero-egress streaming.
 */

import {
  S3Client,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// Cloudflare R2 / AWS S3 Configuration
const R2_ACCOUNT_ID = process.env.CLOUDFLARE_R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
const BUCKET_NAME = process.env.CLOUDFLARE_R2_BUCKET || 'itransfer-storage';

// R2 endpoint format: https://<account_id>.r2.cloudflarestorage.com
const endpoint = R2_ACCOUNT_ID
  ? `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
  : process.env.S3_ENDPOINT || undefined;

export const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'auto',
  endpoint,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID || 'mock_key',
    secretAccessKey: R2_SECRET_ACCESS_KEY || 'mock_secret',
  },
  forcePathStyle: true,
});

export class S3StorageEngine {
  constructor(bucket = BUCKET_NAME) {
    this.bucket = bucket;
    this.client = s3Client;
  }

  /**
   * Initiate a Multi-Part Upload Session
   */
  async initiateMultipartUpload(s3Key, contentType = 'application/octet-stream') {
    const command = new CreateMultipartUploadCommand({
      Bucket: this.bucket,
      Key: s3Key,
      ContentType: contentType,
    });
    const res = await this.client.send(command);
    return {
      uploadId: res.UploadId,
      s3Key,
      bucket: this.bucket,
    };
  }

  /**
   * Generate Presigned URL for Uploading a Specific Chunk/Part
   */
  async getPresignedPartUrl(s3Key, uploadId, partNumber, expiresInSeconds = 3600) {
    const command = new UploadPartCommand({
      Bucket: this.bucket,
      Key: s3Key,
      UploadId: uploadId,
      PartNumber: partNumber,
    });
    const presignedUrl = await getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
    return {
      partNumber,
      presignedUrl,
      expiresInSeconds,
    };
  }

  /**
   * Complete Multi-Part Upload & Assemble Final Binary
   */
  async completeMultipartUpload(s3Key, uploadId, parts) {
    // parts format: [{ PartNumber: 1, ETag: '"..."' }, ...]
    const sortedParts = parts.sort((a, b) => a.PartNumber - b.PartNumber);
    const command = new CompleteMultipartUploadCommand({
      Bucket: this.bucket,
      Key: s3Key,
      UploadId: uploadId,
      MultipartUpload: {
        Parts: sortedParts,
      },
    });
    const res = await this.client.send(command);
    return {
      location: res.Location,
      etag: res.ETag,
      s3Key,
    };
  }

  /**
   * Abort Multi-Part Upload on Failure
   */
  async abortMultipartUpload(s3Key, uploadId) {
    const command = new AbortMultipartUploadCommand({
      Bucket: this.bucket,
      Key: s3Key,
      UploadId: uploadId,
    });
    await this.client.send(command);
    return true;
  }

  /**
   * Direct Single-Request Presigned Upload URL (for files < 100MB)
   */
  async getPresignedPutUrl(s3Key, contentType = 'application/octet-stream', expiresInSeconds = 3600) {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: s3Key,
      ContentType: contentType,
    });
    const presignedUrl = await getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
    return {
      s3Key,
      presignedUrl,
      expiresInSeconds,
    };
  }

  /**
   * Generate Presigned Download URL with Custom File Name & Auto-Expiration
   */
  async getPresignedDownloadUrl(s3Key, customFileName = null, expiresInSeconds = 86400) {
    const commandParams = {
      Bucket: this.bucket,
      Key: s3Key,
    };

    if (customFileName) {
      commandParams.ResponseContentDisposition = `attachment; filename="${encodeURIComponent(customFileName)}"`;
    }

    const command = new GetObjectCommand(commandParams);
    const presignedUrl = await getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
    return presignedUrl;
  }

  /**
   * Delete S3 Object
   */
  async deleteObject(s3Key) {
    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: s3Key,
    });
    await this.client.send(command);
    return true;
  }

  /**
   * Check if Object Exists and get Metadata
   */
  async headObject(s3Key) {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: s3Key,
      });
      return await this.client.send(command);
    } catch (e) {
      return null;
    }
  }

  /**
   * List Objects in Bucket
   */
  async listObjects(prefix = 'transfers/', maxKeys = 200) {
    try {
      const command = new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: prefix,
        MaxKeys: maxKeys,
      });
      const res = await this.client.send(command);
      return res.Contents || [];
    } catch (e) {
      console.error('Failed to list R2 objects:', e.message);
      return [];
    }
  }

  /**
   * Purge Expired Transfers from Cloudflare R2
   */
  async purgeExpiredTransfers(defaultMaxAgeHours = 168) {
    const objects = await this.listObjects('transfers/', 200);
    const now = Date.now();
    let purgedCount = 0;
    let purgedBytes = 0;

    for (const item of objects) {
      if (!item.Key) continue;
      
      // Extract timestamp from standard key format: transfers/<timestamp>-<id>/filename
      const match = item.Key.match(/transfers\/(\d+)-/);
      const createdAt = match ? parseInt(match[1], 10) : new Date(item.LastModified || 0).getTime();
      
      // Check if age exceeds retention limit
      const ageHours = (now - createdAt) / (1000 * 60 * 60);
      if (ageHours > defaultMaxAgeHours) {
        try {
          await this.deleteObject(item.Key);
          purgedCount += 1;
          purgedBytes += item.Size || 0;
        } catch (e) {
          console.error(`Failed to delete expired R2 object ${item.Key}:`, e.message);
        }
      }
    }

    return { purgedCount, purgedBytes, totalChecked: objects.length };
  }
}

export const storageEngine = new S3StorageEngine();
