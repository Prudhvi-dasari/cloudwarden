import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  buildExpiryReminderEmailHtml,
  buildExpiryReminderEmailText,
  buildFileRequestEmailHtml,
  buildFileRequestEmailText,
  buildSenderConfirmationEmailHtml,
  buildSenderConfirmationEmailText,
  buildTransferEmailHtml,
  buildTransferEmailText,
  expiryReminderSubject,
  fileRequestSubject,
  recipientTransferSubject,
  senderConfirmationSubject,
} from '../functions/lib/emailTemplates.js';
import { PREVIEW_FIXTURES, previewDirectory, renderPreviewFiles } from './email-preview-generator.mjs';

const ORIGIN = 'https://sendtoanyone.com';

const BANNED_GOLD_PATTERNS = [
  /#c4a574/i,
  /#e2cb9b/i,
  /#b3925c/i,
  /#141722/i,
  /#08090d/i,
  /#0f1118/i,
  /champagne/i,
  /gold/i,
];

const BANNED_CLAIMS = [
  /zero-knowledge/i,
  /end-to-end/i,
  /e2ee/i,
  /only you can read/i,
];

const SECRET_PATTERNS = [
  /mailbox-secret/i,
  /claimToken/i,
  /deleteToken/i,
  /password_hash/i,
  /service_role/i,
  /sk_live/i,
  /re_[A-Za-z0-9]/,
  /eyJ[A-Za-z0-9_-]{12,}/,
  /prudhvi/i,
  /@gmail\.com/i,
  /Bearer\s+/i,
];

function assertBrandShell(html) {
  for (const pattern of BANNED_GOLD_PATTERNS) {
    assert.equal(pattern.test(html), false, `template must not contain ${pattern}`);
  }
  for (const pattern of BANNED_CLAIMS) {
    assert.equal(pattern.test(html), false, `template must not claim ${pattern}`);
  }
  assert.match(html, /#1769F5/);
  assert.match(html, /#0B1736/);
  assert.match(html, /#EFF6FF/);
  assert.match(html, /#E9EEFF/);
  assert.match(html, /#FFFFFF/);
  assert.match(html, /#101828/);
  assert.match(html, /#52617A/);
  assert.match(html, /#E3EAF5/);
  assert.match(html, /role="presentation"/);
  assert.match(html, /max-width:600px/);
  assert.match(html, /width="600"/);
  assert.match(html, /table-layout:fixed/);
  assert.match(html, /overflow-wrap:anywhere/);
  assert.match(html, /@media screen and \(max-width:600px\)/);
  assert.equal(/<img\b/i.test(html), false);
  assert.equal(/\ssrc\s*=/i.test(html), false);
  assert.equal(/background-image/i.test(html), false);
  assert.equal(/url\(/i.test(html), false);
  assert.equal(/<script\b/i.test(html), false);
  assert.equal(/javascript:/i.test(html), false);
  assert.match(html, /SendToAnyone/);
  assert.match(html, /\/privacy/);
  assert.match(html, /\/terms/);
  assert.match(html, /\/help/);
}

function assertPlainText(text, url) {
  assert.equal(text.includes('<table'), false);
  assert.equal(text.includes('<a '), false);
  assert.equal(text.includes('<html'), false);
  assert.match(text, /SendToAnyone/);
  assert.match(text, /Expires in:/);
  assert.ok(text.includes(url));
  assert.match(text, /Privacy:/);
  assert.match(text, /Terms:/);
  assert.match(text, /Help:/);
  for (const pattern of BANNED_CLAIMS) {
    assert.equal(pattern.test(text), false, `plain text must not claim ${pattern}`);
  }
}

test('recipient transfer email pairs HTML and plain text', () => {
  const fields = {
    sender: 'Ada Lovelace',
    downloadUrl: `${ORIGIN}/d/math-notes`,
    fileCount: 3,
    totalSize: 104857600,
    note: 'Important calculations',
    isPasswordProtected: true,
    origin: ORIGIN,
    expiryLabel: '3 days',
  };
  const html = buildTransferEmailHtml(fields);
  const text = buildTransferEmailText(fields);

  assert.equal(recipientTransferSubject(fields.sender), 'Ada Lovelace sent you files via SendToAnyone');
  assertBrandShell(html);
  assertPlainText(text, fields.downloadUrl);
  assert.match(html, /Ada Lovelace sent you files/);
  assert.match(html, /Download files/);
  assert.match(html, /Password protected/);
  assert.match(html, /gates the download/);
  assert.match(html, /Important calculations/);
  assert.match(html, /3 files \(100\.0 MB\)/);
  assert.match(html, /3 days/);
  assert.match(html, /https:\/\/sendtoanyone\.com\/d\/math-notes/);
  assert.match(text, /Files shared with you \(3, 100\.0 MB\)/);
  assert.match(text, /Expires in: 3 days/);
  assert.match(text, /A password is required to download these files/);
  assert.match(text, /Important calculations/);
});

test('sender confirmation email pairs HTML and plain text', () => {
  const fields = {
    downloadUrl: `${ORIGIN}/d/report-q3`,
    fileCount: 1,
    totalSize: 5242880,
    origin: ORIGIN,
    expiryLabel: '7 days',
    isPasswordProtected: false,
  };
  const html = buildSenderConfirmationEmailHtml(fields);
  const text = buildSenderConfirmationEmailText(fields);

  assert.equal(senderConfirmationSubject(), 'Your SendToAnyone transfer is ready to share');
  assertBrandShell(html);
  assertPlainText(text, fields.downloadUrl);
  assert.match(html, /Ready/);
  assert.match(html, /Your transfer is ready to share/);
  assert.match(html, /View transfer/);
  assert.match(html, /1 file \(5\.0 MB\)/);
  assert.match(text, /Your files have been uploaded to SendToAnyone \(1 file, 5\.0 MB\)/);
  assert.equal(/Password protected/.test(html), false);
});

test('sender confirmation tells the sender to share a download password separately', () => {
  const html = buildSenderConfirmationEmailHtml({
    downloadUrl: `${ORIGIN}/d/report-q3`,
    fileCount: 1,
    totalSize: 5242880,
    origin: ORIGIN,
    expiryLabel: '7 days',
    isPasswordProtected: true,
  });
  const text = buildSenderConfirmationEmailText({
    downloadUrl: `${ORIGIN}/d/report-q3`,
    fileCount: 1,
    totalSize: 5242880,
    origin: ORIGIN,
    expiryLabel: '7 days',
    isPasswordProtected: true,
  });
  assert.match(html, /Password protected/);
  assert.match(html, /Share the password directly with recipients/);
  assert.match(text, /A password is required to download these files/);
  assert.equal(text.includes('secret-value'), false);
});

test('file request email pairs HTML and plain text', () => {
  const fields = {
    requester: 'Design Lead',
    uploadUrl: `${ORIGIN}/request/brand-assets`,
    requestTitle: 'Brand identity files',
    note: 'Please send the logo SVG.',
    origin: ORIGIN,
    expiryLabel: '5 days',
  };
  const html = buildFileRequestEmailHtml(fields);
  const text = buildFileRequestEmailText(fields);

  assert.equal(fileRequestSubject(fields.requester), 'Design Lead requested files from you via SendToAnyone');
  assertBrandShell(html);
  assertPlainText(text, fields.uploadUrl);
  assert.match(html, /Design Lead requested files from you/);
  assert.match(html, /Brand identity files/);
  assert.match(html, /Please send the logo SVG\./);
  assert.match(html, /Upload files/);
  assert.match(html, /up to 6 GB/);
  assert.match(text, /Design Lead requested files from you on SendToAnyone/);
  assert.match(text, /Instructions: "Please send the logo SVG\."/);
  assert.match(text, /No account is required to upload/);
});

test('expiry reminder email pairs HTML and plain text', () => {
  const fields = {
    downloadUrl: `${ORIGIN}/d/weekend-film`,
    fileCount: 5,
    totalSize: 209715200,
    origin: ORIGIN,
    expiryLabel: '4 hours',
    isPasswordProtected: true,
  };
  const html = buildExpiryReminderEmailHtml(fields);
  const text = buildExpiryReminderEmailText(fields);

  assert.equal(expiryReminderSubject(), 'Action required: Your SendToAnyone files expire soon');
  assertBrandShell(html);
  assertPlainText(text, fields.downloadUrl);
  assert.match(html, /#FEF2F2/);
  assert.match(html, /#DC2626/);
  assert.match(html, /Expiring/);
  assert.match(html, /Your transfer expires soon/);
  assert.match(html, /Download files/);
  assert.match(html, /Start a new transfer/);
  assert.match(html, /Password protected/);
  assert.match(html, /gates the download/);
  assert.match(html, /deleted/);
  assert.match(text, /Reminder: Your SendToAnyone transfer expires soon/);
  assert.match(text, /Expires in: 4 hours/);
  assert.match(text, /A password is required to download these files/);
});

test('templates escape user content and drop non-http links', () => {
  const html = buildTransferEmailHtml({
    sender: 'Ada Lovelace <ada@example.com>',
    downloadUrl: 'javascript:alert(1)',
    fileCount: 1,
    totalSize: 1048576,
    note: '<script>alert("xss")</script> & "quotes"',
    origin: ORIGIN,
    expiryLabel: '1 hour',
  });
  const text = buildTransferEmailText({
    sender: 'Ada Lovelace <ada@example.com>',
    downloadUrl: 'javascript:alert(1)',
    fileCount: 1,
    totalSize: 1048576,
    note: '<script>alert("xss")</script> & "quotes"',
    origin: ORIGIN,
    expiryLabel: '24 hours',
  });

  assert.equal(html.includes('<script>'), false);
  assert.equal(html.includes('javascript:'), false);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /&amp;/);
  assert.match(html, /Ada Lovelace &lt;ada@example\.com&gt;/);
  assert.match(html, /1 hour/);
  assert.match(text, /Expires in: 24 hours/);
  assert.match(text, /<script>alert\("xss"\)<\/script>/);
  assert.equal(text.includes('javascript:'), false);
});

test('omitted origin uses the public site origin already used in the app', () => {
  const html = buildTransferEmailHtml({
    sender: 'Someone',
    downloadUrl: 'https://sendtoanyone.com/d/studio-notes',
    fileCount: 1,
    totalSize: 1024,
    expiryLabel: '3 days',
  });
  assert.match(html, /https:\/\/sendtoanyone\.com\/privacy/);
  assert.match(html, /https:\/\/sendtoanyone\.com\/help/);
});

test('local previews cover every template in HTML and plain text', () => {
  const outputDir = renderPreviewFiles();
  assert.equal(outputDir, previewDirectory());
  const names = fs.readdirSync(outputDir);

  for (const fixture of PREVIEW_FIXTURES) {
    const rendered = fixture.render();
    const htmlPath = path.join(outputDir, `${fixture.file}.html`);
    const textPath = path.join(outputDir, `${fixture.file}.txt`);
    assert.equal(fs.readFileSync(htmlPath, 'utf8'), rendered.html);
    assert.equal(fs.readFileSync(textPath, 'utf8'), rendered.text);
    assertBrandShell(rendered.html);
    assert.ok(rendered.text.length > 40);
    const combined = `${rendered.html}\n${rendered.text}`;
    for (const pattern of SECRET_PATTERNS) {
      assert.equal(pattern.test(combined), false, `${fixture.file} must not contain ${pattern}`);
    }
  }

  const index = fs.readFileSync(path.join(outputDir, 'index.html'), 'utf8');
  for (const fixture of PREVIEW_FIXTURES) {
    assert.match(index, new RegExp(`${fixture.file}\\.html`));
    assert.match(index, new RegExp(`${fixture.file}\\.txt`));
  }
  assert.equal(names.includes('index.html'), true);
});
