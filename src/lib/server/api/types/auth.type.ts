export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  tokenExpiresAt: string;
}

export interface RefreshTokenInput {
  refreshToken: string;
}
