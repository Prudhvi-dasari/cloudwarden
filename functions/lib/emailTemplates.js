/**
 * SendToAnyone transactional email templates.
 *
 * prepareTransferMail renders each message with the matching subject,
 * HTML, and plain text. Do not pass passwords, claim tokens, or delete
 * tokens into these functions.
 *
 * buildBaseEmailHtml({ title, preheader, badgeText, heading, leadText, contentHtml, origin })
 * buildTransferEmailHtml({ sender, downloadUrl, fileCount, totalSize, note, isPasswordProtected, origin, expiryLabel })
 * buildTransferEmailText(same)
 * recipientTransferSubject(sender)
 * buildSenderConfirmationEmailHtml({ downloadUrl, fileCount, totalSize, origin, expiryLabel, isPasswordProtected })
 * buildSenderConfirmationEmailText(same)
 * senderConfirmationSubject()
 * buildFileRequestEmailHtml({ requester, uploadUrl, requestTitle, note, origin, expiryLabel })
 * buildFileRequestEmailText(same)
 * fileRequestSubject(requester)
 * buildExpiryReminderEmailHtml({ downloadUrl, fileCount, totalSize, origin, expiryLabel, isPasswordProtected })
 * buildExpiryReminderEmailText(same)
 * expiryReminderSubject()
 */

export const DEFAULT_TEMPLATE_ORIGIN = 'https://sendtoanyone.com';

const BRAND = 'SendToAnyone';
const FONT = "Arial, Helvetica, sans-serif";
const DISPLAY = "Georgia, 'Times New Roman', Times, serif";

const COLOR = {
  blue: '#1769F5',
  navy: '#0B1736',
  canvas: '#EFF6FF',
  periwinkle: '#E9EEFF',
  white: '#FFFFFF',
  ink: '#101828',
  muted: '#52617A',
  line: '#E3EAF5',
  panel: '#F8FAFD',
  alertBg: '#FEF2F2',
  alert: '#DC2626',
  alertLine: '#FECACA',
  passwordInk: '#102A56',
  passwordLine: '#D6E4FF',
};

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function cleanText(value, max) {
  return String(value ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
    .trim()
    .slice(0, max);
}

function formatBytes(bytes) {
  const size = Number(bytes);
  if (!Number.isFinite(size) || size <= 0) return '0 Bytes';
  const units = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(size) / Math.log(1024)));
  return `${(size / 1024 ** i).toFixed(i ? 1 : 0)} ${units[i]}`;
}

function fileSummary(fileCount) {
  const countNum = Number(fileCount) > 0 ? Math.min(Math.floor(Number(fileCount)), 1000) : 1;
  const countLabel = `${countNum} file${countNum === 1 ? '' : 's'}`;
  return { countNum, countLabel };
}

export function safeTemplateOrigin(value) {
  try {
    const url = new URL(value || DEFAULT_TEMPLATE_ORIGIN);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return DEFAULT_TEMPLATE_ORIGIN;
    return url.origin;
  } catch {
    return DEFAULT_TEMPLATE_ORIGIN;
  }
}

function safeHttpUrl(value) {
  const raw = String(value ?? '').replace(/[\u0000-\u001f\u007f\s]/g, '');
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return '';
    return url.toString();
  } catch {
    return '';
  }
}

function htmlBreaks(value) {
  return escapeHtml(value).replace(/\n/g, '<br>');
}

function textFooter(origin) {
  return [
    '—',
    BRAND,
    origin,
    `Privacy: ${origin}/privacy`,
    `Terms: ${origin}/terms`,
    `Help: ${origin}/help`,
  ].join('\n');
}

const FLUID = 'width:100%;max-width:100%;table-layout:fixed;';
const WRAP = 'word-wrap:break-word;overflow-wrap:anywhere;word-break:break-word;';

function fluidTable(extraStyle = '') {
  return `role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="${FLUID}${extraStyle}"`;
}

function breakableText(value) {
  return escapeHtml(value).replace(/([/:._?&=@-])/g, '$1<wbr>');
}

function primaryButton(href, label) {
  const safeHref = escapeHtml(href);
  const safeLabel = escapeHtml(label);
  return `<table class="btn-table" role="presentation" border="0" cellspacing="0" cellpadding="0" align="center" style="max-width:100%;">
                <tr>
                  <td class="btn-cell" align="center" bgcolor="${COLOR.blue}" style="background-color:${COLOR.blue};border-radius:6px;">
                    <!--[if mso]>
                    <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${safeHref}" style="height:46px;v-text-anchor:middle;width:248px;" arcsize="10%" strokecolor="${COLOR.blue}" fillcolor="${COLOR.blue}">
                      <w:anchorlock/>
                      <center style="color:${COLOR.white};font-family:Arial,sans-serif;font-size:16px;font-weight:bold;">${safeLabel}</center>
                    </v:roundrect>
                    <![endif]-->
                    <!--[if !mso]><!-->
                    <a class="btn-link" href="${safeHref}" target="_blank" style="display:inline-block;padding:14px 28px;font-family:${FONT};font-size:16px;font-weight:bold;line-height:1.2;color:${COLOR.white};text-decoration:none;border-radius:6px;background-color:${COLOR.blue};">${safeLabel}</a>
                    <!--<![endif]-->
                  </td>
                </tr>
              </table>`;
}

function fallbackLink(href) {
  const safeHref = escapeHtml(href);
  return `<p class="muted" style="margin:16px 0 0;font-family:${FONT};font-size:13px;line-height:1.5;color:${COLOR.muted};text-align:center;${WRAP}">If the button does not open, copy this link:<br><a href="${safeHref}" style="color:${COLOR.blue};text-decoration:underline;word-break:normal;overflow-wrap:break-word;">${breakableText(href)}</a></p>`;
}

function gap(px) {
  return `<table ${fluidTable()}><tr><td height="${px}" style="height:${px}px;font-size:0;line-height:${px}px;">&nbsp;</td></tr></table>`;
}

function detailRow(label, value, color, padBottom) {
  return `<tr>
                    <td style="padding:0 0 ${padBottom};font-family:${FONT};${WRAP}">
                      <div class="muted" style="font-size:12px;line-height:1.4;letter-spacing:0.04em;text-transform:uppercase;color:${COLOR.muted};">${escapeHtml(label)}</div>
                      <div class="ink" style="margin-top:4px;font-size:16px;line-height:1.4;font-weight:bold;color:${color};${WRAP}">${escapeHtml(value)}</div>
                    </td>
                  </tr>`;
}

function metaTable(rows) {
  const body = rows.map((row) => [
    detailRow(row.leftLabel, row.leftValue, COLOR.navy, '14px'),
    detailRow(row.rightLabel, row.rightValue, row.rightColor || COLOR.blue, '0'),
  ].join('')).join('');
  return `<table class="panel" ${fluidTable(`background-color:${COLOR.panel};border:1px solid ${COLOR.line};border-radius:10px;`)}>
              <tr>
                <td style="padding:16px 18px;${WRAP}">
                  <table ${fluidTable()}>
                    ${body}
                  </table>
                </td>
              </tr>
            </table>`;
}

function noteBlock(label, text) {
  return `<table ${fluidTable()}>
              <tr>
                <td class="ink panel" style="padding:16px 16px 14px;background-color:${COLOR.panel};border:1px solid ${COLOR.line};border-left:3px solid ${COLOR.blue};font-family:${DISPLAY};font-size:16px;line-height:1.5;color:${COLOR.ink};${WRAP}">
                  <div class="muted" style="margin:0 0 6px;font-family:${FONT};font-size:11px;line-height:1.4;letter-spacing:0.04em;text-transform:uppercase;color:${COLOR.muted};">${escapeHtml(label)}</div>
                  ${htmlBreaks(text)}
                </td>
              </tr>
            </table>`;
}

function passwordBlock(variant) {
  const detail = variant === 'sender'
    ? 'Share the password directly with recipients. It gates the download and is not included in this email.'
    : variant === 'reminder'
      ? 'Have the download password ready. It gates the download and is not included in this email.'
      : 'The sender needs to share it with you separately. It gates the download and is not included in this email.';
  return `<table ${fluidTable()}>
              <tr>
                <td class="callout" style="padding:16px 16px 14px;background-color:${COLOR.periwinkle};border:1px solid ${COLOR.passwordLine};border-radius:10px;font-family:${FONT};font-size:15px;line-height:1.5;color:${COLOR.passwordInk};${WRAP}">
                  <strong style="color:${COLOR.navy};">Password protected.</strong> ${detail}
                </td>
              </tr>
            </table>`;
}

function alertBlock(expiryLabel) {
  const safeExpiry = escapeHtml(expiryLabel);
  return `<table ${fluidTable()}>
              <tr>
                <td class="alert" style="padding:14px 16px;background-color:${COLOR.alertBg};border:1px solid ${COLOR.alertLine};border-radius:10px;font-family:${FONT};font-size:14px;line-height:1.5;color:${COLOR.alert};${WRAP}">
                  <strong style="color:${COLOR.alert};">This transfer expires in ${safeExpiry}.</strong> After that, the files are deleted.
                </td>
              </tr>
            </table>`;
}

export function buildBaseEmailHtml({
  title,
  preheader = '',
  badgeText = 'Transfer',
  heading,
  leadText,
  contentHtml,
  origin = DEFAULT_TEMPLATE_ORIGIN,
}) {
  const safeOrigin = safeTemplateOrigin(origin);
  const originHref = escapeHtml(safeOrigin);
  const safeTitle = escapeHtml(title || BRAND);
  const safePreheader = escapeHtml(preheader || '');
  const safeBadge = escapeHtml(badgeText || 'Transfer');
  const safeHeading = heading ? escapeHtml(heading) : '';
  const safeLead = leadText ? escapeHtml(leadText) : '';

  return `<!DOCTYPE html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>${safeTitle}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style>
    body, table, td, a { -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
    table, td { mso-table-lspace:0pt; mso-table-rspace:0pt; }
    table { border-collapse:collapse !important; }
    body { margin:0 !important; padding:0 !important; width:100% !important; }
    a { color:${COLOR.blue}; }
    .email-wrap, .email-shell { width:100% !important; max-width:600px !important; }
    @media screen and (max-width:600px) {
      .email-shell { width:100% !important; }
      .canvas-pad { padding:16px 8px !important; }
      .pad { padding:22px 16px !important; }
      .title { font-size:24px !important; line-height:1.3 !important; }
      .btn-table, .btn-cell, .btn-link { width:100% !important; max-width:100% !important; }
      .btn-link { display:block !important; box-sizing:border-box !important; text-align:center !important; }
    }
    @media (prefers-color-scheme: dark) {
      .canvas, body { background-color:#0B1736 !important; }
      .card { background-color:#13284A !important; border-color:#2A4068 !important; }
      .rule { border-color:#2A4068 !important; }
      .ink, .display { color:#F8FAFC !important; }
      .muted { color:#C5D0E6 !important; }
      .panel { background-color:#1A3058 !important; border-color:#2A4068 !important; }
      .callout { background-color:#243E6B !important; border-color:#3D5A8A !important; color:#F8FAFC !important; }
      .callout strong { color:#F8FAFC !important; }
      .alert { background-color:#3F1D24 !important; border-color:#7F1D1D !important; color:#FECACA !important; }
      .alert strong { color:#FECACA !important; }
      .footer { background-color:#102040 !important; border-color:#2A4068 !important; }
      .footer, .footer p { color:#C5D0E6 !important; }
      .btn-link { color:#FFFFFF !important; background-color:#1769F5 !important; }
    }
  </style>
</head>
<body class="canvas ink" style="margin:0;padding:0;background-color:${COLOR.canvas};color:${COLOR.ink};">
  ${safePreheader ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:${COLOR.canvas};">${safePreheader}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>` : ''}
  <table role="presentation" class="canvas" width="100%" border="0" cellspacing="0" cellpadding="0" bgcolor="${COLOR.canvas}" style="width:100%;table-layout:fixed;background-color:${COLOR.canvas};">
    <tr>
      <td class="canvas-pad" align="center" style="padding:32px 12px;${WRAP}">
        <div class="email-wrap" style="width:100%;max-width:600px;margin:0 auto;">
        <!--[if mso]><table role="presentation" width="600" align="center" border="0" cellspacing="0" cellpadding="0"><tr><td><![endif]-->
        <table role="presentation" class="email-shell card" width="100%" align="center" border="0" cellspacing="0" cellpadding="0" bgcolor="${COLOR.white}" style="width:100%;max-width:600px;table-layout:fixed;background-color:${COLOR.white};border:1px solid ${COLOR.line};border-radius:12px;">
          <tr>
            <td class="pad rule" style="padding:22px 32px;border-bottom:1px solid ${COLOR.line};${WRAP}">
              <table ${fluidTable()}>
                <tr>
                  <td class="display" width="68%" align="left" style="width:68%;font-family:${DISPLAY};font-size:20px;line-height:1.2;color:${COLOR.navy};${WRAP}">SendToAnyone</td>
                  <td class="badge" width="32%" align="right" style="width:32%;font-family:${FONT};font-size:12px;line-height:1.2;font-weight:bold;color:${COLOR.blue};${WRAP}">
                    <span style="display:inline-block;padding:4px 8px;background-color:${COLOR.periwinkle};border-radius:999px;">${safeBadge}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td class="pad ink" style="padding:32px 32px 28px;color:${COLOR.ink};${WRAP}">
              ${safeHeading ? `<h1 class="display title" style="margin:0 0 10px;font-family:${DISPLAY};font-size:28px;line-height:1.25;font-weight:normal;color:${COLOR.navy};${WRAP}">${safeHeading}</h1>` : ''}
              ${safeLead ? `<p class="muted" style="margin:0 0 24px;font-family:${FONT};font-size:16px;line-height:1.5;color:${COLOR.muted};${WRAP}">${safeLead}</p>` : ''}
              ${contentHtml || ''}
            </td>
          </tr>
          <tr>
            <td class="pad rule footer" align="center" bgcolor="${COLOR.panel}" style="padding:18px 32px 22px;background-color:${COLOR.panel};border-top:1px solid ${COLOR.line};font-family:${FONT};font-size:13px;line-height:1.6;color:${COLOR.muted};text-align:center;${WRAP}">
              <p class="muted" style="margin:0;font-family:${FONT};font-size:13px;line-height:1.6;color:${COLOR.muted};">This message is about a file transfer.</p>
              <p class="muted" style="margin:6px 0 0;font-family:${FONT};font-size:13px;line-height:1.6;color:${COLOR.muted};">
                <a href="${originHref}" style="color:${COLOR.blue};text-decoration:none;font-weight:bold;">SendToAnyone</a>
                &nbsp;&middot;&nbsp;
                <a href="${originHref}/privacy" style="color:${COLOR.blue};text-decoration:none;">Privacy</a>
                &nbsp;&middot;&nbsp;
                <a href="${originHref}/terms" style="color:${COLOR.blue};text-decoration:none;">Terms</a>
                &nbsp;&middot;&nbsp;
                <a href="${originHref}/help" style="color:${COLOR.blue};text-decoration:none;">Help</a>
              </p>
            </td>
          </tr>
        </table>
        <!--[if mso]></td></tr></table><![endif]-->
        </div>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function transferFields(fields) {
  const origin = safeTemplateOrigin(fields.origin);
  const downloadUrl = safeHttpUrl(fields.downloadUrl);
  const sender = cleanText(fields.sender, 120) || 'Someone';
  const note = cleanText(fields.note, 1000);
  const expiryLabel = cleanText(fields.expiryLabel, 80) || 'Up to 7 days';
  const { countNum, countLabel } = fileSummary(fields.fileCount);
  const sizeLabel = formatBytes(fields.totalSize);
  return {
    origin,
    downloadUrl,
    sender,
    note,
    expiryLabel,
    countNum,
    countLabel,
    sizeLabel,
    isPasswordProtected: Boolean(fields.isPasswordProtected),
  };
}

export function recipientTransferSubject(sender) {
  return `${cleanText(sender, 120) || 'Someone'} sent you files via SendToAnyone`;
}

export function buildTransferEmailText(fields = {}) {
  const data = transferFields(fields);
  const lines = [
    `${data.sender} sent you files via SendToAnyone.`,
    '',
    `Files shared with you (${data.countNum}, ${data.sizeLabel}):`,
    data.downloadUrl || data.origin,
    '',
    `Expires in: ${data.expiryLabel}`,
    '',
  ];
  if (data.isPasswordProtected) {
    lines.push(
      'A password is required to download these files.',
      'This password gates the download. The sender shares it with you separately. It is not in this email.',
      '',
    );
  }
  if (data.note) {
    lines.push(data.note, '');
  }
  lines.push(textFooter(data.origin));
  return lines.join('\n');
}

export function buildTransferEmailHtml(fields = {}) {
  const data = transferFields(fields);
  const href = data.downloadUrl || data.origin;
  const contentHtml = `
            ${metaTable([{
              leftLabel: 'Files',
              leftValue: `${data.countLabel} (${data.sizeLabel})`,
              rightLabel: 'Available for',
              rightValue: data.expiryLabel,
            }])}
            ${data.note ? gap(16) + noteBlock('Message', data.note) : ''}
            ${data.isPasswordProtected ? gap(16) + passwordBlock() : ''}
            ${gap(24)}
            <table ${fluidTable()}>
              <tr>
                <td align="center" style="${WRAP}">
                  ${primaryButton(href, 'Download files')}
                  ${fallbackLink(href)}
                </td>
              </tr>
            </table>`;

  return buildBaseEmailHtml({
    title: recipientTransferSubject(data.sender),
    preheader: `${data.sender} shared ${data.countLabel} (${data.sizeLabel}) on SendToAnyone. Available for ${data.expiryLabel}.`,
    badgeText: 'Transfer',
    heading: `${data.sender} sent you files`,
    leadText: 'Open the transfer to download the files. No account is required.',
    contentHtml,
    origin: data.origin,
  });
}

export function renderRecipientTransfer(fields = {}) {
  return {
    subject: recipientTransferSubject(fields.sender),
    html: buildTransferEmailHtml(fields),
    text: buildTransferEmailText(fields),
  };
}

function confirmationFields(fields) {
  const origin = safeTemplateOrigin(fields.origin);
  const downloadUrl = safeHttpUrl(fields.downloadUrl);
  const expiryLabel = cleanText(fields.expiryLabel, 80) || 'Up to 7 days';
  const { countNum, countLabel } = fileSummary(fields.fileCount);
  const sizeLabel = formatBytes(fields.totalSize);
  return {
    origin,
    downloadUrl,
    expiryLabel,
    countNum,
    countLabel,
    sizeLabel,
    isPasswordProtected: Boolean(fields.isPasswordProtected),
  };
}

export function senderConfirmationSubject() {
  return 'Your SendToAnyone transfer is ready to share';
}

export function buildSenderConfirmationEmailText(fields = {}) {
  const data = confirmationFields(fields);
  const lines = [
    'Your SendToAnyone transfer is ready to share.',
    '',
    `Your files have been uploaded to SendToAnyone (${data.countNum} file${data.countNum === 1 ? '' : 's'}, ${data.sizeLabel}).`,
    data.downloadUrl || data.origin,
    '',
    `Expires in: ${data.expiryLabel}`,
    '',
    'Share this link with your recipients.',
  ];
  if (data.isPasswordProtected) {
    lines.push(
      '',
      'Password protected. A password is required to download these files. Share it directly. It is not included in this email.',
    );
  }
  lines.push('', textFooter(data.origin));
  return lines.join('\n');
}

export function buildSenderConfirmationEmailHtml(fields = {}) {
  const data = confirmationFields(fields);
  const href = data.downloadUrl || data.origin;
  const safeHref = escapeHtml(href);
  const contentHtml = `
            ${metaTable([{
              leftLabel: 'Uploaded',
              leftValue: `${data.countLabel} (${data.sizeLabel})`,
              rightLabel: 'Available for',
              rightValue: data.expiryLabel,
            }])}
            ${gap(16)}
            <table ${fluidTable()}>
              <tr>
                <td class="panel" style="padding:16px 16px 14px;background-color:${COLOR.panel};border:1px solid ${COLOR.line};border-radius:10px;font-family:${FONT};${WRAP}">
                  <div class="muted" style="font-size:11px;line-height:1.4;letter-spacing:0.04em;text-transform:uppercase;color:${COLOR.muted};">Download link</div>
                  <div style="margin-top:6px;font-family:Consolas, 'Courier New', monospace;font-size:13px;line-height:1.5;word-break:normal;overflow-wrap:break-word;">
                    <a href="${safeHref}" style="color:${COLOR.blue};text-decoration:underline;word-break:normal;overflow-wrap:break-word;">${breakableText(href)}</a>
                  </div>
                </td>
              </tr>
            </table>
            ${data.isPasswordProtected ? gap(16) + passwordBlock('sender') : ''}
            ${gap(24)}
            <table ${fluidTable()}>
              <tr>
                <td align="center" style="${WRAP}">
                  ${primaryButton(href, 'View transfer')}
                  ${fallbackLink(href)}
                </td>
              </tr>
            </table>`;

  return buildBaseEmailHtml({
    title: senderConfirmationSubject(),
    preheader: `${data.countLabel} (${data.sizeLabel}) uploaded. The link is available for ${data.expiryLabel}.`,
    badgeText: 'Ready',
    heading: 'Your transfer is ready to share',
    leadText: 'The files are uploaded. Send the link to the people who should download them.',
    contentHtml,
    origin: data.origin,
  });
}

export function renderSenderConfirmation(fields = {}) {
  return {
    subject: senderConfirmationSubject(),
    html: buildSenderConfirmationEmailHtml(fields),
    text: buildSenderConfirmationEmailText(fields),
  };
}

function requestFields(fields) {
  const origin = safeTemplateOrigin(fields.origin);
  const uploadUrl = safeHttpUrl(fields.uploadUrl);
  const requester = cleanText(fields.requester, 120) || 'Someone';
  const requestTitle = cleanText(fields.requestTitle, 120) || 'File request';
  const note = cleanText(fields.note, 1000);
  const expiryLabel = cleanText(fields.expiryLabel, 80) || 'Up to 7 days';
  return { origin, uploadUrl, requester, requestTitle, note, expiryLabel };
}

export function fileRequestSubject(requester) {
  return `${cleanText(requester, 120) || 'Someone'} requested files from you via SendToAnyone`;
}

export function buildFileRequestEmailText(fields = {}) {
  const data = requestFields(fields);
  const lines = [
    `${data.requester} requested files from you on SendToAnyone.`,
    '',
    `Request: ${data.requestTitle}`,
    data.uploadUrl || data.origin,
    '',
    `Expires in: ${data.expiryLabel}`,
  ];
  if (data.note) {
    lines.push('', `Instructions: "${data.note}"`);
  }
  lines.push(
    '',
    'No account is required to upload. A cloud transfer can be up to 6 GB.',
    '',
    textFooter(data.origin),
  );
  return lines.join('\n');
}

export function buildFileRequestEmailHtml(fields = {}) {
  const data = requestFields(fields);
  const href = data.uploadUrl || data.origin;
  const contentHtml = `
            ${metaTable([{
              leftLabel: 'Request',
              leftValue: data.requestTitle,
              rightLabel: 'Open for',
              rightValue: data.expiryLabel,
            }])}
            ${data.note ? gap(16) + noteBlock(`From ${data.requester}`, data.note) : ''}
            ${gap(24)}
            <table ${fluidTable()}>
              <tr>
                <td align="center" style="${WRAP}">
                  ${primaryButton(href, 'Upload files')}
                  ${fallbackLink(href)}
                </td>
              </tr>
            </table>`;

  return buildBaseEmailHtml({
    title: fileRequestSubject(data.requester),
    preheader: `${data.requester} asked for "${data.requestTitle}". The upload page is open for ${data.expiryLabel}.`,
    badgeText: 'Request',
    heading: `${data.requester} requested files from you`,
    leadText: 'No account is required. A cloud transfer can be up to 6 GB.',
    contentHtml,
    origin: data.origin,
  });
}

export function renderFileRequest(fields = {}) {
  return {
    subject: fileRequestSubject(fields.requester),
    html: buildFileRequestEmailHtml(fields),
    text: buildFileRequestEmailText(fields),
  };
}

function reminderFields(fields) {
  const data = confirmationFields(fields);
  return {
    ...data,
    expiryLabel: cleanText(fields.expiryLabel, 80) || 'Soon',
  };
}

export function expiryReminderSubject() {
  return 'Action required: Your SendToAnyone files expire soon';
}

export function buildExpiryReminderEmailText(fields = {}) {
  const data = reminderFields(fields);
  const lines = [
    'Reminder: Your SendToAnyone transfer expires soon.',
    '',
    `${data.countNum} file${data.countNum === 1 ? '' : 's'}, ${data.sizeLabel}`,
    data.downloadUrl || data.origin,
    '',
    `Expires in: ${data.expiryLabel}`,
    '',
    'Please download your files before they are deleted.',
  ];
  if (data.isPasswordProtected) {
    lines.push(
      '',
      'A password is required to download these files.',
      'Password protected. This password gates the download. It is not included in this email.',
    );
  }
  lines.push('', textFooter(data.origin));
  return lines.join('\n');
}

export function buildExpiryReminderEmailHtml(fields = {}) {
  const data = reminderFields(fields);
  const href = data.downloadUrl || data.origin;
  const home = escapeHtml(data.origin);
  const contentHtml = `
            ${alertBlock(data.expiryLabel)}
            ${gap(16)}
            <table ${fluidTable()}>
              <tr>
                <td style="${WRAP}">
                  ${metaTable([{
                    leftLabel: 'Files',
                    leftValue: `${data.countLabel} (${data.sizeLabel})`,
                    rightLabel: 'Expires in',
                    rightValue: data.expiryLabel,
                    rightColor: COLOR.alert,
                  }])}
                </td>
              </tr>
            </table>
            ${data.isPasswordProtected ? gap(16) + passwordBlock('reminder') : ''}
            ${gap(24)}
            <table ${fluidTable()}>
              <tr>
                <td align="center" style="${WRAP}">
                  ${primaryButton(href, 'Download files')}
                  ${fallbackLink(href)}
                  <p class="muted" style="margin:18px 0 0;font-family:${FONT};font-size:13px;line-height:1.5;color:${COLOR.muted};text-align:center;${WRAP}">Need to send something else? <a href="${home}/" style="color:${COLOR.blue};text-decoration:underline;">Start a new transfer</a></p>
                </td>
              </tr>
            </table>`;

  return buildBaseEmailHtml({
    title: expiryReminderSubject(),
    preheader: `${data.countLabel} (${data.sizeLabel}) expire in ${data.expiryLabel}. Download them before they are deleted.`,
    badgeText: 'Expiring',
    heading: 'Your transfer expires soon',
    leadText: 'Download the files before this transfer ends. After that, the files are deleted.',
    contentHtml,
    origin: data.origin,
  });
}

export function renderExpiryReminder(fields = {}) {
  return {
    subject: expiryReminderSubject(),
    html: buildExpiryReminderEmailHtml(fields),
    text: buildExpiryReminderEmailText(fields),
  };
}
