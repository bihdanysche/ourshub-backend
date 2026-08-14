export interface TelegramIdTokenClaims {
  iss: string;
  aud: string | string[];
  sub: string;

  iat: number;
  exp: number;

  id: number;
  name: string;

  given_name?: string;
  family_name?: string;

  preferred_username?: string;
  picture?: string;

  phone_number?: string;
  phone_number_verified?: boolean;
}

export interface TelegramTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  id_token: string;
}
