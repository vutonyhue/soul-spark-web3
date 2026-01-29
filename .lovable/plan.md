
# Phase 2: Triển khai OAuth 2.0 Endpoints trên Cloudflare Worker

## Tổng quan

Mở rộng Cloudflare Worker hiện tại để thêm các OAuth 2.0/OIDC endpoints chuẩn, biến FUN Profile thành một Identity Provider (IdP) hoàn chỉnh.

## Các Endpoints cần triển khai

| Endpoint | Method | Auth | Mô tả |
|----------|--------|------|-------|
| `/.well-known/openid-configuration` | GET | Public | OIDC Discovery document |
| `/.well-known/jwks.json` | GET | Public | Public keys cho JWT verification |
| `/oauth/authorize` | GET | Session | Authorization endpoint - redirect flow |
| `/oauth/token` | POST | Client credentials | Token exchange endpoint |
| `/oauth/userinfo` | GET | Bearer token | User info endpoint |

## Cấu trúc Files mới

```text
worker/src/
├── index.ts                    # Mở rộng router (existing)
├── oauth/
│   ├── discovery.ts            # OpenID Configuration
│   ├── jwks.ts                 # JWKS endpoint
│   ├── authorize.ts            # Authorization endpoint
│   ├── token.ts                # Token exchange
│   ├── userinfo.ts             # UserInfo endpoint
│   └── types.ts                # OAuth types
└── utils/
    ├── pkce.ts                 # PKCE utilities
    └── crypto.ts               # JWT signing với RS256
```

## Chi tiết Implementation

### 1. Discovery Endpoint (`/.well-known/openid-configuration`)

Trả về document chuẩn OIDC Discovery:

```typescript
{
  "issuer": "https://funprofile-api.funecosystem.org",
  "authorization_endpoint": "https://soul-spark-web3.lovable.app/oauth/consent",
  "token_endpoint": "https://funprofile-api.funecosystem.org/oauth/token",
  "userinfo_endpoint": "https://funprofile-api.funecosystem.org/oauth/userinfo",
  "jwks_uri": "https://funprofile-api.funecosystem.org/.well-known/jwks.json",
  "scopes_supported": ["openid", "profile", "email", "wallet"],
  "response_types_supported": ["code"],
  "grant_types_supported": ["authorization_code", "refresh_token"],
  "code_challenge_methods_supported": ["S256"],
  "id_token_signing_alg_values_supported": ["RS256"],
  "claims_supported": ["sub", "name", "email", "picture", "wallet_address", "camly_balance"]
}
```

### 2. JWKS Endpoint (`/.well-known/jwks.json`)

- Đọc RSA public key từ Cloudflare Secret
- Export dạng JWK format với `kid` (key ID)
- Hỗ trợ key rotation (multiple keys)

```typescript
{
  "keys": [{
    "kty": "RSA",
    "kid": "funid-key-2026",
    "use": "sig",
    "alg": "RS256",
    "n": "...",   // modulus base64url
    "e": "AQAB"  // exponent base64url
  }]
}
```

### 3. Authorization Endpoint (`/oauth/authorize`)

**Flow:**
1. Validate `client_id`, `redirect_uri`, `response_type=code`
2. Validate PKCE parameters (`code_challenge`, `code_challenge_method=S256`)
3. Redirect user to frontend consent page với encrypted params:
   ```
   https://soul-spark-web3.lovable.app/oauth/consent?
     client_id=xxx&
     scope=openid%20profile&
     state=xxx&
     redirect_uri=https://fungames.com/callback&
     code_challenge=xxx
   ```

**Validation:**
- `client_id` phải tồn tại và active trong `oauth_clients`
- `redirect_uri` phải exact match với registered URIs
- `state` parameter bắt buộc để chống CSRF
- PKCE bắt buộc cho tất cả clients

### 4. Token Endpoint (`/oauth/token`)

**Grant types hỗ trợ:**

**a) Authorization Code Grant:**
```typescript
POST /oauth/token
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code
code=xxx
redirect_uri=https://fungames.com/callback
client_id=xxx
client_secret=xxx (nếu confidential client)
code_verifier=xxx (PKCE)
```

**Response:**
```json
{
  "access_token": "eyJhbGc...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "xxx",
  "id_token": "eyJhbGc...",
  "scope": "openid profile"
}
```

**b) Refresh Token Grant:**
```typescript
grant_type=refresh_token
refresh_token=xxx
client_id=xxx
```

**Token Generation:**
- Access Token: JWT signed với RS256, expires 1 hour
- ID Token: JWT theo OIDC spec, chứa user claims
- Refresh Token: Opaque token, hashed lưu DB, expires 30 days

### 5. UserInfo Endpoint (`/oauth/userinfo`)

```typescript
GET /oauth/userinfo
Authorization: Bearer <access_token>

Response:
{
  "sub": "user-uuid",
  "name": "Display Name",
  "picture": "https://xxx/avatar.jpg",
  "email": "user@example.com",
  "wallet_address": "0x...",
  "camly_balance": 1000
}
```

## Security Implementation

### PKCE Verification

```typescript
// Verify code_verifier matches stored code_challenge
async function verifyPKCE(verifier: string, challenge: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hash = await crypto.subtle.digest('SHA-256', data);
  const computed = base64UrlEncode(new Uint8Array(hash));
  return computed === challenge;
}
```

### JWT Signing với jose

```typescript
import { SignJWT, importPKCS8, exportJWK } from 'jose';

async function signToken(payload: object, privateKey: string): Promise<string> {
  const key = await importPKCS8(privateKey, 'RS256');
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'RS256', kid: 'funid-key-2026' })
    .setIssuedAt()
    .setIssuer('https://funprofile-api.funecosystem.org')
    .setExpirationTime('1h')
    .sign(key);
}
```

### Authorization Code Flow

```text
┌─────────────────────────────────────────────────────────────────────┐
│ 1. Client redirects to /oauth/authorize                            │
│    ?client_id=xxx&redirect_uri=xxx&scope=openid%20profile          │
│    &state=random&code_challenge=xxx&code_challenge_method=S256     │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 2. Worker validates client_id, redirect_uri                         │
│    → Redirect to Frontend: /oauth/consent?...encrypted_params       │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 3. Frontend shows consent screen (or auto-approve if consented)     │
│    User clicks "Allow" → POST /oauth/authorize/callback             │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 4. Worker generates authorization code                              │
│    → Store in oauth_authorization_codes (expires 10 min)            │
│    → Redirect to client redirect_uri?code=xxx&state=xxx             │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 5. Client exchanges code at /oauth/token                            │
│    → Verify PKCE, client credentials                                │
│    → Return access_token, id_token, refresh_token                   │
└─────────────────────────────────────────────────────────────────────┘
```

## Secrets cần thêm vào Cloudflare

| Secret | Mô tả |
|--------|-------|
| `FUNID_RSA_PRIVATE_KEY` | RSA Private Key (PEM format) để sign JWTs |
| `FUNID_RSA_PUBLIC_KEY` | RSA Public Key (PEM format) cho JWKS |
| `FUNID_RSA_KID` | Key ID identifier (e.g., "funid-key-2026") |

**Generate RSA Key Pair (cho user thực hiện):**
```bash
# Generate 2048-bit RSA key pair
openssl genrsa -out private.pem 2048
openssl rsa -in private.pem -pubout -out public.pem

# Set secrets
wrangler secret put FUNID_RSA_PRIVATE_KEY < private.pem
wrangler secret put FUNID_RSA_PUBLIC_KEY < public.pem
wrangler secret put FUNID_RSA_KID
# Enter: funid-key-2026
```

## Frontend Changes (Phase 3 Preview)

Tạo route `/oauth/consent` trong React app để:
- Parse OAuth params từ URL
- Kiểm tra user đã login chưa (redirect to /auth nếu chưa)
- Hiển thị consent screen với client info và requested scopes
- POST consent decision về Worker

## Updated wrangler.toml

```toml
[vars]
SUPABASE_URL = "https://qoafaznrqkbhrhacffur.supabase.co"
SUPABASE_ANON_KEY = "..."
R2_PUBLIC_URL = "https://funprofile-media.funecosystem.org"
ALLOWED_ORIGINS = "...,https://fungames.com"  # Add OAuth clients
FUNID_ISSUER = "https://funprofile-api.funecosystem.org"
FUNID_FRONTEND_URL = "https://soul-spark-web3.lovable.app"

# Secrets (via wrangler secret put):
# SUPABASE_SERVICE_ROLE_KEY
# FUNID_RSA_PRIVATE_KEY
# FUNID_RSA_PUBLIC_KEY
# FUNID_RSA_KID
```

## Updated index.ts Router

Thêm routes mới vào main router:

```typescript
// ===== OAUTH/OIDC PUBLIC ROUTES =====
if (path === '/.well-known/openid-configuration' && method === 'GET') {
  return handleOpenIDConfiguration(request, env);
}

if (path === '/.well-known/jwks.json' && method === 'GET') {
  return handleJWKS(request, env);
}

if (path === '/oauth/authorize' && method === 'GET') {
  return handleAuthorize(request, env);
}

if (path === '/oauth/token' && method === 'POST') {
  return handleToken(request, env);
}

if (path === '/oauth/userinfo' && method === 'GET') {
  return handleUserInfo(request, env);
}

// Callback from frontend consent page
if (path === '/oauth/authorize/callback' && method === 'POST') {
  return withAuth(request, env, handleAuthorizeCallback);
}
```

## Task Breakdown

| Task | File | Ước tính |
|------|------|----------|
| 1. Tạo OAuth types | `worker/src/oauth/types.ts` | 30 min |
| 2. PKCE utilities | `worker/src/utils/pkce.ts` | 30 min |
| 3. Crypto utilities (JWT signing) | `worker/src/utils/crypto.ts` | 45 min |
| 4. Discovery endpoint | `worker/src/oauth/discovery.ts` | 30 min |
| 5. JWKS endpoint | `worker/src/oauth/jwks.ts` | 45 min |
| 6. Authorize endpoint | `worker/src/oauth/authorize.ts` | 1.5 hours |
| 7. Token endpoint | `worker/src/oauth/token.ts` | 2 hours |
| 8. UserInfo endpoint | `worker/src/oauth/userinfo.ts` | 45 min |
| 9. Update main router | `worker/src/index.ts` | 30 min |
| 10. Update wrangler.toml | `worker/wrangler.toml` | 15 min |

**Tổng thời gian ước tính:** 7-8 hours

## Kế hoạch thực hiện

1. **Step 1:** Tạo các utility files (types, pkce, crypto)
2. **Step 2:** Implement discovery và JWKS endpoints (public, không cần auth)
3. **Step 3:** Implement authorize endpoint (redirect flow)
4. **Step 4:** Implement token endpoint (code exchange, refresh)
5. **Step 5:** Implement userinfo endpoint
6. **Step 6:** Update main router và wrangler.toml
7. **Step 7:** Test với mock client

## Lưu ý quan trọng

1. **RSA Keys:** User cần generate và set secrets trước khi JWKS/Token endpoints hoạt động
2. **Frontend Consent:** Phase 3 sẽ build consent UI - hiện tại authorize sẽ redirect với params
3. **CORS:** Thêm OAuth client origins vào `ALLOWED_ORIGINS`
4. **Security:** Tất cả tokens đều signed với RS256, PKCE bắt buộc
