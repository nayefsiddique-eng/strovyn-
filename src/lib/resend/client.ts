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
  const recipientEmail =
    process.env.NOTIFICATION_EMAIL || process.env.ADMIN_EMAIL;

  if (!resend) {
    console.info(`[RESEND NOTICE: Integration ready, awaiting RESEND_API_KEY] Subject: ${subject}`);
    return { success: false, configured: false };
  }

  if (!recipientEmail) {
    console.warn(`[RESEND NOTICE: Missing NOTIFICATION_EMAIL destination] Subject: ${subject}`);
    return { success: false, configured: false, error: 'Notification recipient not configured' };
  }

  try {
    const fromEmail =
      process.env.RESEND_FROM_EMAIL || 'Strovyn Notifications <notifications@strovyn.com>';
    const result = await resend.emails.send({
      from: fromEmail,
      to: [recipientEmail],
      subject,
      html,
    });
    if (result.error) {
      console.error('Resend API returned error:', result.error.message);
      return { success: false, configured: true, error: result.error.message };
    }
    return { success: true, configured: true, data: result.data };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('Failed to send Resend email:', msg);
    return { success: false, configured: true, error: msg };
  }
};
