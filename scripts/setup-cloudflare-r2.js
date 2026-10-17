/**
 * Cloudflare R2 Automated Bucket Provisioner & Health Check Script
 * Usage: node scripts/setup-cloudflare-r2.js
 */

import { S3Client, CreateBucketCommand, ListBucketsCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import dotenv from 'dotenv';
dotenv.config();

const R2_ACCOUNT_ID = process.env.CLOUDFLARE_R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
const BUCKET_NAME = process.env.CLOUDFLARE_R2_BUCKET || 'itransfer-storage';

if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
  console.log('\n❌ Missing Cloudflare R2 credentials in environment.');
  console.log('To connect your 10 GB Free Cloudflare R2 bucket:');
  console.log('1. Go to https://dash.cloudflare.com/');
  console.log('2. Navigate to R2 Object Storage -> "Create bucket" -> name it "itransfer-storage"');
  console.log('3. Click "Manage R2 API Tokens" -> "Create API Token" (Permissions: Object Read & Write)');
  console.log('4. Copy Account ID, Access Key ID, and Secret Access Key into your .env file or Vercel Environment Variables:');
  console.log('   - CLOUDFLARE_R2_ACCOUNT_ID');
  console.log('   - CLOUDFLARE_R2_ACCESS_KEY_ID');
  console.log('   - CLOUDFLARE_R2_SECRET_ACCESS_KEY');
  console.log('   - CLOUDFLARE_R2_BUCKET=itransfer-storage\n');
  process.exit(0);
}

const client = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
  forcePathStyle: true,
});

async function main() {
  console.log(`Connecting to Cloudflare R2 account (${R2_ACCOUNT_ID})...`);

  try {
    const listRes = await client.send(new ListBucketsCommand({}));
    const exists = listRes.Buckets?.some((b) => b.Name === BUCKET_NAME);

    if (exists) {
      console.log(`✅ Bucket "${BUCKET_NAME}" is active and connected!`);
    } else {
      console.log(`Bucket "${BUCKET_NAME}" not found. Creating bucket...`);
      await client.send(new CreateBucketCommand({ Bucket: BUCKET_NAME }));
      console.log(`✅ Bucket "${BUCKET_NAME}" created successfully!`);
    }

    // Health check test upload
    console.log('Running test upload...');
    await client.send(
      new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: 'health-check.txt',
        Body: 'iTransfer Cloudflare R2 Connection OK',
        ContentType: 'text/plain',
      })
    );
    console.log('✅ Health check upload successful! 10 GB Free Tier + 0 Egress is ready.');
  } catch (err) {
    console.error('❌ Cloudflare R2 setup failed:', err.message);
  }
}

main();
