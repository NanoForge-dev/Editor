export const RPC_ERROR_STATUS = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  PRECONDITION_FAILED: 412,
  PAYLOAD_TOO_LARGE: 413,
  CANCELLED: 499,
  INTERNAL: 500,
  UNAVAILABLE: 503,
  TIMEOUT: 504,
} as const;

export type RpcErrorCode = keyof typeof RPC_ERROR_STATUS;

export interface RpcErrorPayload {
  code: RpcErrorCode;
  message: string;
  data?: unknown;
}

/** Error crossing the RPC boundary. Any other error is reported to clients as INTERNAL. */
export class RpcError extends Error {
  static from(payload: RpcErrorPayload): RpcError {
    const code = payload.code in RPC_ERROR_STATUS ? payload.code : 'INTERNAL';
    return new RpcError(code, payload.message, payload.data);
  }

  static is(error: unknown, code?: RpcErrorCode): error is RpcError {
    return error instanceof RpcError && (code === undefined || error.code === code);
  }
  constructor(
    readonly code: RpcErrorCode,
    message: string,
    readonly data?: unknown,
  ) {
    super(message);
    this.name = 'RpcError';
  }

  get status(): number {
    return RPC_ERROR_STATUS[this.code];
  }

  toJSON(): RpcErrorPayload {
    return this.data === undefined
      ? { code: this.code, message: this.message }
      : { code: this.code, message: this.message, data: this.data };
  }
}
