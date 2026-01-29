/**
 * OAuth 2.0 / OIDC Types for FUN-ID SSO
 */

// ========== Environment Types ==========
export interface OAuthEnv {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  FUNID_RSA_PRIVATE_KEY?: string;
  FUNID_RSA_PUBLIC_KEY?: string;
  FUNID_RSA_KID?: string;
  FUNID_ISSUER?: string;
  FUNID_FRONTEND_URL?: string;
}

// ========== OAuth Client Types ==========
export interface OAuthClient {
  id: string;
  client_id: string;
  client_name: string;
  client_secret_hash: string;
  redirect_uris: string[];
  scopes: string[];
  grant_types: string[];
  is_active: boolean;
  is_confidential: boolean;
  logo_uri: string | null;
  client_uri: string | null;
}

// ========== Authorization Request ==========
export interface AuthorizeRequest {
  response_type: string;
  client_id: string;
  redirect_uri: string;
  scope: string;
  state: string;
  code_challenge?: string;
  code_challenge_method?: string;
  nonce?: string;
}

// ========== Authorization Code ==========
export interface AuthorizationCode {
  id: string;
  code: string;
  client_id: string;
  user_id: string;
  redirect_uri: string;
  scope: string;
  code_challenge: string | null;
  code_challenge_method: string | null;
  state: string | null;
  nonce: string | null;
  expires_at: string;
  used: boolean;
  created_at: string;
}

// ========== Token Request ==========
export interface TokenRequest {
  grant_type: 'authorization_code' | 'refresh_token';
  code?: string;
  redirect_uri?: string;
  client_id: string;
  client_secret?: string;
  code_verifier?: string;
  refresh_token?: string;
}

// ========== Token Response ==========
export interface TokenResponse {
  access_token: string;
  token_type: 'Bearer';
  expires_in: number;
  refresh_token?: string;
  id_token?: string;
  scope: string;
}

// ========== Token Error Response ==========
export interface TokenErrorResponse {
  error: string;
  error_description?: string;
}

// ========== ID Token Claims ==========
export interface IDTokenClaims {
  iss: string;
  sub: string;
  aud: string;
  exp: number;
  iat: number;
  nonce?: string;
  // Profile claims
  name?: string;
  picture?: string;
  // Email claims
  email?: string;
  email_verified?: boolean;
  // Custom FUN-ID claims
  wallet_address?: string;
  camly_balance?: number;
}

// ========== Access Token Claims ==========
export interface AccessTokenClaims {
  iss: string;
  sub: string;
  aud: string;
  exp: number;
  iat: number;
  client_id: string;
  scope: string;
}

// ========== UserInfo Response ==========
export interface UserInfoResponse {
  sub: string;
  name?: string;
  picture?: string;
  email?: string;
  wallet_address?: string;
  camly_balance?: number;
}

// ========== Refresh Token Record ==========
export interface RefreshTokenRecord {
  id: string;
  token_hash: string;
  user_id: string;
  client_id: string;
  scope: string;
  expires_at: string;
  revoked: boolean;
  revoked_at: string | null;
  created_at: string;
}

// ========== User Profile ==========
export interface UserProfile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  wallet_address: string | null;
  camly_balance: number | null;
}

// ========== OAuth Consent ==========
export interface OAuthConsent {
  id: string;
  user_id: string;
  client_id: string;
  scopes: string[];
  created_at: string;
  updated_at: string;
}

// ========== OIDC Discovery Document ==========
export interface OpenIDConfiguration {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  userinfo_endpoint: string;
  jwks_uri: string;
  scopes_supported: string[];
  response_types_supported: string[];
  grant_types_supported: string[];
  subject_types_supported: string[];
  id_token_signing_alg_values_supported: string[];
  token_endpoint_auth_methods_supported: string[];
  claims_supported: string[];
  code_challenge_methods_supported: string[];
}

// ========== JWKS Types ==========
export interface JWK {
  kty: string;
  kid: string;
  use: string;
  alg: string;
  n: string;
  e: string;
}

export interface JWKS {
  keys: JWK[];
}

// ========== Supported Scopes ==========
export const SUPPORTED_SCOPES = ['openid', 'profile', 'email', 'wallet'] as const;
export type SupportedScope = typeof SUPPORTED_SCOPES[number];

// ========== Token Expiration Constants ==========
export const TOKEN_EXPIRY = {
  ACCESS_TOKEN: 3600, // 1 hour in seconds
  ID_TOKEN: 3600, // 1 hour in seconds
  REFRESH_TOKEN: 30 * 24 * 3600, // 30 days in seconds
  AUTHORIZATION_CODE: 600, // 10 minutes in seconds
} as const;
