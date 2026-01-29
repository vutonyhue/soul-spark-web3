-- =====================================================
-- FUN-ID SSO OAuth 2.0 Database Schema
-- Phase 1: Core OAuth tables with security hardening
-- =====================================================

-- 1. Create app_role enum for admin management
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

-- 2. Create user_roles table (separate from profiles for security)
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 3. Create security definer function to check roles (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- 4. RLS policies for user_roles (only admins can manage)
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
ON public.user_roles
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert roles"
ON public.user_roles
FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete roles"
ON public.user_roles
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- =====================================================
-- OAuth 2.0 Tables
-- =====================================================

-- 5. OAuth Clients table - Registered applications
CREATE TABLE public.oauth_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id text UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  client_secret_hash text NOT NULL, -- bcrypt hashed
  client_name text NOT NULL,
  client_uri text,
  logo_uri text,
  redirect_uris text[] NOT NULL,
  grant_types text[] DEFAULT ARRAY['authorization_code'],
  scopes text[] DEFAULT ARRAY['openid', 'profile'],
  is_confidential boolean DEFAULT true, -- false for public clients (SPAs)
  is_active boolean DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.oauth_clients ENABLE ROW LEVEL SECURITY;

-- OAuth clients readable by authenticated users (for consent screen)
CREATE POLICY "Authenticated users can view active clients"
ON public.oauth_clients
FOR SELECT
TO authenticated
USING (is_active = true);

-- Only admins can manage clients
CREATE POLICY "Admins can insert clients"
ON public.oauth_clients
FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update clients"
ON public.oauth_clients
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete clients"
ON public.oauth_clients
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- 6. Authorization Codes table - Temporary codes for OAuth flow
CREATE TABLE public.oauth_authorization_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  client_id text NOT NULL REFERENCES oauth_clients(client_id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  redirect_uri text NOT NULL,
  scope text NOT NULL,
  code_challenge text, -- PKCE
  code_challenge_method text CHECK (code_challenge_method IN ('S256', 'plain')),
  state text,
  nonce text, -- For OIDC
  expires_at timestamptz NOT NULL,
  used boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS - No direct access, only via service role
ALTER TABLE public.oauth_authorization_codes ENABLE ROW LEVEL SECURITY;

-- No public policies - accessed only by Worker with service role key

-- 7. Refresh Tokens table
CREATE TABLE public.oauth_refresh_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash text UNIQUE NOT NULL, -- SHA256 hash of the token
  client_id text NOT NULL REFERENCES oauth_clients(client_id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scope text NOT NULL,
  expires_at timestamptz NOT NULL,
  revoked boolean DEFAULT false,
  revoked_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.oauth_refresh_tokens ENABLE ROW LEVEL SECURITY;

-- Users can view their own refresh tokens (for session management UI)
CREATE POLICY "Users can view their own refresh tokens"
ON public.oauth_refresh_tokens
FOR SELECT
USING (auth.uid() = user_id);

-- Users can revoke their own refresh tokens
CREATE POLICY "Users can revoke their own refresh tokens"
ON public.oauth_refresh_tokens
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (revoked = true); -- Can only set revoked to true

-- 8. User Consents table - Remembers user consent for each client
CREATE TABLE public.oauth_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id text NOT NULL REFERENCES oauth_clients(client_id) ON DELETE CASCADE,
  scopes text[] NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, client_id)
);

-- Enable RLS
ALTER TABLE public.oauth_consents ENABLE ROW LEVEL SECURITY;

-- Users can view their own consents
CREATE POLICY "Users can view their own consents"
ON public.oauth_consents
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own consents
CREATE POLICY "Users can insert their own consents"
ON public.oauth_consents
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own consents
CREATE POLICY "Users can update their own consents"
ON public.oauth_consents
FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete/revoke their own consents
CREATE POLICY "Users can delete their own consents"
ON public.oauth_consents
FOR DELETE
USING (auth.uid() = user_id);

-- =====================================================
-- Indexes for performance
-- =====================================================

CREATE INDEX idx_oauth_auth_codes_code ON public.oauth_authorization_codes(code);
CREATE INDEX idx_oauth_auth_codes_expires ON public.oauth_authorization_codes(expires_at);
CREATE INDEX idx_oauth_refresh_tokens_hash ON public.oauth_refresh_tokens(token_hash);
CREATE INDEX idx_oauth_refresh_tokens_user ON public.oauth_refresh_tokens(user_id);
CREATE INDEX idx_oauth_consents_user_client ON public.oauth_consents(user_id, client_id);
CREATE INDEX idx_user_roles_user ON public.user_roles(user_id);

-- =====================================================
-- Triggers for updated_at
-- =====================================================

CREATE TRIGGER update_oauth_clients_updated_at
  BEFORE UPDATE ON public.oauth_clients
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_oauth_consents_updated_at
  BEFORE UPDATE ON public.oauth_consents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- Cleanup function for expired codes/tokens
-- =====================================================

CREATE OR REPLACE FUNCTION public.cleanup_expired_oauth_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Delete expired authorization codes
  DELETE FROM public.oauth_authorization_codes
  WHERE expires_at < now() OR used = true;
  
  -- Delete expired refresh tokens
  DELETE FROM public.oauth_refresh_tokens
  WHERE expires_at < now() OR revoked = true;
END;
$$;