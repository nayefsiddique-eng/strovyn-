import { invokeAuthenticatedCronEndpoint } from '../../src/lib/cms/netlifyCronAdapter';

export const config = {
  schedule: '0 * * * *',
};

export default async function handler() {
  const result = await invokeAuthenticatedCronEndpoint('/api/cron/cleanup-uploads');
  if (!result.ok) {
    console.error('[Netlify Cron] cleanup-uploads failed:', {
      status: result.status,
      error: result.error,
    });
    return new Response(JSON.stringify(result), {
      status: result.status >= 400 ? result.status : 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return new Response(JSON.stringify(result), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
