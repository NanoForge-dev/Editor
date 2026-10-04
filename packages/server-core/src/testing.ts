/**
 * Test helpers: an RpcClient connected in memory to an editor server (no network, no Bun).
 * Used by server-core tests and by client packages' integration tests.
 */
import { RpcClient, type SocketLike } from '@nanoforge-dev/editor-rpc';

import type { EditorServer, ServerSocket, SocketData } from './server/editor-server.type';

export const TEST_ORIGIN = 'http://editor.test';

class LoopbackSocket implements SocketLike {
  readyState = 0;
  onopen: SocketLike['onopen'] = null;
  onclose: SocketLike['onclose'] = null;
  onerror: SocketLike['onerror'] = null;
  onmessage: SocketLike['onmessage'] = null;
  private _server: ServerSocket | undefined;

  constructor(
    private readonly _editor: EditorServer,
    url: string,
    cookie: () => string,
  ) {
    const request = new Request(url.replace(/^ws/, 'http'), {
      headers: { origin: TEST_ORIGIN, cookie: cookie() },
    });
    void _editor
      .fetch(request, (_request, { data }) => {
        this._server = this._serverSide(data);
        return true;
      })
      .then(() => {
        if (!this._server) {
          this.readyState = 3;
          this.onclose?.({});
          return;
        }
        _editor.websocket.open(this._server);
        this.readyState = 1;
        this.onopen?.({});
      });
  }

  send(data: string): void {
    if (this._server) this._editor.websocket.message(this._server, data);
  }

  close(): void {
    if (this.readyState === 3) return;
    this.readyState = 3;
    if (this._server) this._editor.websocket.close(this._server);
    this.onclose?.({});
  }

  private _serverSide(data: SocketData): ServerSocket {
    return {
      data,
      send: (message) => {
        queueMicrotask(() => this.onmessage?.({ data: message }));
        return message.length;
      },
      close: () => this.close(),
    };
  }
}

/** An RpcClient whose HTTP calls and WebSocket go straight to `editor` (cookies included). */
export const createLoopbackClient = (editor: EditorServer): RpcClient => {
  let cookie = '';
  return new RpcClient({
    baseUrl: TEST_ORIGIN,
    reconnectDelays: [10],
    fetch: async (url, init) => {
      const request = new Request(String(url), {
        ...init,
        headers: { ...(init?.headers as Record<string, string>), origin: TEST_ORIGIN, cookie },
      });
      const response = (await editor.fetch(request))!;
      const setCookie = response.headers.get('set-cookie');
      if (setCookie) cookie = setCookie.split(';')[0]!;
      return response;
    },
    createSocket: (url) => new LoopbackSocket(editor, url, () => cookie),
  });
};
