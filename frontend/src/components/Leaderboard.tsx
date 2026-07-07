'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { getLeaderboard, type LeaderboardEntry } from '@/lib/api';

interface LeaderboardProps {
  refreshKey?: number;
}

export default function Leaderboard({ refreshKey }: LeaderboardProps) {
  const { token, user } = useAuth();
  const [top, setTop] = useState<LeaderboardEntry[]>([]);
  const [me, setMe] = useState<LeaderboardEntry | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    getLeaderboard()
      .then((data) => {
        if (cancelled) return;
        setTop(data.top);
        setMe(data.me);
      })
      .catch(() => {
        // Leaderboard is non-critical; fail silently
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token, refreshKey]);

  if (!token) {
    return (
      <div
        className="relative overflow-hidden rounded-lg border-2 border-[#6f7a8d] bg-[#111820]/90 p-3 text-center shadow-[0_12px_28px_rgba(0,0,0,0.45),inset_0_0_20px_rgba(255,255,255,0.04)] backdrop-blur-sm"
        style={{ fontFamily: 'var(--font-press-start-2p), monospace' }}
      >
        <div className="absolute inset-0 pointer-events-none opacity-25 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.12),transparent_26%),linear-gradient(rgba(255,255,255,0.07)_1px,transparent_1px)] bg-[length:100%_100%,100%_5px]" />
        <p className="relative text-[#d9dee8] text-[9px] sm:text-[10px] leading-5">
          Sign in with the button at the top to save points and see the leaderboard.
        </p>
      </div>
    );
  }

  const meIsInTop = me ? top.some((entry) => entry.id === me.id) : false;
  const firstName = (name: string) => name.trim().split(/\s+/)[0] || name;

  return (
    <div
      className="relative w-full overflow-hidden rounded-lg border-2 border-[#6f7a8d] bg-[#0b0e0f]/90 p-2 sm:p-3 shadow-[0_14px_34px_rgba(0,0,0,0.55),inset_0_0_24px_rgba(255,255,255,0.035)] backdrop-blur-sm"
      style={{ fontFamily: 'var(--font-press-start-2p), monospace' }}
    >
      <div className="absolute inset-0 pointer-events-none opacity-25 bg-[radial-gradient(circle_at_26%_18%,rgba(255,255,255,0.12),transparent_28%),linear-gradient(rgba(255,255,255,0.065)_1px,transparent_1px)] bg-[length:100%_100%,100%_5px]" />
      <div className="absolute inset-x-2 top-2 h-px bg-white/20" />

      <div className="relative mb-2 border-b border-white/15 pb-2 text-center">
        <p className="text-[#f4f4f4] text-[9px] sm:text-[10px] uppercase tracking-[0.14em] drop-shadow-[0_2px_0_rgba(0,0,0,0.8)]">
          High Scores
        </p>
        <p className="mt-1 text-[#9aa3b2] text-[7px] sm:text-[8px] tracking-[0.08em]">
          Replay 
        </p>
      </div>

      {isLoading ? (
        <p className="relative text-[#b7bfce] text-[9px] text-center py-4">Loading...</p>
      ) : (
        <div className="relative flex flex-col gap-1.5">
          {top.map((entry) => {
            const isMe = user && entry.id === user.id;
            return (
              <div
                key={entry.id}
                className={`grid grid-cols-[1.6rem_minmax(0,1fr)_auto] items-center gap-2 border px-2 py-1.5 text-[8px] sm:text-[9px] leading-4 ${
                  isMe
                    ? 'border-white bg-white text-[#0b0e0f] shadow-[0_0_0_2px_rgba(255,255,255,0.18)]'
                    : 'border-white/15 bg-[#151a1f]/85 text-[#e8ebf0]'
                }`}
              >
                <span className={isMe ? 'text-right text-[#0b0e0f]/60' : 'text-right text-[#8f98a8]'}>
                  {entry.rank}
                </span>
                <span className="min-w-0 truncate">{firstName(entry.name)}</span>
                <span className={isMe ? 'text-[#0b0e0f]' : 'text-[#f6f6f6]'}>
                  {entry.totalPoints}
                </span>
              </div>
            );
          })}

          {me && !meIsInTop && (
            <>
              <div className="my-1 border-t border-white/15" />
              <div className="grid grid-cols-[1.6rem_minmax(0,1fr)_auto] items-center gap-2 border border-white bg-white px-2 py-1.5 text-[8px] sm:text-[9px] leading-4 text-[#0b0e0f] shadow-[0_0_0_2px_rgba(255,255,255,0.18)]">
                <span className="text-right text-[#0b0e0f]/60">{me.rank}</span>
                <span className="min-w-0 truncate">{firstName(me.name)}</span>
                <span>{me.totalPoints}</span>
              </div>
            </>
          )}

          {top.length === 0 && !me && (
            <p className="text-[#b7bfce] text-[9px] text-center py-4">No scores yet.</p>
          )}
        </div>
      )}
    </div>
  );
}
