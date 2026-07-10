'use client';

import { GoogleLogin } from '@react-oauth/google';
import { useState } from 'react';
import { useAuth } from '@/lib/auth';

interface SignInPromptProps {
  message?: string;
  onClose?: () => void;
}

export default function SignInPrompt({
  message = 'Sign in to save points and see the leaderboard.',
  onClose,
}: SignInPromptProps) {
  const { loginWithCredential } = useAuth();
  const [signInError, setSignInError] = useState('');

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 px-4 backdrop-blur-[2px]">
      <div
        className="relative w-full max-w-[28rem] overflow-hidden rounded-lg border-2 border-[#6f7a8d] bg-[#111820]/95 px-6 py-7 text-center shadow-[0_18px_42px_rgba(0,0,0,0.65),inset_0_0_22px_rgba(255,255,255,0.045)]"
        style={{ fontFamily: 'var(--font-press-start-2p), monospace' }}
      >
        <div className="absolute inset-0 pointer-events-none opacity-25 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.12),transparent_26%),linear-gradient(rgba(255,255,255,0.07)_1px,transparent_1px)] bg-[length:100%_100%,100%_5px]" />

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 z-10 text-xs text-[#9aa3b2] transition hover:text-white"
            aria-label="Close sign in prompt"
          >
            X
          </button>
        )}

        <p className="relative mx-auto max-w-[22rem] text-[#d9dee8] text-[clamp(0.85rem,2.8vw,1.1rem)] leading-[1.7]">
          {message}
        </p>

        <div className="relative mt-5 flex justify-center">
          <GoogleLogin
            onSuccess={(cred) => {
              setSignInError('');
              if (cred.credential) {
                loginWithCredential(cred.credential).catch((err) => {
                  console.error('Sign-in error:', err);
                  setSignInError(err?.message || 'Sign-in failed. Please try again.');
                });
              }
            }}
            onError={() => setSignInError('Google sign-in was cancelled or failed.')}
            theme="filled_black"
            shape="pill"
            text="signin_with"
            width="320"
          />
        </div>

        {signInError && (
          <p className="relative mt-4 text-red-400 text-[0.65rem] leading-5">{signInError}</p>
        )}
      </div>
    </div>
  );
}
