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
      <div className="bg-white rounded-xl shadow-lg p-4 text-center">
        <p className="text-black text-xs sm:text-sm font-medium">
          Sign in for points and to see leaderboard.
        </p>
      </div>
    );
  }

  const meIsInTop = me ? top.some((entry) => entry.id === me.id) : false;

  return (
    <div className="bg-white rounded-xl shadow-lg p-3 sm:p-4 w-full">
      <p className="text-black text-[10px] sm:text-xs uppercase tracking-widest font-bold mb-2 sm:mb-3 text-center">
        Leaderboard
      </p>

      {isLoading ? (
        <p className="text-black/50 text-xs text-center py-4">Loading...</p>
      ) : (
        <div className="flex flex-col gap-1 sm:gap-1.5">
          {top.map((entry) => {
            const isMe = user && entry.id === (me?.id ?? '');
            return (
              <div
                key={entry.id}
                className={`flex items-center justify-between px-2 py-1 rounded-lg text-xs sm:text-sm ${
                  isMe ? 'bg-black text-white font-bold' : 'text-black'
                }`}
              >
                <span className="flex items-center gap-2 truncate">
                  <span className="opacity-60 w-4 text-right">{entry.rank}</span>
                  <span className="truncate">{entry.name}</span>
                </span>
                <span className="font-semibold">{entry.totalPoints}</span>
              </div>
            );
          })}

          {me && !meIsInTop && (
            <>
              <div className="border-t border-black/10 my-1" />
              <div className="flex items-center justify-between px-2 py-1 rounded-lg text-xs sm:text-sm bg-black text-white font-bold">
                <span className="flex items-center gap-2 truncate">
                  <span className="opacity-60 w-4 text-right">{me.rank}</span>
                  <span className="truncate">{me.name}</span>
                </span>
                <span className="font-semibold">{me.totalPoints}</span>
              </div>
            </>
          )}

          {top.length === 0 && !me && (
            <p className="text-black/50 text-xs text-center py-4">No scores yet.</p>
          )}
        </div>
      )}
    </div>
  );
}
