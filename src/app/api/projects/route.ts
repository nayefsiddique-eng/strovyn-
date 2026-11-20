import { connection, NextResponse } from 'next/server';
import { getProjectsWithOverridesAsync } from '@/lib/projectPhotos';

export async function GET() {
  await connection();
  const projects = await getProjectsWithOverridesAsync();
  return NextResponse.json(
    { success: true, projects },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
