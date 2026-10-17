import nodemailer from 'nodemailer';

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatDate(dateStr) {
  try {
    const d = dateStr ? new Date(dateStr) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const options = { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true };
    return d.toLocaleDateString('en-US', options);
  } catch (e) {
    return 'in 7 days';
  }
}

export default async function handler(req, res) {
  // CORS handling
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      senderEmail,
      recipientEmails,
      subject,
      message,
      shareId,
      fileCount,
      totalSize,
      expiresAt,
      isPasswordProtected,
    } = req.body || {};

    if (!recipientEmails || !shareId) {
      return res.status(400).json({ error: 'Missing recipient emails or shareId' });
    }

    const appOrigin = process.env.APP_URL || 'https://itransfer.iprudhvi.in';
    const downloadUrl = `${appOrigin}/download/${shareId}`;
    const displaySubject = subject || `${fileCount || 1} file${fileCount !== 1 ? 's' : ''}`;
    const emailSubject = `${senderEmail || 'Someone'} has sent you "${displaySubject}" via iTransfer`;
    const formattedExpiry = formatDate(expiresAt);
    const smtpSender = process.env.EMAIL_FROM_ADDRESS || 'send@iprudhvi.in';

    // Exact TransferNow / WeTransfer High-End Dark Theme Template
    const createHtmlTemplate = (recipient) => `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${emailSubject}</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #121217; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #ffffff; -webkit-font-smoothing: antialiased;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #121217; padding: 32px 16px;">
        <tr>
          <td align="center">
            <table role="presentation" width="100%" style="max-width: 520px; background-color: #181820; border-radius: 20px; border: 1px solid #272733; overflow: hidden; text-align: center;">
              
              <!-- Brand Header -->
              <tr>
                <td style="padding: 36px 24px 20px 24px;">
                  <div style="font-size: 26px; font-weight: 900; letter-spacing: -0.5px; color: #7c83fd; font-style: italic; font-family: 'Helvetica Neue', Helvetica, sans-serif;">
                    itransfer
                  </div>
                </td>
              </tr>

              <!-- Main Title / Transfer Notification -->
              <tr>
                <td style="padding: 10px 28px 24px 28px;">
                  <h1 style="margin: 0 0 20px 0; font-size: 19px; font-weight: 800; color: #ffffff; line-height: 1.45;">
                    <a href="mailto:${senderEmail || ''}" style="color: #60a5fa; text-decoration: none;">${senderEmail || 'A sender'}</a> sent you "${displaySubject}" via iTransfer, a secure large file sending and receiving service
                  </h1>

                  <div style="font-size: 14px; color: #e2e8f0; font-weight: 600; margin-bottom: 6px;">
                    ${fileCount || 1} file of ${formatBytes(totalSize)}
                  </div>

                  <div style="font-size: 13px; color: #94a3b8; margin-bottom: 28px;">
                    You can safely download your file until ${formattedExpiry}.
                  </div>

                  <!-- Primary CTA Button -->
                  <div style="margin-bottom: 32px;">
                    <a href="${downloadUrl}" target="_blank" style="display: inline-block; background-color: #7c83fd; color: #ffffff; font-size: 15px; font-weight: 700; text-decoration: none; padding: 14px 38px; border-radius: 10px; box-shadow: 0 4px 18px rgba(124, 131, 253, 0.35); text-align: center;">
                      Go to download
                    </a>
                  </div>

                  ${message ? `
                  <!-- Sender Message Box -->
                  <div style="background-color: #20202c; border-left: 3px solid #7c83fd; border-radius: 8px; padding: 12px 16px; margin-bottom: 24px; text-align: left;">
                    <div style="font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; margin-bottom: 4px;">Message from sender:</div>
                    <div style="font-size: 13px; color: #f1f5f9; line-height: 1.5; font-style: italic;">"${message}"</div>
                  </div>
                  ` : ''}

                  <!-- Download Link Section -->
                  <div style="text-align: left; margin-bottom: 24px; border-top: 1px solid #272733; pt: 20px; padding-top: 20px;">
                    <div style="font-size: 13px; font-weight: 800; color: #ffffff; margin-bottom: 6px;">
                      Download link
                    </div>
                    <a href="${downloadUrl}" style="color: #60a5fa; font-size: 13px; text-decoration: none; word-break: break-all; line-height: 1.4;">
                      ${downloadUrl}
                    </a>
                  </div>

                  <!-- File List Breakdown -->
                  <div style="text-align: left; background-color: #1f1f2a; border-radius: 12px; border: 1px solid #2e2e3e; padding: 14px 16px; margin-bottom: 24px;">
                    <div style="font-size: 13px; font-weight: 800; color: #ffffff; margin-bottom: 6px;">
                      ${fileCount || 1} file (${formatBytes(totalSize)})
                    </div>
                    <div style="font-size: 12px; color: #94a3b8;">
                      — ${displaySubject} <span style="color: #64748b;">(${formatBytes(totalSize)})</span>
                    </div>
                  </div>

                  <!-- Prohibited or contacts notice -->
                  <div style="border-top: 1px solid #272733; padding-top: 20px; font-size: 11.5px; color: #94a3b8; line-height: 1.6; text-align: center;">
                    <p style="margin: 0 0 12px 0;">
                      To be sure to receive our emails, please add the address <span style="color: #e2e8f0; font-weight: 600;">${smtpSender}</span> to your contacts.
                    </p>
                    <p style="margin: 0;">
                      Does this transfer contain prohibited or malicious files?<br>
                      <a href="${appOrigin}/help" style="color: #94a3b8; text-decoration: underline;">I report this transfer</a>
                    </p>
                  </div>

                </td>
              </tr>

              <!-- Footer Links -->
              <tr>
                <td style="background-color: #15151c; padding: 18px 24px; text-align: center; border-top: 1px solid #272733; font-size: 11px; color: #64748b;">
                  <a href="${appOrigin}/features" style="color: #94a3b8; text-decoration: none; margin: 0 6px;">About iTransfer</a> •
                  <a href="${appOrigin}/help" style="color: #94a3b8; text-decoration: none; margin: 0 6px;">Get help</a> •
                  <a href="${appOrigin}/terms" style="color: #94a3b8; text-decoration: none; margin: 0 6px;">Terms of use</a> •
                  <a href="${appOrigin}/privacy" style="color: #94a3b8; text-decoration: none; margin: 0 6px;">Privacy</a>
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
    `;

    const recipients = Array.isArray(recipientEmails)
      ? recipientEmails
      : recipientEmails.split(',').map(e => e.trim()).filter(Boolean);

    let dispatchedCount = 0;

    // Method A: Apple iCloud SMTP (Verified & delivers to ANY recipient globally)
    const smtpUser = process.env.SMTP_USER || 'prudhvidasari67@icloud.com';
    const smtpPass = process.env.SMTP_PASS || 'gdyt-brvb-ecge-qcnw';
    const smtpHost = process.env.SMTP_HOST || 'smtp.mail.me.com';
    const smtpPort = parseInt(process.env.SMTP_PORT || '587');

    if (smtpUser && smtpPass) {
      try {
        const transporter = nodemailer.createTransport({
          host: smtpHost,
          port: smtpPort,
          secure: smtpPort === 465,
          auth: {
            user: smtpUser,
            pass: smtpPass,
          },
          tls: {
            rejectUnauthorized: false,
          },
        });

        for (const recipient of recipients) {
          await transporter.sendMail({
            from: '"iTransfer" <send@iprudhvi.in>',
            sender: smtpUser,
            replyTo: senderEmail || 'send@iprudhvi.in',
            to: recipient,
            subject: emailSubject,
            html: createHtmlTemplate(recipient),
          });
          dispatchedCount++;
        }

        if (dispatchedCount > 0) {
          return res.status(200).json({
            success: true,
            provider: 'icloud_smtp',
            dispatchedCount,
            downloadUrl,
            message: `Successfully delivered to ${dispatchedCount} recipient(s) via Apple iCloud`,
          });
        }
      } catch (smtpErr) {
        console.warn('iCloud SMTP dispatch error:', smtpErr);
      }
    }

    // Method B: Resend API Fallback
    const resendKey = process.env.RESEND_API_KEY || '';
    if (resendKey) {
      for (const recipient of recipients) {
        try {
          const resendRes = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${resendKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: process.env.EMAIL_FROM || 'iTransfer <onboarding@resend.dev>',
              reply_to: senderEmail || 'contact@iprudhvi.in',
              to: [recipient],
              subject: emailSubject,
              html: createHtmlTemplate(recipient),
            }),
          });
          const resData = await resendRes.json();
          if (resendRes.ok) {
            dispatchedCount++;
          }
        } catch (err) {
          console.warn('Resend error for', recipient, err);
        }
      }

      if (dispatchedCount > 0) {
        return res.status(200).json({
          success: true,
          provider: 'resend',
          dispatchedCount,
          downloadUrl,
          message: `Successfully delivered to ${dispatchedCount} recipient(s)`,
        });
      }
    }

    // Method C: Brevo API (Free 300 emails/day)
    if (process.env.BREVO_API_KEY || process.env.SENDINBLUE_API_KEY) {
      const apiKey = process.env.BREVO_API_KEY || process.env.SENDINBLUE_API_KEY;
      for (const recipient of recipients) {
        await fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: {
            'api-key': apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sender: { name: 'iTransfer', email: process.env.BREVO_SENDER_EMAIL || 'support@iprudhvi.in' },
            replyTo: senderEmail ? { email: senderEmail } : undefined,
            to: [{ email: recipient }],
            subject: emailSubject,
            htmlContent: createHtmlTemplate(recipient),
          }),
        });
        dispatchedCount++;
      }

      return res.status(200).json({
        success: true,
        provider: 'brevo',
        dispatchedCount,
        downloadUrl,
      });
    }

    const mailtoUrl = `mailto:${recipients.join(',')}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(`Hi,\n\nI shared files with you via iTransfer (${fileCount || 1} files, ${formatBytes(totalSize)}):\n${downloadUrl}\n\n${message ? `Message: "${message}"\n\n` : ''}Best regards!`)}`;
    const gmailWebUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(recipients.join(','))}&su=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(`Hi,\n\nI shared files with you via iTransfer (${fileCount || 1} files, ${formatBytes(totalSize)}):\n${downloadUrl}\n\n${message ? `Message: "${message}"\n\n` : ''}Best regards!`)}`;

    // Response when link is ready and client mail triggers are active
    return res.status(200).json({
      success: false,
      reason: 'no_smtp_configured',
      provider: 'client_fallback',
      message: 'Email transfer link generated. Set SMTP_USER & SMTP_PASS in Vercel for automated background sending.',
      downloadUrl,
      recipients,
      mailtoUrl,
      gmailWebUrl,
    });

  } catch (err) {
    console.error('Email API Error:', err);
    return res.status(200).json({
      success: false,
      message: 'Email transfer link generated',
      details: err.message,
    });
  }
}
