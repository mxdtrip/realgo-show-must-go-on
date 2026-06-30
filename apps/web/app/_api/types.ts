// Shared API types mirroring the Go backend's response envelope.
//
// Success: { "data": <T> }
// Failure: { "error": { "code": string, "message": string } }

/** Successful response envelope. */
export type ApiEnvelope<T> = { data: T };

/** Error body returned under "error" on failures. */
export type ApiErrorBody = { code: string; message: string };

/** Thrown for any non-2xx response or transport failure. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** Token pair issued by the auth endpoints (wire format = snake_case). */
export type AuthTokens = {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
};

/** Authenticated user as returned by the backend (snake_case wire format). */
export type AuthUser = {
  id: number;
  email: string;
  timezone: string;
  plan: string;
  interview_date: string | null;
  created_at: string;
};
