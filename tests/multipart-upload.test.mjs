import assert from 'node:assert/strict';
import test from 'node:test';
import {
  mergeCompleteParts,
  multipartIsAbandoned,
  parseIncompleteUploads,
  parseListedParts,
} from '../functions/lib/multipartUpload.js';

test('listed part etags replace a missing browser etag', () => {
  const xml = `
    <ListPartsResult>
      <Part><PartNumber>2</PartNumber><ETag>&quot;bbb&quot;</ETag></Part>
      <Part><ETag>"aaa"</ETag><PartNumber>1</PartNumber></Part>
    </ListPartsResult>`;
  const listed = parseListedParts(xml);
  assert.deepEqual(listed, [
    { partNumber: 1, etag: '"aaa"' },
    { partNumber: 2, etag: '"bbb"' },
  ]);
  const merged = mergeCompleteParts(listed, [
    { PartNumber: 1, ETag: '' },
    { PartNumber: 2, ETag: '"client"' },
    { PartNumber: 3, ETag: 'ccc' },
  ]);
  assert.deepEqual(merged, [
    { partNumber: 1, etag: '"aaa"' },
    { partNumber: 2, etag: '"bbb"' },
    { partNumber: 3, etag: '"ccc"' },
  ]);
});

test('incomplete uploads older than a day are the ones cleanup can abort', () => {
  const xml = `
    <ListMultipartUploadsResult>
      <Upload>
        <Key>transfers/1-old/a.bin</Key>
        <UploadId>up-old</UploadId>
        <Initiated>2026-10-01T00:00:00.000Z</Initiated>
      </Upload>
      <Upload>
        <Key>other/skip.bin</Key>
        <UploadId>up-skip</UploadId>
        <Initiated>2026-10-01T00:00:00.000Z</Initiated>
      </Upload>
    </ListMultipartUploadsResult>`;
  assert.deepEqual(parseIncompleteUploads(xml), [
    { key: 'transfers/1-old/a.bin', uploadId: 'up-old', initiated: '2026-10-01T00:00:00.000Z' },
  ]);
  const now = Date.parse('2026-10-03T00:00:00.000Z');
  assert.equal(multipartIsAbandoned('2026-10-01T00:00:00.000Z', now), true);
  assert.equal(multipartIsAbandoned('2026-10-02T12:00:00.000Z', now), false);
});
