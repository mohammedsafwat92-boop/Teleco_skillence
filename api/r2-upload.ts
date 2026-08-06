import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

export default async function handler(req: any, res: any) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed. Only POST requests with base64 fileData are supported.' });
  }

  try {
    let body = req.body;
    if (typeof body === 'string' && body.trim().length > 0) {
      try {
        body = JSON.parse(body);
      } catch (e) {
        // Body was string
      }
    }

    const filename = body?.filename || req.query?.filename;
    const contentType = body?.contentType || body?.fileType || req.query?.fileType || 'audio/mpeg';
    let fileData = body?.fileData;

    if (!filename) {
      return res.status(400).json({ error: 'Filename parameter is required.' });
    }

    if (!fileData) {
      return res.status(400).json({ error: 'fileData (base64 string) parameter is required.' });
    }

    // Strip Data URL prefix if present (e.g., "data:audio/mp3;base64,...")
    if (fileData.includes('base64,')) {
      fileData = fileData.split('base64,')[1];
    }

    // Convert base64 string to Node.js Buffer
    const buffer = Buffer.from(fileData, 'base64');

    const accountId = process.env.R2_ACCOUNT_ID;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    const bucketName = process.env.R2_BUCKET_NAME;
    const publicDomain = process.env.R2_PUBLIC_DOMAIN || (accountId && bucketName ? `https://${bucketName}.${accountId}.r2.dev` : '');

    if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
      return res.status(500).json({
        error: 'Cloudflare R2 environment variables missing. Ensure R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_BUCKET_NAME are set in process.env.'
      });
    }

    // Initialize S3Client configured for Cloudflare R2
    const s3Client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: accessKeyId,
        secretAccessKey: secretAccessKey,
      },
    });

    const sanitizedFilename = String(filename).replace(/[^a-zA-Z0-9_.-]/g, '_');
    const objectKey = `audio_${Date.now()}_${sanitizedFilename}`;

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: objectKey,
      Body: buffer,
      ContentType: contentType,
    });

    await s3Client.send(command);

    const publicUrl = publicDomain 
      ? (publicDomain.endsWith('/') ? `${publicDomain}${objectKey}` : `${publicDomain}/${objectKey}`)
      : `https://${accountId}.r2.cloudflarestorage.com/${bucketName}/${objectKey}`;

    return res.status(200).json({
      success: true,
      publicUrl,
      key: objectKey,
      filename
    });
  } catch (err: any) {
    console.error('Cloudflare R2 Direct Buffer Upload Error:', err);
    return res.status(500).json({ 
      error: err?.message || 'Failed to upload audio buffer to Cloudflare R2' 
    });
  }
}

