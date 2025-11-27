import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'

let client: S3Client | null = null

function getS3Client() {
  if (client) return client
  const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION
  if (!region) {
    throw new Error('AWS_REGION (or AWS_DEFAULT_REGION) must be set to upload Design Studio exports.')
  }
  client = new S3Client({
    region,
    endpoint: process.env.AWS_S3_ENDPOINT,
    forcePathStyle: process.env.AWS_S3_FORCE_PATH_STYLE === '1' ? true : undefined,
    credentials:
      process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
        ? {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
            sessionToken: process.env.AWS_SESSION_TOKEN,
          }
        : undefined,
  })
  return client
}

export type UploadObjectArgs = {
  bucket: string
  key: string
  body: string | Uint8Array | Buffer
  contentType?: string
  publicBaseUrl?: string
}

export type UploadObjectResult = {
  bucket: string
  key: string
  url: string
  bytes: number
}

export async function uploadObjectToS3({
  bucket,
  key,
  body,
  contentType,
  publicBaseUrl,
}: UploadObjectArgs): Promise<UploadObjectResult> {
  if (!bucket) {
    throw new Error('S3 bucket is required')
  }
  if (!key) {
    throw new Error('S3 object key is required')
  }
  const resolvedBody = typeof body === 'string' ? Buffer.from(body) : Buffer.isBuffer(body) ? body : Buffer.from(body)
  const s3 = getS3Client()
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: resolvedBody,
      ContentType: contentType || 'application/octet-stream',
    }),
  )
  return {
    bucket,
    key,
    url: buildPublicUrl(bucket, key, publicBaseUrl),
    bytes: resolvedBody.byteLength,
  }
}

function buildPublicUrl(bucket: string, key: string, override?: string) {
  if (override) {
    return `${override.replace(/\/$/, '')}/${encodeURI(key)}`
  }
  const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1'
  const normalizedKey = key
    .split('/')
    .map(segment => encodeURIComponent(segment))
    .join('/')
  if (region === 'us-east-1') {
    return `https://${bucket}.s3.amazonaws.com/${normalizedKey}`
  }
  return `https://${bucket}.s3.${region}.amazonaws.com/${normalizedKey}`
}
