export interface Token {
  accessToken: string;
  refreshToken: string;
  tokenExpiresAt: string;
}

export interface RefreshTokenInput {
  refreshToken: string;
}
