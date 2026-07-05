'use client';

import { ReactNode } from 'react';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { AuthProvider } from '@/lib/auth';

// The Google OAuth Client ID. Set NEXT_PUBLIC_GOOGLE_CLIENT_ID per environment
// (dev client locally, prod client on the server). Falls back to the dev client.
const GOOGLE_CLIENT_ID =
  process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ||
  '103998945467-3e3ghetqb4m5b4d6pvauhmsva7ltr902.apps.googleusercontent.com';

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <AuthProvider>{children}</AuthProvider>
    </GoogleOAuthProvider>
  );
}
