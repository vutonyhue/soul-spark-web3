/**
 * OAuth 2.0 Authorization Endpoint
 * /oauth/authorize - Initiates the authorization code flow
 * /oauth/authorize/callback - Receives consent from frontend
 */

import { 
  AuthorizeRequest, 
  OAuthClient, 
  AuthorizationCode,
  OAuthEnv,
  TOKEN_EXPIRY,
  SUPPORTED_SCOPES,
  SupportedScope
} from './types';
import { isValidCodeChallenge } from '../utils/pkce';
import { generateAuthorizationCode } from '../utils/crypto';

// ========== Validation Helpers ==========

function validateAuthorizeRequest(url: URL): { valid: true; params: AuthorizeRequest } | { valid: false; error: string; errorUri?: string } {
  const responseType = url.searchParams.get('response_type');
  const clientId = url.searchParams.get('client_id');
  const redirectUri = url.searchParams.get('redirect_uri');
  const scope = url.searchParams.get('scope') || 'openid';
  const state = url.searchParams.get('state');
  const codeChallenge = url.searchParams.get('code_challenge');
  const codeChallengeMethod = url.searchParams.get('code_challenge_method');
  const nonce = url.searchParams.get('nonce');

  // Required parameters
  if (!responseType) {
    return { valid: false, error: 'invalid_request', errorUri: 'Missing response_type parameter' };
  }

  if (responseType !== 'code') {
    return { valid: false, error: 'unsupported_response_type', errorUri: 'Only response_type=code is supported' };
  }

  if (!clientId) {
    return { valid: false, error: 'invalid_request', errorUri: 'Missing client_id parameter' };
  }

  if (!redirectUri) {
    return { valid: false, error: 'invalid_request', errorUri: 'Missing redirect_uri parameter' };
  }

  if (!state) {
    return { valid: false, error: 'invalid_request', errorUri: 'Missing state parameter (required for CSRF protection)' };
  }

  // PKCE is required
  if (!codeChallenge) {
    return { valid: false, error: 'invalid_request', errorUri: 'Missing code_challenge parameter (PKCE is required)' };
  }

  if (codeChallengeMethod && codeChallengeMethod !== 'S256') {
    return { valid: false, error: 'invalid_request', errorUri: 'Only S256 code_challenge_method is supported' };
  }

  if (!isValidCodeChallenge(codeChallenge)) {
    return { valid: false, error: 'invalid_request', errorUri: 'Invalid code_challenge format' };
  }

  return {
    valid: true,
    params: {
      response_type: responseType,
      client_id: clientId,
      redirect_uri: redirectUri,
      scope,
      state,
      code_challenge: codeChallenge,
      code_challenge_method: codeChallengeMethod || 'S256',
      nonce: nonce || undefined,
    },
  };
}

function validateScopes(requestedScopes: string): string[] {
  const scopes = requestedScopes.split(' ').filter(Boolean);
  return scopes.filter((s): s is SupportedScope => 
    SUPPORTED_SCOPES.includes(s as SupportedScope)
  );
}

// ========== Database Helpers ==========

async function getClient(clientId: string, env: OAuthEnv): Promise<OAuthClient | null> {
  const url = `${env.SUPABASE_URL}/rest/v1/oauth_clients?client_id=eq.${encodeURIComponent(clientId)}&is_active=eq.true&select=*`;

  const response = await fetch(url, {
    headers: {
      'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    console.error('Failed to fetch client:', response.status);
    return null;
  }

  const clients = await response.json() as OAuthClient[];
  return clients[0] || null;
}

async function storeAuthorizationCode(
  code: AuthorizationCode,
  env: OAuthEnv
): Promise<boolean> {
  const url = `${env.SUPABASE_URL}/rest/v1/oauth_authorization_codes`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      code: code.code,
      client_id: code.client_id,
      user_id: code.user_id,
      redirect_uri: code.redirect_uri,
      scope: code.scope,
      code_challenge: code.code_challenge,
      code_challenge_method: code.code_challenge_method,
      state: code.state,
      nonce: code.nonce,
      expires_at: code.expires_at,
      used: false,
    }),
  });

  if (!response.ok) {
    console.error('Failed to store authorization code:', response.status);
    return false;
  }

  return true;
}

// ========== Error Response Helpers ==========

function authorizationError(
  redirectUri: string,
  error: string,
  errorDescription: string,
  state?: string
): Response {
  const url = new URL(redirectUri);
  url.searchParams.set('error', error);
  url.searchParams.set('error_description', errorDescription);
  if (state) {
    url.searchParams.set('state', state);
  }

  return Response.redirect(url.toString(), 302);
}

function jsonError(error: string, description: string, status: number): Response {
  return new Response(
    JSON.stringify({ error, error_description: description }),
    {
      status,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}

// ========== Handlers ==========

/**
 * Handle GET /oauth/authorize
 * Validates the request and redirects to the frontend consent page
 */
export async function handleAuthorize(
  request: Request,
  env: OAuthEnv
): Promise<Response> {
  const url = new URL(request.url);

  // Validate request parameters
  const validation = validateAuthorizeRequest(url);
  if (!validation.valid) {
    // Can't redirect if we don't have a valid redirect_uri
    return jsonError(validation.error, validation.errorUri || 'Invalid request', 400);
  }

  const params = validation.params;

  // Lookup client
  const client = await getClient(params.client_id, env);
  if (!client) {
    return jsonError('invalid_client', 'Client not found or inactive', 400);
  }

  // Validate redirect_uri (must exactly match registered URIs)
  if (!client.redirect_uris.includes(params.redirect_uri)) {
    return jsonError('invalid_request', 'redirect_uri not registered for this client', 400);
  }

  // Validate scopes
  const validScopes = validateScopes(params.scope);
  if (validScopes.length === 0) {
    return authorizationError(
      params.redirect_uri,
      'invalid_scope',
      'No valid scopes requested',
      params.state
    );
  }

  // Build frontend consent URL
  const frontendUrl = env.FUNID_FRONTEND_URL || 'https://soul-spark-web3.lovable.app';
  const consentUrl = new URL('/oauth/consent', frontendUrl);
  
  // Pass all necessary parameters to frontend
  consentUrl.searchParams.set('client_id', params.client_id);
  consentUrl.searchParams.set('client_name', client.client_name);
  if (client.logo_uri) {
    consentUrl.searchParams.set('logo_uri', client.logo_uri);
  }
  consentUrl.searchParams.set('scope', validScopes.join(' '));
  consentUrl.searchParams.set('state', params.state);
  consentUrl.searchParams.set('redirect_uri', params.redirect_uri);
  consentUrl.searchParams.set('code_challenge', params.code_challenge!);
  consentUrl.searchParams.set('code_challenge_method', params.code_challenge_method || 'S256');
  if (params.nonce) {
    consentUrl.searchParams.set('nonce', params.nonce);
  }

  // Redirect to frontend consent page
  return Response.redirect(consentUrl.toString(), 302);
}

/**
 * Handle POST /oauth/authorize/callback
 * Called by frontend after user approves consent
 * Generates authorization code and redirects to client
 */
export async function handleAuthorizeCallback(
  userId: string,
  request: Request,
  env: OAuthEnv
): Promise<Response> {
  let body: {
    client_id: string;
    redirect_uri: string;
    scope: string;
    state: string;
    code_challenge: string;
    code_challenge_method: string;
    nonce?: string;
    approved: boolean;
  };

  try {
    body = await request.json();
  } catch {
    return jsonError('invalid_request', 'Invalid JSON body', 400);
  }

  // User denied consent
  if (!body.approved) {
    return new Response(
      JSON.stringify({
        redirect_uri: `${body.redirect_uri}?error=access_denied&error_description=User%20denied%20consent&state=${encodeURIComponent(body.state)}`,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  // Validate client again
  const client = await getClient(body.client_id, env);
  if (!client) {
    return jsonError('invalid_client', 'Client not found', 400);
  }

  if (!client.redirect_uris.includes(body.redirect_uri)) {
    return jsonError('invalid_request', 'Invalid redirect_uri', 400);
  }

  // Generate authorization code
  const code = generateAuthorizationCode();
  const expiresAt = new Date(Date.now() + TOKEN_EXPIRY.AUTHORIZATION_CODE * 1000).toISOString();

  const authCode: AuthorizationCode = {
    id: crypto.randomUUID(),
    code,
    client_id: body.client_id,
    user_id: userId,
    redirect_uri: body.redirect_uri,
    scope: body.scope,
    code_challenge: body.code_challenge,
    code_challenge_method: body.code_challenge_method,
    state: body.state,
    nonce: body.nonce || null,
    expires_at: expiresAt,
    used: false,
    created_at: new Date().toISOString(),
  };

  // Store code in database
  const stored = await storeAuthorizationCode(authCode, env);
  if (!stored) {
    return jsonError('server_error', 'Failed to generate authorization code', 500);
  }

  // Return redirect URL for frontend to navigate
  const redirectUrl = new URL(body.redirect_uri);
  redirectUrl.searchParams.set('code', code);
  redirectUrl.searchParams.set('state', body.state);

  return new Response(
    JSON.stringify({ redirect_uri: redirectUrl.toString() }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}
