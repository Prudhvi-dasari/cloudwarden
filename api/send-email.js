// Legacy Vercel-style handler. Cloudflare Pages does not execute this file.
// Production mail is functions/api/send-email.js, which calls functions/lib/mailService.js.
// Do not configure Pages secrets for this handler, and do not treat it as the live sender.
import nodemailer from 'nodemailer';
import { publicOrigin } from '../functions/lib/canonicalHost.js';
import {
  buildTransferEmailHtml,
  buildSenderConfirmationEmailHtml,
  buildFileRequestEmailHtml,
  buildExpiryReminderEmailHtml,
  DEFAULT_EMAIL_FROM,
  formatExpiryLabel,
} from '../functions/lib/mailService.js';

export { DEFAULT_EMAIL_FROM };
const EMAIL_PATTERN = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i;

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
  } catch {
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
      expiryHours,
      isPasswordProtected,
    } = req.body || {};

    if (!recipientEmails || !shareId) {
      return res.status(400).json({ error: 'Missing recipient emails or shareId' });
    }

    const appOrigin = publicOrigin(process.env.APP_URL || 'https://sendtoanyone.com');
    const downloadUrl = `${appOrigin}/d/${shareId}`;
    const displaySubject = subject || `${fileCount || 1} file${fileCount !== 1 ? 's' : ''}`;
    const emailSubject = `${senderEmail || 'Someone'} has sent you "${displaySubject}" via SendToAnyone`;
    const formattedExpiry = formatDate(expiresAt);
    const expiryLabel = formatExpiryLabel(expiresAt, expiryHours);
    const fromAddress = process.env.EMAIL_FROM_ADDRESS || process.env.EMAIL_FROM || DEFAULT_EMAIL_FROM;
    const senderRaw = typeof senderEmail === 'string' ? senderEmail.trim() : '';
    const senderIsEmail = EMAIL_PATTERN.test(senderRaw) && senderRaw.length <= 254;
    const validatedReplyTo = senderIsEmail
      ? senderRaw.toLowerCase()
      : (process.env.EMAIL_REPLY_TO && EMAIL_PATTERN.test(process.env.EMAIL_REPLY_TO.trim()) ? process.env.EMAIL_REPLY_TO.trim() : null);
    const smtpSender = fromAddress;

    const eventType = req.body?.eventType || req.body?.type || 'recipient_transfer';
    let emailHtml;
    if (eventType === 'sender_confirmation') {
      emailHtml = buildSenderConfirmationEmailHtml({
        downloadUrl,
        fileCount,
        totalSize,
        origin: appOrigin,
        expiryLabel,
        isPasswordProtected: Boolean(isPasswordProtected),
      });
    } else if (eventType === 'file_request') {
      emailHtml = buildFileRequestEmailHtml({
        requester: senderEmail || 'Someone',
        uploadUrl: downloadUrl,
        requestTitle: subject || 'File Request',
        note: message,
        origin: appOrigin,
        expiryLabel,
      });
    } else if (eventType === 'expiry_reminder') {
      emailHtml = buildExpiryReminderEmailHtml({
        downloadUrl,
        fileCount,
        totalSize,
        origin: appOrigin,
        expiryLabel,
        isPasswordProtected: Boolean(isPasswordProtected),
      });
    } else {
      emailHtml = buildTransferEmailHtml({
        sender: senderEmail || 'Someone',
        downloadUrl,
        fileCount,
        totalSize,
        note: message,
        isPasswordProtected: Boolean(isPasswordProtected),
        origin: appOrigin,
        expiryLabel,
      });
    }

    const recipients = Array.isArray(recipientEmails)
      ? recipientEmails
      : recipientEmails.split(',').map(e => e.trim()).filter(Boolean);

    let dispatchedCount = 0;

    // Method A: Apple iCloud SMTP (Verified & delivers to ANY recipient globally)
    const smtpUser = process.env.SMTP_USER || '';
    const smtpPass = process.env.SMTP_PASS || '';
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
            from: fromAddress,
            sender: smtpUser,
            ...(validatedReplyTo ? { replyTo: validatedReplyTo } : {}),
            to: recipient,
            subject: emailSubject,
            html: emailHtml,
          });
          dispatchedCount++;
        }

        if (dispatchedCount > 0) {
          return res.status(200).json({
            success: true,
            provider: 'icloud_smtp',
            dispatchedCount,
            downloadUrl,
            message: `The mail provider accepted ${dispatchedCount} message(s). Delivery is not confirmed.`,
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
              from: fromAddress,
              ...(validatedReplyTo ? { reply_to: validatedReplyTo } : {}),
              to: [recipient],
              subject: emailSubject,
              html: emailHtml,
            }),
          });
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
          message: `The mail provider accepted ${dispatchedCount} message(s). Delivery is not confirmed.`,
        });
      }
    }

    // Method C: Brevo API (Free 300 emails/day)
    if (process.env.BREVO_API_KEY || process.env.SENDINBLUE_API_KEY) {
      const apiKey = process.env.BREVO_API_KEY || process.env.SENDINBLUE_API_KEY;
      const fromEmailOnly = fromAddress.match(/<([^>]+)>/)?.[1] || fromAddress;
      for (const recipient of recipients) {
        await fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: {
            'api-key': apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sender: { name: 'SendToAnyone', email: process.env.BREVO_SENDER_EMAIL || fromEmailOnly },
            ...(validatedReplyTo ? { replyTo: { email: validatedReplyTo } } : {}),
            to: [{ email: recipient }],
            subject: emailSubject,
            htmlContent: emailHtml,
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

    const mailtoUrl = `mailto:${recipients.join(',')}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(`Hi,\n\nI shared files with you via SendToAnyone (${fileCount || 1} files, ${formatBytes(totalSize)}):\n${downloadUrl}\n\nExpires in: ${expiryLabel}\n${message ? `Message: "${message}"\n\n` : ''}Best regards!`)}`;
    const gmailWebUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(recipients.join(','))}&su=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(`Hi,\n\nI shared files with you via SendToAnyone (${fileCount || 1} files, ${formatBytes(totalSize)}):\n${downloadUrl}\n\nExpires in: ${expiryLabel}\n${message ? `Message: "${message}"\n\n` : ''}Best regards!`)}`;

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
