import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import { isSupabaseConfigured } from '@/lib/db/mockData';
import { createClient as createSupabaseClient } from '@/lib/supabase/server';

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
  'image/webp',
];

const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15MB

// Simple rate limiter: max 10 uploads per IP per 5 minutes
const uploadRateMap = new Map<string, number[]>();

export async function POST(req: Request) {
  try {
    const clientIp = req.headers.get('x-forwarded-for') || 'local-client';
    const now = Date.now();
    const timestamps = (uploadRateMap.get(clientIp) || []).filter((t) => now - t < 300000);
    if (timestamps.length >= 10) {
      return NextResponse.json(
        { success: false, error: 'Upload rate limit exceeded. Please wait a few minutes.' },
        { status: 429 }
      );
    }
    timestamps.push(now);
    uploadRateMap.set(clientIp, timestamps);

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const category = (formData.get('category') as string) === 'resumes' ? 'resumes' : 'documents';

    if (!file) {
      return NextResponse.json({ success: false, error: 'No file provided.' }, { status: 400 });
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid file format. Only PDF, DOC, DOCX, JPEG, PNG, and WebP are accepted.',
        },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, error: 'File size exceeds maximum 15MB limit.' },
        { status: 400 }
      );
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const sanitizedOriginalName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const uniqueFileName = `${Date.now()}-${sanitizedOriginalName}`;

    // 1. If Supabase is connected with private storage buckets
    if (isSupabaseConfigured()) {
      try {
        const supabase = await createSupabaseClient();
        const bucket = category === 'resumes' ? 'resumes' : 'documents';
        const { data, error } = await supabase.storage
          .from(bucket)
          .upload(`private/${uniqueFileName}`, fileBuffer, {
            contentType: file.type,
            upsert: false,
          });

        if (!error && data) {
          return NextResponse.json({
            success: true,
            storage: 'supabase-private',
            fileReference: `supabase://${bucket}/${data.path}`,
            fileName: sanitizedOriginalName,
          });
        }
      } catch (err) {
        console.error('Supabase private storage fallback to local private storage:', err);
      }
    }

    // 2. Local SECURE PRIVATE Storage (OUTSIDE /public/ to prevent direct URL sniffing)
    const privateDir = path.join(process.cwd(), 'private_storage', 'uploads', category);
    if (!fs.existsSync(privateDir)) {
      fs.mkdirSync(privateDir, { recursive: true });
    }

    const destinationPath = path.join(privateDir, uniqueFileName);
    fs.writeFileSync(destinationPath, fileBuffer);

    // Return a private internal token/reference ID — NEVER a public web link
    return NextResponse.json({
      success: true,
      storage: 'local-private',
      fileReference: `private://${category}/${uniqueFileName}`,
      fileName: sanitizedOriginalName,
      fileSize: file.size,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: 'An error occurred processing the file.' }, { status: 500 });
  }
}

// Disallow GET to prevent directory traversal or file sniffing
export async function GET() {
  return NextResponse.json({ success: false, error: 'Method Not Allowed' }, { status: 405 });
}
