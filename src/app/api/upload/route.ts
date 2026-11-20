import { NextResponse } from 'next/server';
import { registerCustomerDocumentUpload } from '@/lib/db/mockData';
import {
  createServiceRoleClient,
  isServiceRoleConfigured,
} from '@/lib/supabase/serviceRole';
import { validateUploadFile } from '@/lib/security/fileValidation';
import { checkRateLimit } from '@/lib/security/rateLimiter';
import path from 'path';
import fs from 'fs';

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
  'image/webp',
];

const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15MB

export async function GET() {
  return NextResponse.json({ success: false, error: 'Method Not Allowed' }, { status: 405 });
}

export async function POST(req: Request) {
  try {
    // 1. Persistent Rate Limiting (10 uploads per 5 minutes per IP)
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'local-client';
    const rateCheck = await checkRateLimit(`upload_${clientIp}`, 10, 300000);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: 'Upload rate limit exceeded. Please wait a few minutes before trying again.',
        },
        { status: 429 }
      );
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const categoryRaw = formData.get('category') as string | null;

    if (!file) {
      return NextResponse.json({ success: false, error: 'No file provided.' }, { status: 400 });
    }

    // Customer documents and CVs go to the private bucket 'customer-documents'
    const category = categoryRaw === 'resumes' ? 'resumes' : 'documents';

    // 2. Validate Extension, Size, and Magic Bytes
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const validation = validateUploadFile(
      fileBuffer,
      file.name,
      file.type,
      ALLOWED_MIME_TYPES,
      MAX_FILE_SIZE
    );

    if (!validation.valid || !validation.sanitizedFilename) {
      return NextResponse.json(
        {
          success: false,
          error: validation.error || 'Invalid file format or corrupted file.',
        },
        { status: 400 }
      );
    }

    const uniqueFileName = validation.sanitizedFilename;

    // 3. Cloud Storage (Supabase Storage: private bucket 'customer-documents' via service_role)
    if (isServiceRoleConfigured()) {
      try {
        const supabase = createServiceRoleClient();
        const bucket = 'customer-documents';
        const storagePath = `${category}/${uniqueFileName}`;
        const detectedMime = validation.detectedType || file.type;

        const { data, error } = await supabase.storage
          .from(bucket)
          .upload(storagePath, fileBuffer, {
            contentType: detectedMime,
            upsert: false,
          });

        if (!error && data) {
          const fileReference = `supabase://${bucket}/${data.path}`;
          const registered = await registerCustomerDocumentUpload({
            category,
            storagePath: data.path,
            fileReference,
            mimeType: detectedMime,
            byteSize: fileBuffer.length,
          });

          if (!registered.ok) {
            try {
              await supabase.storage.from(bucket).remove([data.path]);
            } catch (cleanupErr) {
              console.error('Supabase private storage cleanup failed:', cleanupErr);
            }
            console.error('Customer upload registration failed:', registered.error);
          } else {
            return NextResponse.json({
              success: true,
              storage: 'supabase-private',
              fileReference,
              fileName: uniqueFileName,
              uploadToken: registered.uploadToken,
            });
          }
        } else {
          console.error('Supabase private storage error:', error);
        }
      } catch (err) {
        console.error('Supabase private storage upload failed:', err);
      }
    }

    // 4. Persistence Fail-Closed Check: In production, local disk storage is strictly forbidden
    // (whether Supabase is unconfigured or a Supabase upload attempt failed).
    if (process.env.NODE_ENV === 'production') {
      console.error('CRITICAL: Production upload could not be persisted to cloud storage.');
      return NextResponse.json(
        {
          success: false,
          error: 'Secure storage is temporarily unavailable. Please contact us directly.',
        },
        { status: 503 }
      );
    }

    // 5. Development-Only Local Private Storage (Outside /public/)
    const privateDir = path.join(process.cwd(), 'private_storage', 'uploads', category);
    if (!fs.existsSync(privateDir)) {
      fs.mkdirSync(privateDir, { recursive: true });
    }

    const destinationPath = path.join(privateDir, uniqueFileName);
    fs.writeFileSync(destinationPath, fileBuffer);

    const localReference = `private://${category}/${uniqueFileName}`;
    const localRegistered = await registerCustomerDocumentUpload({
      category,
      storagePath: `${category}/${uniqueFileName}`,
      fileReference: localReference,
      mimeType: validation.detectedType || file.type,
      byteSize: fileBuffer.length,
    });

    if (!localRegistered.ok) {
      return NextResponse.json(
        { success: false, error: 'Unable to bind uploaded file to session.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      storage: 'local-private',
      fileReference: localReference,
      fileName: uniqueFileName,
      fileSize: file.size,
      uploadToken: localRegistered.uploadToken,
    });
  } catch (err: unknown) {
    console.error('Upload route internal error:', err);
    return NextResponse.json(
      { success: false, error: 'An error occurred while processing the file upload.' },
      { status: 500 }
    );
  }
}
