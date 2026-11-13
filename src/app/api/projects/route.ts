import { NextResponse } from 'next/server';
import { getProjectsWithOverrides } from '@/lib/projectPhotos';

export async function GET() {
  const projects = getProjectsWithOverrides();
  return NextResponse.json({ success: true, projects });
}
