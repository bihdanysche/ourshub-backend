export interface AccessTokenPayload {
  sub: number;
  sid: number;
}

export interface RefreshTokenPayload {
  sub: number;
  sid: number;
  type: 'refresh';
}
