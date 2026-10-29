import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PREVIEWS_DIR = __dirname;

const ALIASES = {
  '/': 'index.html',
  '/index': 'index.html',
  '/index.html': 'index.html',
  '/1': '1-recipient-transfer-standard.html',
  '/2': '2-recipient-transfer-urgent-password.html',
  '/3': '3-sender-confirmation.html',
  '/3b': '3b-sender-confirmation-password.html',
  '/4': '4-file-request.html',
  '/5': '5-expiry-reminder.html',
};

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

function createServer(port) {
  const server = http.createServer((req, res) => {
    try {
      const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
      let reqPath = url.pathname;

      if (ALIASES[reqPath]) {
        reqPath = '/' + ALIASES[reqPath];
      }

      // Sanitize path to prevent directory traversal
      const safePath = path.normalize(reqPath).replace(/^(\.\.[/\\])+/, '');
      const filePath = path.join(PREVIEWS_DIR, safePath);

      if (!filePath.startsWith(PREVIEWS_DIR)) {
        res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
        return res.end('403 Forbidden');
      }

      if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        return res.end(`404 Not Found: ${reqPath}`);
      }

      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'text/html; charset=utf-8';
      const fileContent = fs.readFileSync(filePath);

      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      });
      res.end(fileContent);
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('500 Server Error: ' + err.message);
    }
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`Port ${port} in use, trying ${port + 1}...`);
      createServer(port + 1);
    } else {
      console.error('Server error:', err);
    }
  });

  server.listen(port, '127.0.0.1', () => {
    console.log(`\n======================================================`);
    console.log(`SendToAnyone Email Preview Server running on port ${port}`);
    console.log(`------------------------------------------------------`);
    console.log(`Interactive Gallery:   http://localhost:${port}/`);
    console.log(`1. Recipient (Std):    http://localhost:${port}/1`);
    console.log(`2. Recipient (Urgent): http://localhost:${port}/2`);
    console.log(`3. Sender Conf:        http://localhost:${port}/3`);
    console.log(`3b. Sender + password: http://localhost:${port}/3b`);
    console.log(`4. File Request:       http://localhost:${port}/4`);
    console.log(`5. Expiry Reminder:    http://localhost:${port}/5`);
    console.log(`======================================================\n`);
  });
}

createServer(3030);
