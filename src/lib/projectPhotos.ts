import fs from 'fs';
import path from 'path';
import { PROJECTS_DATA, ProjectData } from '@/data/projectsData';

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
