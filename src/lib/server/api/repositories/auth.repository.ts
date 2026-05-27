import { BaseRepository } from '../base.repository';
import type { RefreshTokenInput, TokenResponse } from '../types';

export class AuthRepository extends BaseRepository {
  refreshToken(input: RefreshTokenInput): Promise<TokenResponse> {
    return this.post(`/auth/refresh-token`, input);
  }
}
