import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  renderExpiryReminder,
  renderFileRequest,
  renderRecipientTransfer,
  renderSenderConfirmation,
} from '../functions/lib/emailTemplates.js';

const ORIGIN = 'https://sendtoanyone.com';

export const PREVIEW_FIXTURES = [
  {
    file: '1-recipient-transfer-standard',
    title: 'Recipient transfer',
    render: () => renderRecipientTransfer({
      sender: 'Jordan Lee',
      downloadUrl: `${ORIGIN}/d/studio-notes`,
      fileCount: 4,
      totalSize: 1468006400,
      note: 'Here are the edited stills and the short cut from yesterday. Let me know if you need another size.',
      isPasswordProtected: false,
      origin: ORIGIN,
      expiryLabel: '7 days',
    }),
  },
  {
    file: '2-recipient-transfer-urgent-password',
    title: 'Recipient transfer, password gate',
    render: () => renderRecipientTransfer({
      sender: 'Alexandra Worthington-Blake',
      downloadUrl: `${ORIGIN}/d/studio-north-autumn-campaign-stills`,
      fileCount: 1,
      totalSize: 5980000000,
      note: 'Please use the password I sent you separately.',
      isPasswordProtected: true,
      origin: ORIGIN,
      expiryLabel: '3 hours',
    }),
  },
  {
    file: '3-sender-confirmation',
    title: 'Sender confirmation',
    render: () => renderSenderConfirmation({
      downloadUrl: `${ORIGIN}/d/presentation-deck`,
      fileCount: 2,
      totalSize: 45000000,
      origin: ORIGIN,
      expiryLabel: '7 days',
      isPasswordProtected: false,
    }),
  },
  {
    file: '3b-sender-confirmation-password',
    title: 'Sender confirmation, password gate',
    render: () => renderSenderConfirmation({
      downloadUrl: `${ORIGIN}/d/presentation-deck`,
      fileCount: 2,
      totalSize: 45000000,
      origin: ORIGIN,
      expiryLabel: '7 days',
      isPasswordProtected: true,
    }),
  },
  {
    file: '4-file-request',
    title: 'File request',
    render: () => renderFileRequest({
      requester: 'Studio North',
      uploadUrl: `${ORIGIN}/request/brand-assets`,
      requestTitle: 'Brand identity files',
      note: 'Please send the logo SVG and a PDF of the guidelines.',
      origin: ORIGIN,
      expiryLabel: '5 days',
    }),
  },
  {
    file: '5-expiry-reminder',
    title: 'Expiry reminder',
    render: () => renderExpiryReminder({
      downloadUrl: `${ORIGIN}/d/weekend-film`,
      fileCount: 18,
      totalSize: 4200000000,
      origin: ORIGIN,
      expiryLabel: '4 hours',
      isPasswordProtected: true,
    }),
  },
];

export function previewDirectory() {
  return path.resolve(import.meta.dirname, 'email-previews');
}

function reviewIndex(entries) {
  const sections = entries.map((entry) => `  <section>
    <h2>${entry.title}</h2>
    <p><a href="${entry.file}.txt">Plain text</a></p>
    <div class="frames">
      <div>
        <p>Desktop, 640px frame</p>
        <iframe class="desktop" title="${entry.title} desktop" src="${entry.file}.html"></iframe>
      </div>
      <div>
        <p>Mobile, 390px frame</p>
        <iframe class="mobile" title="${entry.title} mobile" src="${entry.file}.html"></iframe>
      </div>
    </div>
  </section>`).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>SendToAnyone email previews</title>
  <style>
    body { margin: 0; background: #e7eef8; color: #101828; font-family: Arial, Helvetica, sans-serif; }
    header, section { padding: 24px; }
    h1 { margin: 0 0 8px; font-family: Georgia, 'Times New Roman', serif; font-weight: normal; font-size: 32px; }
    h2 { margin: 0 0 8px; font-size: 18px; }
    p { color: #52617A; }
    .frames { display: flex; gap: 24px; align-items: flex-start; flex-wrap: wrap; }
    iframe { border: 1px solid #E3EAF5; background: #EFF6FF; height: 860px; }
    .desktop { width: 640px; }
    .mobile { width: 390px; }
  </style>
</head>
<body>
  <header>
    <h1>SendToAnyone email previews</h1>
    <p>Local review only. These files are not sent.</p>
  </header>
${sections}
</body>
</html>`;
}

export function renderPreviewFiles() {
  const outputDir = previewDirectory();
  fs.mkdirSync(outputDir, { recursive: true });
  const written = [];
  for (const fixture of PREVIEW_FIXTURES) {
    const rendered = fixture.render();
    fs.writeFileSync(path.join(outputDir, `${fixture.file}.html`), rendered.html, 'utf8');
    fs.writeFileSync(path.join(outputDir, `${fixture.file}.txt`), rendered.text, 'utf8');
    written.push({ file: fixture.file, title: fixture.title });
  }
  fs.writeFileSync(path.join(outputDir, 'index.html'), reviewIndex(written), 'utf8');
  return outputDir;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const outputDir = renderPreviewFiles();
  console.log(`Wrote ${PREVIEW_FIXTURES.length} email previews to ${outputDir}`);
}
