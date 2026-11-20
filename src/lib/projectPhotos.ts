import 'server-only';
import fs from 'fs';
import path from 'path';
import { PROJECTS_DATA, ProjectData } from '@/data/projectsData';
import {
  createServiceRoleClient,
  isServiceRoleConfigured,
} from '@/lib/supabase/serviceRole';

const OVERRIDES_FILE = path.join(process.cwd(), 'private_storage', 'project_photo_overrides.json');

export interface PhotoOverride {
  heroImage?: string;
  galleryImages?: string[];
  updatedAt: string;
}

export type PhotoOverridesMap = Record<string, PhotoOverride>;

function ensureDirExists(filePath: string) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function getPhotoOverrides(): PhotoOverridesMap {
  try {
    if (fs.existsSync(OVERRIDES_FILE)) {
      const data = fs.readFileSync(OVERRIDES_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Failed to read photo overrides:', err);
  }
  return {};
}

export function savePhotoOverride(slug: string, override: Partial<PhotoOverride>): boolean {
  if (process.env.NODE_ENV === 'production') {
    // Local JSON write is disabled in production — Supabase is required
    console.error('CRITICAL: Local photo override writes are disabled in production.');
    return false;
  }

  try {
    ensureDirExists(OVERRIDES_FILE);
    const current = getPhotoOverrides();
    const existing = current[slug] || { updatedAt: new Date().toISOString() };
    
    current[slug] = {
      ...existing,
      ...override,
      updatedAt: new Date().toISOString(),
    };

    fs.writeFileSync(OVERRIDES_FILE, JSON.stringify(current, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error('Failed to save photo override:', err);
    return false;
  }
}

export function getProjectsWithOverrides(): ProjectData[] {
  const overrides = getPhotoOverrides();
  return PROJECTS_DATA.map((project) => {
    const override = overrides[project.slug];
    if (!override) return project;

    return {
      ...project,
      heroImage: override.heroImage || project.heroImage,
      galleryImages: override.galleryImages || project.galleryImages,
    };
  });
}

export async function getPhotoOverridesAsync(): Promise<PhotoOverridesMap> {
  if (isServiceRoleConfigured()) {
    try {
      const supabase = createServiceRoleClient();
      const { data, error } = await supabase
        .from('project_photo_overrides')
        .select('slug, hero_image_url, gallery_image_urls, updated_at');

      if (!error && Array.isArray(data)) {
        const mapped: PhotoOverridesMap = {};
        for (const row of data) {
          const r = row as {
            slug: string;
            hero_image_url: string | null;
            gallery_image_urls: unknown;
            updated_at: string;
          };
          mapped[r.slug] = {
            ...(r.hero_image_url ? { heroImage: r.hero_image_url } : {}),
            ...(Array.isArray(r.gallery_image_urls)
              ? { galleryImages: r.gallery_image_urls.filter((x): x is string => typeof x === 'string') }
              : {}),
            updatedAt: r.updated_at || new Date().toISOString(),
          };
        }
        return mapped;
      }
    } catch (err) {
      console.error('Failed to read photo overrides from Supabase:', err);
    }
  }
  return getPhotoOverrides();
}

export async function savePhotoOverrideAsync(
  slug: string,
  override: Partial<PhotoOverride>,
  updatedByStaffId?: string | null
): Promise<boolean> {
  if (isServiceRoleConfigured()) {
    try {
      const supabase = createServiceRoleClient();
      const { data: existingRow } = await supabase
        .from('project_photo_overrides')
        .select('hero_image_url, gallery_image_urls')
        .eq('slug', slug)
        .maybeSingle();

      const existing = existingRow as {
        hero_image_url: string | null;
        gallery_image_urls: string[] | null;
      } | null;

      const payload = {
        slug,
        hero_image_url:
          override.heroImage !== undefined
            ? override.heroImage
            : existing?.hero_image_url ?? null,
        gallery_image_urls:
          override.galleryImages !== undefined
            ? override.galleryImages
            : existing?.gallery_image_urls ?? null,
        updated_by_staff_id: updatedByStaffId ?? null,
      };

      const { error } = await supabase
        .from('project_photo_overrides')
        .upsert(payload, { onConflict: 'slug' });

      if (!error) {
        return true;
      }
      console.error('Failed to persist photo override to Supabase:', error);
      return false;
    } catch (err) {
      console.error('Supabase photo override error:', err);
      return false;
    }
  }

  return savePhotoOverride(slug, override);
}

export async function getProjectsWithOverridesAsync(): Promise<ProjectData[]> {
  const overrides = await getPhotoOverridesAsync();
  return PROJECTS_DATA.map((project) => {
    const override = overrides[project.slug];
    if (!override) return project;

    return {
      ...project,
      heroImage: override.heroImage || project.heroImage,
      galleryImages: override.galleryImages || project.galleryImages,
    };
  });
}
