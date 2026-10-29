import test from 'node:test';
import assert from 'node:assert/strict';
import {
  everyFileExhausted,
  fileDownloadAllowance,
  fileDownloadSummary,
  transferFilesExhausted,
} from '../src/lib/downloadLimit.js';

test('a missing or zero download limit stays unlimited', () => {
  assert.deepEqual(fileDownloadAllowance({ maxDownloads: 0, downloadCount: 8 }), {
    limited: false,
    exhausted: false,
    remaining: null,
  });
  assert.deepEqual(fileDownloadAllowance({}), {
    limited: false,
    exhausted: false,
    remaining: null,
  });
  assert.equal(everyFileExhausted([
    { maxDownloads: 0, downloadCount: 4 },
    { maxDownloads: 0, downloadCount: 9 },
  ]), false);
});

test('a configured limit is counted per file, not across the transfer', () => {
  const used = { maxDownloads: 1, downloadCount: 1 };
  const open = { maxDownloads: 1, downloadCount: 0 };
  assert.deepEqual(fileDownloadAllowance(used), {
    limited: true,
    exhausted: true,
    remaining: 0,
  });
  assert.deepEqual(fileDownloadAllowance(open), {
    limited: true,
    exhausted: false,
    remaining: 1,
  });
  assert.equal(everyFileExhausted([used, open]), false);
  assert.equal(everyFileExhausted([used, { maxDownloads: 2, downloadCount: 2 }]), true);
  assert.equal(fileDownloadAllowance({ maxDownloads: 3, downloadCount: 1 }).remaining, 2);
});

test('owner summaries stay on each file when counts and limits differ', () => {
  const files = [
    { name: 'used.txt', maxDownloads: 2, downloadCount: 2 },
    { name: 'open.txt', maxDownloads: 5, downloadCount: 1 },
    { name: 'free.txt', maxDownloads: 0, downloadCount: 4 },
    { name: 'quiet.txt', maxDownloads: 0, downloadCount: 0 },
  ];
  const transfer = {
    maxDownloads: 2,
    downloadCount: 7,
    files,
  };
  assert.equal(fileDownloadSummary(files[0]), '2 of 2 links · limit reached');
  assert.equal(fileDownloadSummary(files[1]), '1 of 5 links');
  assert.equal(fileDownloadSummary(files[2]), '4 links issued');
  assert.equal(fileDownloadSummary(files[3]), null);
  assert.equal(fileDownloadSummary({}), null);
  assert.equal(transferFilesExhausted(transfer), false);
  assert.equal(transferFilesExhausted({
    maxDownloads: 1,
    downloadCount: 9,
    files: [
      { maxDownloads: 1, downloadCount: 1 },
      { maxDownloads: 3, downloadCount: 3 },
    ],
  }), true);
  assert.equal(transferFilesExhausted({
    maxDownloads: 1,
    downloadCount: 8,
    files: [
      { maxDownloads: 1, downloadCount: 1 },
      { maxDownloads: 0, downloadCount: 7 },
    ],
  }), false);
});
