import { io } from 'socket.io-client';

import { CliError } from './errors.js';
import { BASE_URL, realtimeServer } from './http.js';

function timeoutError(label, timeoutMs) {
  return new CliError(`${label} timed out after ${Math.ceil(timeoutMs / 1000)} seconds.`);
}

function socketPath(server) {
  const base = server.pathname.replace(/\/$/, '');
  return `${base}/socket.io`.replace(/^\/\//, '/');
}

export async function connectRealtime(jar, noteId, timeoutMs = 15_000) {
  const { server } = await realtimeServer(jar, noteId);
  const cookie = jar.header(server);
  const socket = io(server.origin, {
    autoConnect: false,
    path: socketPath(server),
    query: { noteId },
    timeout: Math.min(timeoutMs, 5_000),
    reconnection: false,
    transports: ['websocket', 'polling'],
    // Node's Engine.IO cookie jar would append an empty lowercase cookie
    // header and shadow the authenticated header supplied below.
    withCredentials: false,
    extraHeaders: {
      ...(cookie ? { Cookie: cookie } : {}),
      Origin: BASE_URL,
      Referer: `${BASE_URL}/${encodeURIComponent(noteId)}`,
      'User-Agent': 'hackmd-rt/2.0'
    }
  });

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.close();
      reject(timeoutError('Realtime document handshake', timeoutMs));
    }, timeoutMs);
    const fail = (error) => {
      clearTimeout(timer);
      socket.close();
      reject(error instanceof CliError ? error : new CliError(`Realtime connection failed: ${error.message}`));
    };
    socket.once('connect_error', fail);
    socket.once('info', (info) => fail(new CliError(`HackMD realtime rejected the note (code ${info?.code || 'unknown'}).`, 3)));
    socket.once('doc', (doc) => {
      clearTimeout(timer);
      socket.off('connect_error', fail);
      if (!doc || typeof doc.str !== 'string' || !Number.isInteger(doc.revision)) {
        socket.close();
        reject(new CliError('HackMD realtime returned an invalid document snapshot.'));
        return;
      }
      resolve({ socket, content: doc.str, revision: doc.revision, clients: doc.clients || {} });
    });
    socket.connect();
  });
}

export async function readRealtime(jar, noteId, timeoutMs) {
  const connection = await connectRealtime(jar, noteId, timeoutMs);
  connection.socket.close();
  return { content: connection.content, revision: connection.revision, clients: connection.clients };
}

export async function writeRealtime(jar, noteId, operation, timeoutMs = 20_000) {
  const connection = await connectRealtime(jar, noteId, timeoutMs);
  const { socket, revision, content } = connection;
  const json = operation(content).toJSON();
  if (json.length === 0 || (json.length === 1 && json[0] === content.length)) {
    socket.close();
    return { changed: false, revision, concurrent: false };
  }

  return new Promise((resolve, reject) => {
    let concurrent = false;
    const timer = setTimeout(() => {
      const error = new CliError(
        `Realtime operation acknowledgement timed out after ${Math.ceil(timeoutMs / 1000)} seconds.`,
        5,
        { mayHaveApplied: true, noteId, baseRevision: revision }
      );
      cleanup();
      reject(error);
    }, timeoutMs);
    const cleanup = () => {
      clearTimeout(timer);
      socket.removeAllListeners('ack');
      socket.removeAllListeners('operation');
      socket.removeAllListeners('info');
      socket.removeAllListeners('disconnect');
      socket.close();
    };
    socket.on('operation', () => { concurrent = true; });
    socket.once('info', (info) => {
      cleanup();
      reject(new CliError(`HackMD rejected the operation (code ${info?.code || 'unknown'}).`, 3));
    });
    socket.once('disconnect', (reason) => {
      cleanup();
      reject(new CliError(
        `Realtime disconnected before acknowledgement (${reason}).`,
        5,
        { mayHaveApplied: true, noteId, baseRevision: revision }
      ));
    });
    socket.once('ack', (nextRevision) => {
      cleanup();
      if (!Number.isInteger(nextRevision) || nextRevision <= revision) {
        reject(new CliError('HackMD acknowledged the operation with an invalid revision.'));
        return;
      }
      resolve({ changed: true, revision: nextRevision, concurrent });
    });
    socket.emit('operation', revision, json, null);
  });
}
