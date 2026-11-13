import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import { cookies } from 'next/headers';
import { PROJECTS_DATA } from '@/data/projectsData';
import { getProjectsWithOverrides, savePhotoOverride, getPhotoOverrides } from '@/lib/projectPhotos';

// Default secure admin key if not set in environment
const ADMIN_ACCESS_KEY = process.env.STROVYN_ADMIN_KEY || 'strovyn-craft-2026';
const SESSION_COOKIE_NAME = 'strovyn_admin_session';

function verifySession(cookieStore: Awaited<ReturnType<typeof cookies>>): boolean {
  const session = cookieStore.get(SESSION_COOKIE_NAME);
  return session?.value === 'authenticated_admin_valid';
}

// GET: Returns list of projects and their photos (requires auth)
export async function GET() {
  const cookieStore = await cookies();
  if (!verifySession(cookieStore)) {
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

// POST: Handles login OR photo replacement
export async function POST(req: Request) {
  const cookieStore = await cookies();

  // Check if this is a login request
  const contentType = req.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const body = await req.json();
    if (body.action === 'login') {
      if (body.key === ADMIN_ACCESS_KEY) {
        cookieStore.set(SESSION_COOKIE_NAME, 'authenticated_admin_valid', {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: 60 * 60 * 24 * 7, // 7 days
          path: '/',
        });
        return NextResponse.json({ success: true, message: 'Authentication successful' });
      } else {
        return NextResponse.json({ success: false, error: 'Invalid access key' }, { status: 403 });
      }
    }

    if (body.action === 'logout') {
      cookieStore.delete(SESSION_COOKIE_NAME);
      return NextResponse.json({ success: true, message: 'Logged out' });
    }
  }

  // All other operations require authenticated session
  if (!verifySession(cookieStore)) {
    return NextResponse.json({ success: false, error: 'Unauthorized access' }, { status: 401 });
  }

  // Handle file upload & photo replacement
  try {
    const formData = await req.formData();
    const slug = formData.get('slug') as string;
    const type = formData.get('type') as 'hero' | 'gallery';
    const indexStr = formData.get('index') as string;
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
      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        return NextResponse.json(
          { success: false, error: 'Invalid image format. JPEG, PNG, or WebP only.' },
          { status: 400 }
        );
      }

      // Max 10MB
      if (file.size > 10 * 1024 * 1024) {
        return NextResponse.json(
          { success: false, error: 'Image exceeds 10MB limit.' },
          { status: 400 }
        );
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const ext = path.extname(file.name) || '.jpg';
      const cleanFileName = `${slug}-${type}-${Date.now()}${ext}`;
      const saveDir = path.join(process.cwd(), 'public', 'images', 'projects');

      if (!fs.existsSync(saveDir)) {
        fs.mkdirSync(saveDir, { recursive: true });
      }

      const fullFilePath = path.join(saveDir, cleanFileName);
      fs.writeFileSync(fullFilePath, buffer);
      finalImageUrl = `/images/projects/${cleanFileName}`;
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
  } catch (error) {
    console.error('Photo replacement error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error while replacing photo' }, { status: 500 });
  }
}
