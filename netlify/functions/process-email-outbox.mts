import { invokeAuthenticatedCronEndpoint } from '../../src/lib/cms/netlifyCronAdapter';

export const config = {
  schedule: '*/5 * * * *',
};

export default async function handler() {
  const result = await invokeAuthenticatedCronEndpoint('/api/cron/process-email-outbox');
  if (!result.ok) {
    console.error('[Netlify Cron] process-email-outbox failed:', {
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
