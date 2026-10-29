export function sanitizeStoragePath(filePath) {
  if (!filePath) return 'file';
  const parts = filePath.split('/');
  const sanitizedParts = parts.map((part) => {
    return part
      .normalize('NFKD')
      .replace(/[\u2000-\u206F\u2E00-\u2E7F\u00A0\uFEFF]/g, ' ')
      .replace(/[^\w\s.-]/gi, '_')
      .trim();
  });
  return sanitizedParts.join('/');
}
