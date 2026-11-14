import { Resend } from 'resend';

const resendApiKey = process.env.RESEND_API_KEY;

export const resend = resendApiKey ? new Resend(resendApiKey) : null;

export const sendNotificationEmail = async ({
  subject,
  html,
}: {
  subject: string;
  html: string;
}) => {
  if (!resend) {
    console.info(`[RESEND NOTICE: Integration ready, awaiting RESEND_API_KEY] Subject: ${subject}`);
    return { success: false, configured: false };
  }

  try {
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@strovynpainting.com';
    const data = await resend.emails.send({
      from: 'Strovyn Notifications <notifications@strovynpainting.com>',
      to: [adminEmail],
      subject,
      html,
    });
    return { success: true, data };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('Failed to send Resend email:', msg);
    return { success: false, error: msg };
  }
};
