/**
 * OIDC Discovery Endpoint
 * /.well-known/openid-configuration
 */

import { OpenIDConfiguration, OAuthEnv, SUPPORTED_SCOPES } from './types';

/**
 * Build the OpenID Connect Discovery document
 */
export function buildOpenIDConfiguration(env: OAuthEnv): OpenIDConfiguration {
  const issuer = env.FUNID_ISSUER || 'https://funprofile-api.funecosystem.org';
  const frontendUrl = env.FUNID_FRONTEND_URL || 'https://soul-spark-web3.lovable.app';

  return {
    // Issuer identifier
    issuer: issuer,

    // Endpoints
    authorization_endpoint: `${frontendUrl}/oauth/consent`,
    token_endpoint: `${issuer}/oauth/token`,
    userinfo_endpoint: `${issuer}/oauth/userinfo`,
    jwks_uri: `${issuer}/.well-known/jwks.json`,

    // Supported features
    scopes_supported: [...SUPPORTED_SCOPES],
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    subject_types_supported: ['public'],
    id_token_signing_alg_values_supported: ['RS256'],
    token_endpoint_auth_methods_supported: ['client_secret_post', 'client_secret_basic'],
    
    // Supported claims
    claims_supported: [
      'sub',
      'iss',
      'aud',
      'exp',
      'iat',
      'nonce',
      'name',
      'picture',
      'email',
      'wallet_address',
      'camly_balance',
    ],

    // PKCE support (required for public clients)
    code_challenge_methods_supported: ['S256'],
  };
}

/**
 * Handle GET /.well-known/openid-configuration
 */
export function handleOpenIDConfiguration(
  request: Request,
  env: OAuthEnv
): Response {
  const config = buildOpenIDConfiguration(env);

  return new Response(JSON.stringify(config, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      'Access-Control-Allow-Origin': '*', // Public endpoint
    },
  });
}
