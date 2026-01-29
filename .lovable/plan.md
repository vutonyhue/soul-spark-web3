
# Kế hoạch triển khai FUN-ID SSO với OAuth 2.0/OIDC

## Tổng quan

FUN-ID sẽ là hệ thống Single Sign-On (SSO) cho FUN Ecosystem, cho phép các ứng dụng bên ngoài (FUN Games, FUN Shop, FUN Learn, v.v.) xác thực người dùng thông qua tài khoản Fun Profile đã đăng ký, sử dụng chuẩn OAuth 2.0 + OpenID Connect (OIDC).

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                           FUN ECOSYSTEM                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                  │
│  │   FUN Games  │    │   FUN Shop   │    │  FUN Learn   │   ...            │
│  │   (Client)   │    │   (Client)   │    │   (Client)   │                  │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘                  │
│         │                   │                   │                          │
│         │        OAuth 2.0 / OIDC Flow          │                          │
│         └───────────────────┼───────────────────┘                          │
│                             ▼                                              │
│  ┌──────────────────────────────────────────────────────────────┐          │
│  │                    FUN-ID (Identity Provider)                │          │
│  │              Cloudflare Worker API Gateway                   │          │
│  │  ┌─────────────────────────────────────────────────────────┐ │          │
│  │  │ /oauth/authorize   - Authorization Endpoint             │ │          │
│  │  │ /oauth/token       - Token Endpoint                     │ │          │
│  │  │ /oauth/userinfo    - UserInfo Endpoint                  │ │          │
│  │  │ /.well-known/      - Discovery + JWKS                   │ │          │
│  │  └─────────────────────────────────────────────────────────┘ │          │
│  └──────────────────────────┬───────────────────────────────────┘          │
│                             │                                              │
│                             ▼                                              │
│  ┌──────────────────────────────────────────────────────────────┐          │
│  │                      SUPABASE                                │          │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐  │          │
│  │  │    auth.users   │  │    profiles     │  │ oauth_clients│  │          │
│  │  │  (Supabase Auth)│  │  (user data)    │  │    (new)     │  │          │
│  │  └─────────────────┘  └─────────────────┘  └──────────────┘  │          │
│  └──────────────────────────────────────────────────────────────┘          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Chuẩn bị Database (1-2 ngày)

### 1.1 Tạo bảng `oauth_clients` - Đăng ký ứng dụng client

```sql
-- OAuth Clients table
CREATE TABLE public.oauth_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id text UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  client_secret text NOT NULL, -- hashed với bcrypt
  client_name text NOT NULL,
  client_uri text,
  logo_uri text,
  redirect_uris text[] NOT NULL, -- allowed redirect URIs
  grant_types text[] DEFAULT ARRAY['authorization_code'],
  scopes text[] DEFAULT ARRAY['openid', 'profile'],
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- RLS: Only admins can manage clients
ALTER TABLE public.oauth_clients ENABLE ROW LEVEL SECURITY;
```

### 1.2 Tạo bảng `oauth_authorization_codes` - Lưu authorization codes

```sql
CREATE TABLE public.oauth_authorization_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  client_id text NOT NULL REFERENCES oauth_clients(client_id),
  user_id uuid NOT NULL,
  redirect_uri text NOT NULL,
  scope text NOT NULL,
  code_challenge text, -- PKCE
  code_challenge_method text, -- 'S256'
  expires_at timestamptz NOT NULL,
  used boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
```

### 1.3 Tạo bảng `oauth_refresh_tokens` - Quản lý refresh tokens

```sql
CREATE TABLE public.oauth_refresh_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash text UNIQUE NOT NULL, -- SHA256 hash
  client_id text NOT NULL REFERENCES oauth_clients(client_id),
  user_id uuid NOT NULL,
  scope text NOT NULL,
  expires_at timestamptz NOT NULL,
  revoked boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
```

### 1.4 Tạo bảng `oauth_consents` - Lưu user consent

```sql
CREATE TABLE public.oauth_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  client_id text NOT NULL REFERENCES oauth_clients(client_id),
  scopes text[] NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, client_id)
);
```

---

## Phase 2: Triển khai OAuth 2.0 Endpoints trên Worker (3-5 ngày)

### 2.1 Discovery Endpoint - `/.well-known/openid-configuration`

```typescript
// Response theo chuẩn OIDC Discovery
{
  "issuer": "https://funprofile-api.funecosystem.org",
  "authorization_endpoint": "https://funprofile-api.funecosystem.org/oauth/authorize",
  "token_endpoint": "https://funprofile-api.funecosystem.org/oauth/token",
  "userinfo_endpoint": "https://funprofile-api.funecosystem.org/oauth/userinfo",
  "jwks_uri": "https://funprofile-api.funecosystem.org/.well-known/jwks.json",
  "scopes_supported": ["openid", "profile", "email", "wallet"],
  "response_types_supported": ["code"],
  "grant_types_supported": ["authorization_code", "refresh_token"],
  "token_endpoint_auth_methods_supported": ["client_secret_basic", "client_secret_post"],
  "id_token_signing_alg_values_supported": ["RS256"],
  "claims_supported": ["sub", "name", "email", "picture", "wallet_address", "camly_balance"]
}
```

### 2.2 Authorization Endpoint - `/oauth/authorize`

```text
Flow:
┌─────────────────────────────────────────────────────────────────────┐
│ Client App redirects user to:                                       │
│ /oauth/authorize?                                                   │
│   client_id=xxx                                                     │
│   redirect_uri=https://fungames.com/callback                        │
│   response_type=code                                                │
│   scope=openid profile                                              │
│   state=random_state                                                │
│   code_challenge=xxx (PKCE)                                         │
│   code_challenge_method=S256                                        │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│ FUN-ID checks:                                                      │
│ 1. Validate client_id & redirect_uri                                │
│ 2. Check if user is logged in (Supabase session)                    │
│   - If not: redirect to /auth?return_to=/oauth/authorize?...        │
│ 3. Check if user already consented to this client                   │
│   - If not: show consent screen                                     │
│ 4. Generate authorization code + store in DB                        │
│ 5. Redirect to redirect_uri?code=xxx&state=xxx                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.3 Token Endpoint - `/oauth/token`

```text
POST /oauth/token
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code
code=xxx
redirect_uri=https://fungames.com/callback
client_id=xxx
client_secret=xxx
code_verifier=xxx (PKCE)

Response:
{
  "access_token": "eyJhbGc...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "xxx",
  "id_token": "eyJhbGc...",  // OIDC ID Token
  "scope": "openid profile"
}
```

### 2.4 UserInfo Endpoint - `/oauth/userinfo`

```text
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

### 2.5 JWKS Endpoint - `/.well-known/jwks.json`

```typescript
// FUN-ID sẽ generate RSA key pair để ký ID tokens
// Public keys exposed via JWKS cho clients verify
{
  "keys": [{
    "kty": "RSA",
    "kid": "funid-key-1",
    "use": "sig",
    "alg": "RS256",
    "n": "...",
    "e": "AQAB"
  }]
}
```

---

## Phase 3: Frontend - Consent Screen & OAuth Flow (2-3 ngày)

### 3.1 Trang Consent Screen - `/oauth/consent`

```text
┌────────────────────────────────────────────────────────────┐
│                      [FUN-ID Logo]                         │
│                                                            │
│         "FUN Games" muốn truy cập tài khoản của bạn        │
│                                                            │
│  ┌────────────────────────────────────────────────────┐    │
│  │  [✓] Xem thông tin hồ sơ (tên, avatar)             │    │
│  │  [✓] Xem địa chỉ email                             │    │
│  │  [ ] Xem số dư CAMLY COIN                          │    │
│  │  [ ] Xem địa chỉ ví                                │    │
│  └────────────────────────────────────────────────────┘    │
│                                                            │
│  Đăng nhập với tư cách: lovehouse@camly.co                 │
│                                                            │
│  ┌──────────────┐        ┌──────────────────────────┐      │
│  │    Từ chối   │        │  Cho phép & Tiếp tục     │      │
│  └──────────────┘        └──────────────────────────┘      │
│                                                            │
│  [Đổi tài khoản]                                           │
└────────────────────────────────────────────────────────────┘
```

### 3.2 Integration với Auth Flow

- Thêm route `/oauth/consent` vào React app
- Xử lý redirect back từ `/auth` sau khi login
- Lưu consent vào database

---

## Phase 4: Security Hardening (2-3 ngày)

### 4.1 PKCE (Proof Key for Code Exchange) - Bắt buộc

```typescript
// Client generates:
code_verifier = generateRandomString(64);
code_challenge = base64url(sha256(code_verifier));

// Authorization request includes:
code_challenge=xxx&code_challenge_method=S256

// Token request includes:
code_verifier=xxx

// Server validates:
sha256(code_verifier) === stored_code_challenge
```

### 4.2 Security Measures

| Measure | Implementation |
|---------|----------------|
| **Authorization Code** | Single-use, expires in 10 minutes |
| **PKCE** | Required for all public clients |
| **State Parameter** | Required, validated on callback |
| **Redirect URI Validation** | Exact match with registered URIs |
| **Rate Limiting** | 10 authorize requests/minute per IP |
| **Token Rotation** | New refresh token on each use |
| **Scope Validation** | Only granted scopes in tokens |

### 4.3 RSA Key Management

```typescript
// Store in Cloudflare Workers KV or Secrets:
FUNID_RSA_PRIVATE_KEY // For signing ID tokens
FUNID_RSA_PUBLIC_KEY  // Exposed via JWKS

// Key rotation:
- Generate new key pair quarterly
- Keep old public keys in JWKS for 30 days
- Use 'kid' (key ID) to identify active key
```

---

## Phase 5: SDK & Documentation (2-3 ngày)

### 5.1 FUN-ID JavaScript SDK

```typescript
// npm install @funecosystem/funid-sdk

import { FunID } from '@funecosystem/funid-sdk';

const funid = new FunID({
  clientId: 'your-client-id',
  redirectUri: 'https://your-app.com/callback',
  scopes: ['openid', 'profile', 'email'],
});

// Login
funid.login();

// Handle callback
const { user, accessToken } = await funid.handleCallback();

// Get user info
const userInfo = await funid.getUserInfo();
```

### 5.2 Developer Portal

- Trang đăng ký OAuth Client mới
- Dashboard quản lý clients
- API documentation
- Code examples cho các framework phổ biến

---

## Phase 6: Testing & Deployment (2-3 ngày)

### 6.1 Test Cases

| Test | Description |
|------|-------------|
| Happy Path | Full authorization code flow |
| PKCE Validation | Reject invalid code_verifier |
| Invalid Redirect | Reject unregistered redirect_uri |
| Expired Code | Reject code after 10 minutes |
| Token Refresh | Issue new tokens with refresh_token |
| Consent Revocation | User can revoke consent |
| Rate Limiting | Block after 10 requests/minute |

### 6.2 Deployment Checklist

- [ ] Generate production RSA keys
- [ ] Store private key in Cloudflare Secrets
- [ ] Deploy JWKS endpoint
- [ ] Register first test client
- [ ] End-to-end test with test client
- [ ] Monitor logs for security events
- [ ] Documentation complete

---

## Scopes & Claims Mapping

| Scope | Claims Included |
|-------|-----------------|
| `openid` | `sub`, `iss`, `aud`, `exp`, `iat` |
| `profile` | `name`, `picture` |
| `email` | `email`, `email_verified` |
| `wallet` | `wallet_address`, `camly_balance` |

---

## Timeline Tổng thể

| Phase | Thời gian | Mô tả |
|-------|-----------|-------|
| Phase 1 | 1-2 ngày | Database schema |
| Phase 2 | 3-5 ngày | OAuth endpoints trên Worker |
| Phase 3 | 2-3 ngày | Frontend consent screen |
| Phase 4 | 2-3 ngày | Security hardening |
| Phase 5 | 2-3 ngày | SDK & documentation |
| Phase 6 | 2-3 ngày | Testing & deployment |
| **Tổng** | **12-19 ngày** | |

---

## Kết quả mong đợi

1. **Cho người dùng:** Đăng nhập một lần, sử dụng toàn bộ FUN Ecosystem
2. **Cho developer:** SDK đơn giản, documentation rõ ràng
3. **Cho bảo mật:** OAuth 2.0 + PKCE + RSA signing chuẩn công nghiệp
4. **Cho scalability:** Cloudflare Worker xử lý hàng triệu requests/ngày

---

## Phần kỹ thuật chi tiết

### Worker Code Structure (Mở rộng từ hiện tại)

```text
worker/src/
├── index.ts              # Main router (existing)
├── oauth/
│   ├── authorize.ts      # Authorization endpoint
│   ├── token.ts          # Token endpoint  
│   ├── userinfo.ts       # UserInfo endpoint
│   ├── consent.ts        # Consent validation
│   ├── pkce.ts           # PKCE utilities
│   └── jwt.ts            # ID token signing
├── .well-known/
│   ├── openid-config.ts  # Discovery document
│   └── jwks.ts           # Public keys
└── utils/
    ├── crypto.ts         # RSA, hashing
    └── validation.ts     # Input validation
```

### Secrets cần thêm (Cloudflare)

| Secret | Mô tả |
|--------|-------|
| `FUNID_RSA_PRIVATE_KEY` | Private key để ký ID tokens |
| `FUNID_RSA_KID` | Key ID cho JWKS |

