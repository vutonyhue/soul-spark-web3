-- Fix: Add service-role-only policy for oauth_authorization_codes
-- This table should only be accessible via service role key (Worker)
-- Adding a policy that always returns false for anon/authenticated roles

CREATE POLICY "Service role only - no direct access"
ON public.oauth_authorization_codes
FOR ALL
TO authenticated, anon
USING (false)
WITH CHECK (false);