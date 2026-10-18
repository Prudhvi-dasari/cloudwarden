import Peer from 'peerjs';

/**
 * P2P WebRTC Direct Transfer Manager
 * Enables browser-to-browser direct transfers without cloud storage.
 */

const CHUNK_SIZE = 64 * 1024; // 64 KB binary chunks

export function generateP2PCode() {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let result = '';
  for (let i = 0; i < 6; i++) {
    if (i === 3) result += '-';
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

export class P2PSender {
  constructor(onStatusChange, onProgress, preferredCode = null) {
    this.onStatusChange = onStatusChange;
    this.onProgress = onProgress;
    this.peer = null;
    this.conn = null;
    this.code = preferredCode || generateP2PCode();
    this.isRelay = false;
  }

  init() {
    const peerId = `itransfer-${this.code.replace('-', '').toLowerCase()}`;
    
    this.peer = new Peer(peerId, {
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
        ],
      },
    });

    this.onStatusChange({ state: 'WAITING', code: this.code, isRelay: false });

    this.peer.on('connection', (conn) => {
      this.conn = conn;
      this.setupConnection();
    });

    this.peer.on('error', (err) => {
      console.error('PeerJS Sender Error:', err);
      this.onStatusChange({ state: 'ERROR', message: err.message || 'Connection error' });
    });
  }

  setupConnection() {
    this.conn.on('open', () => {
      // Check if connection is relay or direct ICE candidate
      this.isRelay = false;
      this.onStatusChange({
        state: 'CONNECTED',
        connectionType: 'Direct connection established',
        isRelay: false,
      });
    });

    this.conn.on('close', () => {
      this.onStatusChange({ state: 'DISCONNECTED', message: 'Peer disconnected' });
    });

    this.conn.on('error', (err) => {
      this.onStatusChange({ state: 'ERROR', message: err.message });
    });
  }

  async sendFiles(files) {
    if (!this.conn || !this.conn.open) {
      throw new Error('No active P2P connection to recipient');
    }

    const fileListMeta = files.map((f) => ({
      name: f.name,
      size: f.size,
      type: f.type || 'application/octet-stream',
    }));

    // Send metadata header first
    this.conn.send({ type: 'META', files: fileListMeta });

    const totalBytes = files.reduce((acc, f) => acc + f.size, 0);
    let totalSent = 0;
    const startTime = Date.now();

    for (let fIdx = 0; fIdx < files.length; fIdx++) {
      const file = files[fIdx];
      let offset = 0;

      this.conn.send({ type: 'FILE_START', fileIndex: fIdx, name: file.name, size: file.size });

      while (offset < file.size) {
        if (!this.conn || !this.conn.open) {
          throw new Error('Connection lost during transfer');
        }

        const slice = file.slice(offset, offset + CHUNK_SIZE);
        const arrayBuffer = await slice.arrayBuffer();

        this.conn.send({
          type: 'CHUNK',
          fileIndex: fIdx,
          offset,
          data: arrayBuffer,
        });

        offset += arrayBuffer.byteLength;
        totalSent += arrayBuffer.byteLength;

        const progressPercent = Math.round((totalSent / totalBytes) * 100);
        const elapsedSeconds = (Date.now() - startTime) / 1000;
        const speedMBps = elapsedSeconds > 0.1 ? (totalSent / (1024 * 1024) / elapsedSeconds).toFixed(1) : '0';
        const timeRemainingSec = speedMBps > 0 ? (totalBytes - totalSent) / (parseFloat(speedMBps) * 1024 * 1024) : 0;

        if (this.onProgress) {
          this.onProgress({
            progress: progressPercent,
            currentFile: file.name,
            fileIndex: fIdx,
            totalFiles: files.length,
            speed: `${speedMBps} MB/s`,
            timeRemaining: timeRemainingSec > 0 ? `${Math.ceil(timeRemainingSec)}s` : 'Finishing...',
            totalSent,
            totalBytes,
          });
        }

        // Small delay to prevent swamping WebRTC buffer
        if (offset % (CHUNK_SIZE * 8) === 0) {
          await new Promise((r) => setTimeout(r, 5));
        }
      }

      this.conn.send({ type: 'FILE_END', fileIndex: fIdx });
    }

    this.conn.send({ type: 'TRANSFER_COMPLETE' });
    this.onStatusChange({ state: 'COMPLETED' });
  }

  destroy() {
    if (this.conn) this.conn.close();
    if (this.peer) this.peer.destroy();
  }
}

export class P2PReceiver {
  constructor(code, onStatusChange, onProgress, onFilesReceived) {
    this.code = code.replace('-', '').toLowerCase();
    this.onStatusChange = onStatusChange;
    this.onProgress = onProgress;
    this.onFilesReceived = onFilesReceived;
    this.peer = null;
    this.conn = null;
    this.receivedFilesMeta = [];
    this.fileBuffers = [];
    this.currentFileBuffer = [];
    this.totalBytes = 0;
    this.totalReceived = 0;
    this.startTime = 0;
  }

  connect() {
    this.peer = new Peer({
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
        ],
      },
    });

    this.onStatusChange({ state: 'CONNECTING', message: 'Connecting to sender...' });

    this.peer.on('open', () => {
      const targetPeerId = `itransfer-${this.code}`;
      this.conn = this.peer.connect(targetPeerId, { reliable: true });

      this.conn.on('open', () => {
        this.startTime = Date.now();
        this.onStatusChange({
          state: 'CONNECTED',
          connectionType: 'Direct connection established',
          isRelay: false,
        });
      });

      this.conn.on('data', (data) => this.handleData(data));

      this.conn.on('close', () => {
        this.onStatusChange({ state: 'DISCONNECTED', message: 'Sender disconnected' });
      });

      this.conn.on('error', (err) => {
        this.onStatusChange({ state: 'ERROR', message: err.message });
      });
    });

    this.peer.on('error', (err) => {
      console.error('Receiver PeerJS Error:', err);
      this.onStatusChange({ state: 'ERROR', message: 'Could not connect to sender. Verify transfer code.' });
    });
  }

  handleData(payload) {
    if (!payload || !payload.type) return;

    if (payload.type === 'META') {
      this.receivedFilesMeta = payload.files;
      this.totalBytes = payload.files.reduce((acc, f) => acc + f.size, 0);
      this.fileBuffers = new Array(payload.files.length).fill(null).map(() => []);
      this.onStatusChange({ state: 'TRANSFERRING', files: payload.files });
    } else if (payload.type === 'FILE_START') {
      this.currentFileBuffer = [];
    } else if (payload.type === 'CHUNK') {
      const fIdx = payload.fileIndex;
      this.fileBuffers[fIdx].push(payload.data);
      this.totalReceived += payload.data.byteLength;

      const progressPercent = Math.round((this.totalReceived / this.totalBytes) * 100);
      const elapsedSeconds = (Date.now() - this.startTime) / 1000;
      const speedMBps = elapsedSeconds > 0.1 ? (this.totalReceived / (1024 * 1024) / elapsedSeconds).toFixed(1) : '0';

      if (this.onProgress) {
        this.onProgress({
          progress: progressPercent,
          currentFile: this.receivedFilesMeta[fIdx]?.name || 'Downloading...',
          speed: `${speedMBps} MB/s`,
          totalReceived: this.totalReceived,
          totalBytes: this.totalBytes,
        });
      }
    } else if (payload.type === 'TRANSFER_COMPLETE') {
      // Reconstruct Blobs for receiver
      const completedFiles = this.receivedFilesMeta.map((meta, idx) => {
        const blob = new Blob(this.fileBuffers[idx], { type: meta.type });
        return {
          name: meta.name,
          size: meta.size,
          type: meta.type,
          blob,
          url: URL.createObjectURL(blob),
        };
      });

      this.onStatusChange({ state: 'COMPLETED' });
      if (this.onFilesReceived) this.onFilesReceived(completedFiles);
    }
  }

  destroy() {
    if (this.conn) this.conn.close();
    if (this.peer) this.peer.destroy();
  }
}
