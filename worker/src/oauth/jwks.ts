/**
 * JWKS (JSON Web Key Set) Endpoint
 * /.well-known/jwks.json
 */

import { JWKS, OAuthEnv } from './types';
import { exportPublicKeyAsJWK } from '../utils/crypto';

/**
 * Handle GET /.well-known/jwks.json
 * Returns the public keys for JWT verification
 */
export async function handleJWKS(
  request: Request,
  env: OAuthEnv
): Promise<Response> {
  try {
    const jwk = await exportPublicKeyAsJWK(env);

    if (!jwk) {
      // Return empty JWKS if no key is configured
      // This allows the endpoint to work during development
      const emptyJwks: JWKS = { keys: [] };
      
      return new Response(JSON.stringify(emptyJwks, null, 2), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=3600',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    const jwks: JWKS = {
      keys: [jwk],
    };

    return new Response(JSON.stringify(jwks, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        // Cache for 1 hour, but allow revalidation for key rotation
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    console.error('JWKS endpoint error:', error);
    
    return new Response(
      JSON.stringify({ error: 'Failed to generate JWKS' }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }
}
