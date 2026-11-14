import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import { cookies } from 'next/headers';
import { PROJECTS_DATA } from '@/data/projectsData';
import { getProjectsWithOverrides, savePhotoOverride, getPhotoOverrides } from '@/lib/projectPhotos';
import {
  verifyAdminKey,
  createSessionToken,
  verifySessionToken,
  invalidateSession,
} from '@/lib/security/auth';
import { checkRateLimit } from '@/lib/security/rateLimiter';
import { validateUploadFile } from '@/lib/security/fileValidation';
import { isSupabaseConfigured } from '@/lib/db/mockData';
import { createClient as createSupabaseClient } from '@/lib/supabase/server';

const SESSION_COOKIE_NAME = 'strovyn_admin_session';

/**
 * Validates Origin/Host for CSRF defense on state mutations
 */
function verifyCsrf(req: Request): boolean {
  const origin = req.headers.get('origin');
  const host = req.headers.get('host');
  if (!origin || !host) return true; // Non-browser / same-origin relative
  try {
    const originUrl = new URL(origin);
    return originUrl.host === host;
  } catch {
    return false;
  }
}

// GET: Returns list of projects and their current photos (requires signed session)
export async function GET() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = verifySessionToken(sessionToken);

  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const projects = getProjectsWithOverrides();
  return NextResponse.json({
    success: true,
    projects: projects.map((p) => ({
      slug: p.slug,
      title: p.title,
      category: p.category,
      location: p.location,
      heroImage: p.heroImage,
      galleryImages: p.galleryImages,
    })),
  });
}

// POST: Handles login, logout, OR photo replacement
export async function POST(req: Request) {
  const cookieStore = await cookies();

  // CSRF verification on all POST requests
  if (!verifyCsrf(req)) {
    return NextResponse.json({ success: false, error: 'CSRF validation failed' }, { status: 403 });
  }

  const contentType = req.headers.get('content-type') || '';

  // 1. JSON Actions: Login & Logout
  if (contentType.includes('application/json')) {
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON request format' }, { status: 400 });
    }

    // LOGIN ACTION
    if (body.action === 'login') {
      const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'local-client';
      const rateCheck = await checkRateLimit(`admin_login_${clientIp}`, 5, 900000); // 5 attempts per 15 mins
      if (!rateCheck.allowed) {
        return NextResponse.json(
          {
            success: false,
            error: `Too many login attempts. Please wait ${rateCheck.retryAfterSec || 60} seconds.`,
          },
          { status: 429 }
        );
      }

      if (!body.key || typeof body.key !== 'string') {
        return NextResponse.json({ success: false, error: 'Access key is required' }, { status: 400 });
      }

      if (!verifyAdminKey(body.key)) {
        return NextResponse.json({ success: false, error: 'Invalid administration key' }, { status: 403 });
      }

      const token = createSessionToken();
      if (!token) {
        console.error('CRITICAL: ADMIN_SESSION_SECRET is missing. Cannot sign session token.');
        return NextResponse.json(
          { success: false, error: 'Server configuration error. Contact administrator.' },
          { status: 500 }
        );
      }

      cookieStore.set(SESSION_COOKIE_NAME, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 8 * 60 * 60, // 8 hours
        path: '/',
      });

      return NextResponse.json({ success: true, message: 'Authentication successful' });
    }

    // LOGOUT ACTION
    if (body.action === 'logout') {
      const currentToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
      if (currentToken) {
        invalidateSession(currentToken);
      }
      cookieStore.delete(SESSION_COOKIE_NAME);
      return NextResponse.json({ success: true, message: 'Logged out successfully' });
    }
  }

  // 2. All mutation operations require a valid HMAC-signed session
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = verifySessionToken(sessionToken);

  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized access' }, { status: 401 });
  }

  // 3. Handle File Upload & Photo Replacement
  try {
    const formData = await req.formData();
    const slug = formData.get('slug') as string | null;
    const type = formData.get('type') as 'hero' | 'gallery' | null;
    const indexStr = formData.get('index') as string | null;
    const file = formData.get('file') as File | null;
    const directUrl = formData.get('url') as string | null;

    if (!slug) {
      return NextResponse.json({ success: false, error: 'Project slug is required' }, { status: 400 });
    }

    const project = PROJECTS_DATA.find((p) => p.slug === slug);
    if (!project) {
      return NextResponse.json({ success: false, error: 'Project not found' }, { status: 404 });
    }

    let finalImageUrl = '';

    if (file) {
      const allowedImageMimes = ['image/jpeg', 'image/png', 'image/webp'];
      const fileBuffer = Buffer.from(await file.arrayBuffer());

      const validation = validateUploadFile(
        fileBuffer,
        file.name,
        file.type,
        allowedImageMimes,
        10 * 1024 * 1024 // 10MB
      );

      if (!validation.valid || !validation.sanitizedFilename) {
        return NextResponse.json(
          { success: false, error: validation.error || 'Invalid image file.' },
          { status: 400 }
        );
      }

      const cleanFileName = validation.sanitizedFilename;

      // In production with Supabase Storage
      if (isSupabaseConfigured()) {
        try {
          const supabase = await createSupabaseClient();
          const bucket = 'project-photos';
          const { data, error } = await supabase.storage
            .from(bucket)
            .upload(`${slug}/${cleanFileName}`, fileBuffer, {
              contentType: validation.detectedType || file.type,
              upsert: false,
            });

          if (!error && data) {
            const { data: pubData } = supabase.storage.from(bucket).getPublicUrl(data.path);
            finalImageUrl = pubData.publicUrl;
          }
        } catch (err) {
          console.error('Supabase storage upload failed:', err);
        }
      }

      // Production guard: Fail closed if in production without Supabase Storage
      if (!finalImageUrl && process.env.NODE_ENV === 'production') {
        return NextResponse.json(
          {
            success: false,
            error: 'Production cloud storage is unconfigured. Cannot persist uploads.',
          },
          { status: 503 }
        );
      }

      // Development local fallback
      if (!finalImageUrl) {
        const saveDir = path.join(process.cwd(), 'public', 'images', 'projects');
        if (!fs.existsSync(saveDir)) {
          fs.mkdirSync(saveDir, { recursive: true });
        }
        const fullFilePath = path.join(saveDir, cleanFileName);
        fs.writeFileSync(fullFilePath, fileBuffer);
        finalImageUrl = `/images/projects/${cleanFileName}`;
      }
    } else if (directUrl) {
      finalImageUrl = directUrl.trim();
    } else {
      return NextResponse.json({ success: false, error: 'No image file or URL provided' }, { status: 400 });
    }

    // Apply override
    const currentOverrides = getPhotoOverrides();
    const projectOverride = currentOverrides[slug] || { updatedAt: new Date().toISOString() };

    if (type === 'hero') {
      savePhotoOverride(slug, { heroImage: finalImageUrl });
    } else if (type === 'gallery') {
      const galleryIndex = parseInt(indexStr || '0', 10);
      const currentGallery = projectOverride.galleryImages || [...project.galleryImages];
      if (galleryIndex >= 0 && galleryIndex < currentGallery.length) {
        currentGallery[galleryIndex] = finalImageUrl;
      } else {
        currentGallery.push(finalImageUrl);
      }
      savePhotoOverride(slug, { galleryImages: currentGallery });
    }

    return NextResponse.json({
      success: true,
      newUrl: finalImageUrl,
      slug,
      type,
      message: 'Photo updated successfully',
    });
  } catch (err: unknown) {
    console.error('Admin photos operation error:', err);
    return NextResponse.json(
      { success: false, error: 'An error occurred while replacing the photograph.' },
      { status: 500 }
    );
  }
}
