# STROVYN Painting Co. — Client Operations Guide

## 1. Signing In to the Admin Portal
- **URL:** `https://strovynpainting.netlify.app/admin` (or `https://strovynpaints.com/admin` once your custom domain is connected).
- *(Note: While the website is in Private pre-launch mode, visitors must first sign in through Netlify's site access prompt before `/admin` loads.)*
- Enter your staff email (`strovyn@gmail.com` or `nayefsiddique@gmail.com`) and your personal password, then click **Sign In**. Use the eye icon to verify password typing, and use the header **Sun/Moon** button anytime to switch between Light and Dark mode.

## 2. How Staff Accounts & Invitations Work (`/admin/staff`)
- Only **Administrators** can open **Staff Management** (`/admin/staff`).
- **Invite Employee:** Enter full name, email, and role (**Editor**, **Publisher**, or **Admin**), then click **Send Invitation**.
  - **Editor:** Creates and edits draft articles, projects, and testimonials; cannot publish publicly or manage staff.
  - **Publisher:** Reviews, approves, and publishes/unpublishes content, and manages submissions.
  - **Admin:** Full access including inviting/disabling staff and changing roles.
- **Onboarding:** The invited employee clicks the single-use email link (`/admin/activate`), sets their own 12+ character password, and signs in.
- **Resend / Revoke / Disable:** Use `/admin/staff` to resend expired invitations, revoke pending invitations, or disable a former employee's access immediately. The system prevents accidentally removing the last active Admin.

## 3. Managing Projects (`/admin/projects`) & Insights (`/admin/insights`)
- **Projects:** Create a draft, upload project cover/gallery/before-after photos, preview, and **Publish** only after client approval. *(Note: `North Adelaide Villa Residence` is safely stored as a `draft` until you choose to publish it).*
- **Insights:** Draft articles in the rich-text editor, upload editorial images, submit for review, and publish when approved. Unapproved drafts never appear on the public website.

## 4. Managing Careers (`/admin/careers`), Enquiries (`/admin/quotes`, `/admin/applications`), & Testimonials (`/admin/testimonials`)
- **Careers:** Create job openings, set closing dates, or close vacancies to stop new applications.
- **Quotes & Applications:** View customer quote requests, feedback, and job applications in the CMS. Uploaded customer files and CVs are stored in private storage (`customer-documents`) and can only be downloaded by signed-in staff.
- **Testimonials (`/admin/testimonials` & `/admin/feedback`):** Customer feedback is private by default. Only testimonials with verified consent that are explicitly **Approved** and **Published** appear on the public website.

## 5. Using the Wall Colour Visualiser (`/visualiser`)
- Visitors can preview **72 illustrative architectural colours across 14 families** and **5 finishes** (`Matte`, `Eggshell`, `Satin`, `Semi-Gloss`, `Gloss`) on the sample room or their own uploaded room photo (processed 100% locally in their browser).
- Use **Tap Wall (Smart Fill)**, **Brush**, or **Eraser** to select walls, drag the **Before / After** slider to compare against the original unmodified room, and click **Save PNG** or **Request Quote With This Finish**.

## 6. Password Recovery & Access Issues
- **Forgot Password:** On `/admin`, enter your email and click **Forgot Password** to receive a single-use recovery link targeting `/admin/activate`.
- **Change Password (While Signed In):** Click **Change Password** in the top bar of the CMS.
- **Rate Limits:** Until custom SMTP (`strovynpaints.com` via Resend) is connected, Supabase's built-in mailer is limited to **2 emails per hour** — use normal email/password login for daily work.

## 7. Service Ownership & Support
- **Hosting (Netlify):** Site `strovynpainting` (`bc5329ac-218d-4e9f-b0fc-da52f6e29700`) — pending in-place transfer to client's Netlify team.
- **Database & Auth (Supabase):** `qktgxxbmdvmpyipltamo` (`Strovyn` organization). Upgrading to Supabase Pro (`$25/mo`) is recommended before live customer traffic to prevent 7-day inactivity pausing and enable daily backups.
- **Domain & Email:** Register `strovynpaints.com` under client ownership, verify it in Resend (`DKIM`/`SPF`), and then enable customer acknowledgments and scheduled jobs.
- **Rollback Support:** If any deployment issue occurs, an Administrator/Developer can restore the previous build in one click from **Netlify → `strovynpainting` → Deploys → Publish deploy**.
