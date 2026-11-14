import { NextResponse } from 'next/server';
import { isSupabaseConfigured } from '@/lib/db/mockData';
import { createClient as createSupabaseClient } from '@/lib/supabase/server';
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

    // 3. Cloud Storage (Supabase Storage: private bucket 'customer-documents')
    if (isSupabaseConfigured()) {
      try {
        const supabase = await createSupabaseClient();
        const bucket = 'customer-documents';
        const storagePath = `${category}/${uniqueFileName}`;

        const { data, error } = await supabase.storage
          .from(bucket)
          .upload(storagePath, fileBuffer, {
            contentType: validation.detectedType || file.type,
            upsert: false,
          });

        if (!error && data) {
          return NextResponse.json({
            success: true,
            storage: 'supabase-private',
            fileReference: `supabase://${bucket}/${data.path}`,
            fileName: uniqueFileName,
          });
        }

        console.error('Supabase private storage error:', error);
      } catch (err) {
        console.error('Supabase private storage upload failed:', err);
      }
    }

    // 4. Persistence Fail-Closed Check: In production, local storage is strictly forbidden
    if (process.env.NODE_ENV === 'production' && !isSupabaseConfigured()) {
      console.error('CRITICAL: Upload attempted in production without Supabase configured.');
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

    return NextResponse.json({
      success: true,
      storage: 'local-private',
      fileReference: `private://${category}/${uniqueFileName}`,
      fileName: uniqueFileName,
      fileSize: file.size,
    });
  } catch (err: unknown) {
    console.error('Upload route internal error:', err);
    return NextResponse.json(
      { success: false, error: 'An error occurred while processing the file upload.' },
      { status: 500 }
    );
  }
}
