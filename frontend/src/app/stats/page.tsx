'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getMyStats, type Stats } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function StatsPage() {
  const router = useRouter();
  const { token, user, isLoading: isAuthLoading } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Require sign-in
  useEffect(() => {
    if (!isAuthLoading && !token) {
      router.replace('/');
    }
  }, [isAuthLoading, token, router]);

  useEffect(() => {
    if (token) {
      fetchStats();
    }
  }, [token]);

  const fetchStats = async () => {
    try {
      setIsLoading(true);
      const data = await getMyStats();
      setStats(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center p-8 bg-[#050506]">
        <div
          className="relative overflow-hidden border-2 border-[#6f7a8d] bg-[#111820]/90 px-8 py-7 text-center shadow-[0_14px_34px_rgba(0,0,0,0.55),inset_0_0_24px_rgba(255,255,255,0.035)]"
          style={{ fontFamily: 'var(--font-press-start-2p), monospace' }}
        >
          <div className="absolute inset-0 pointer-events-none opacity-25 bg-[linear-gradient(rgba(255,255,255,0.07)_1px,transparent_1px)] bg-[length:100%_5px]" />
          <p className="relative text-[#d9dee8] text-[10px] sm:text-xs uppercase tracking-[0.16em] leading-6">
            Loading stats...
          </p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen flex items-center justify-center p-8 bg-[#050506]">
        <div
          className="relative max-w-md overflow-hidden border-2 border-[#6f7a8d] bg-[#111820]/90 px-8 py-7 text-center shadow-[0_14px_34px_rgba(0,0,0,0.55),inset_0_0_24px_rgba(255,255,255,0.035)]"
          style={{ fontFamily: 'var(--font-press-start-2p), monospace' }}
        >
          <div className="absolute inset-0 pointer-events-none opacity-25 bg-[linear-gradient(rgba(255,255,255,0.07)_1px,transparent_1px)] bg-[length:100%_5px]" />
          <p className="relative mb-5 text-[#d9dee8] text-[10px] sm:text-xs leading-6">{error}</p>
          <Link href="/?menu=1">
            <button className="relative border-2 border-[#6f7a8d] px-5 py-3 text-[9px] sm:text-[10px] uppercase tracking-[0.14em] text-white transition hover:border-white hover:bg-white hover:text-[#0b0e0f]">
              Back Home
            </button>
          </Link>
        </div>
      </main>
    );
  }

  if (!stats) return null;

  const chartData = [
    { name: 'Level 1', value: stats.distribution.level1 },
    { name: 'Level 2', value: stats.distribution.level2 },
    { name: 'Level 3', value: stats.distribution.level3 },
    { name: 'Failed', value: stats.distribution.failed },
  ];

  const successRate = stats.totalPlays > 0
    ? ((stats.correctPlays / stats.totalPlays) * 100).toFixed(1)
    : '0.0';

  const totalPoints = stats.totalPoints ?? 0;
  const averagePointsPerSong = stats.averagePointsPerSong ?? 0;
  const guessRate = stats.guessRate ?? parseFloat(successRate);

  const primaryStats = [
    { label: 'Total Points', value: totalPoints },
    { label: 'Total Plays', value: stats.totalPlays },
    { label: 'Guess Rate', value: `${guessRate}%` },
    { label: 'Avg Points / Song', value: averagePointsPerSong.toFixed(2) },
    { label: 'Avg Level Guessed', value: stats.averageLevel.toFixed(2) },
    { label: 'Correct Guesses', value: stats.correctPlays },
  ];

  const distributionRows = [
    { label: 'Level 1 (Drums)', value: stats.distribution.level1 },
    { label: 'Level 2 (+ Instruments)', value: stats.distribution.level2 },
    { label: 'Level 3 (Full mix)', value: stats.distribution.level3 },
    { label: 'Failed', value: stats.distribution.failed },
  ];

  const panelClass =
    'relative overflow-hidden border-2 border-[#6f7a8d] bg-[#0b0e0f]/90 shadow-[0_14px_34px_rgba(0,0,0,0.55),inset_0_0_24px_rgba(255,255,255,0.035)]';
  const scanlineClass =
    'absolute inset-0 pointer-events-none opacity-25 bg-[radial-gradient(circle_at_26%_18%,rgba(255,255,255,0.12),transparent_28%),linear-gradient(rgba(255,255,255,0.065)_1px,transparent_1px)] bg-[length:100%_100%,100%_5px]';

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#050506] px-4 py-20 sm:px-6 lg:px-8">
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_50%_0%,rgba(120,20,20,0.22),transparent_32%),radial-gradient(circle_at_15%_80%,rgba(255,255,255,0.06),transparent_24%)]" />
      <div className="absolute inset-0 pointer-events-none opacity-20 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[length:100%_6px]" />

      <div className="relative mx-auto max-w-5xl">
        <div
          className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between"
          style={{ fontFamily: 'var(--font-press-start-2p), monospace' }}
        >
          <div>
            <Link href="/?menu=1">
              <button className="mb-5 text-[9px] uppercase tracking-[0.14em] text-[#9aa3b2] transition hover:text-white">
                Back Home
              </button>
            </Link>
            <p className="mb-3 text-[9px] uppercase tracking-[0.18em] text-[#9aa3b2]">
              Replay Profile
            </p>
            <h1 className="text-xl leading-8 text-white drop-shadow-[0_3px_0_rgba(0,0,0,0.8)] sm:text-3xl sm:leading-[3rem]">
              User Stats
            </h1>
          </div>
          <div className="text-left sm:text-right">
            <p className="text-[9px] uppercase tracking-[0.14em] text-[#9aa3b2]">Player</p>
            <p className="mt-2 max-w-[18rem] truncate text-[10px] leading-5 text-[#d9dee8] sm:text-xs">
              {user ? user.name : 'Signed in user'}
            </p>
          </div>
        </div>

        <section className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {primaryStats.map((stat, index) => (
            <div key={stat.label} className={`${panelClass} p-5 sm:p-6`}>
              <div className={scanlineClass} />
              <div className="relative">
                <p
                  className="mb-4 text-[8px] uppercase tracking-[0.16em] text-[#9aa3b2]"
                  style={{ fontFamily: 'var(--font-press-start-2p), monospace' }}
                >
                  {stat.label}
                </p>
                <p
                  className={`font-black leading-none text-white drop-shadow-[0_3px_0_rgba(0,0,0,0.85)] ${
                    index === 0 ? 'text-4xl sm:text-5xl' : 'text-3xl sm:text-4xl'
                  }`}
                >
                  {stat.value}
                </p>
              </div>
            </div>
          ))}
        </section>

        <section className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1.55fr)_minmax(18rem,0.85fr)]">
          <div className={`${panelClass} p-5 sm:p-7`}>
            <div className={scanlineClass} />
            <div className="relative">
              <div
                className="mb-6 flex items-center justify-between gap-4 border-b border-white/15 pb-4"
                style={{ fontFamily: 'var(--font-press-start-2p), monospace' }}
              >
                <h2 className="text-[10px] uppercase tracking-[0.16em] text-[#f4f4f4] sm:text-xs">
                  Guess Breakdown
                </h2>
                <p className="text-[8px] uppercase tracking-[0.12em] text-[#9aa3b2]">
                  By Level
                </p>
              </div>

              <div className="h-[260px] sm:h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 8, right: 8, left: -18, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="4 4" stroke="rgba(255,255,255,0.12)" vertical={false} />
                    <XAxis
                      dataKey="name"
                      stroke="rgba(255,255,255,0.45)"
                      tick={{ fill: 'rgba(255,255,255,0.62)', fontSize: 10, fontFamily: 'var(--font-press-start-2p), monospace' }}
                      tickLine={false}
                      axisLine={{ stroke: 'rgba(255,255,255,0.2)' }}
                    />
                    <YAxis
                      stroke="rgba(255,255,255,0.45)"
                      tick={{ fill: 'rgba(255,255,255,0.62)', fontSize: 10, fontFamily: 'var(--font-press-start-2p), monospace' }}
                      tickLine={false}
                      axisLine={{ stroke: 'rgba(255,255,255,0.2)' }}
                      allowDecimals={false}
                    />
                    <Tooltip
                      cursor={{ fill: 'rgba(255,255,255,0.06)' }}
                      contentStyle={{
                        background: '#111820',
                        border: '2px solid #6f7a8d',
                        borderRadius: 0,
                        color: '#fff',
                        fontFamily: 'var(--font-press-start-2p), monospace',
                        fontSize: '10px',
                      }}
                      labelStyle={{ color: '#fff' }}
                      itemStyle={{ color: '#fff' }}
                    />
                    <Bar dataKey="value" name="Guesses" fill="#f4f4f4" radius={[0, 0, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <aside className="flex flex-col gap-4">
            <div className={`${panelClass} p-5`}>
              <div className={scanlineClass} />
              <div className="relative">
                <p
                  className="mb-4 border-b border-white/15 pb-3 text-[10px] uppercase tracking-[0.16em] text-[#f4f4f4]"
                  style={{ fontFamily: 'var(--font-press-start-2p), monospace' }}
                >
                  Levels
                </p>
                <div className="flex flex-col gap-3">
                  {distributionRows.map((row) => (
                    <div
                      key={row.label}
                      className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border border-white/15 bg-[#151a1f]/85 px-3 py-3"
                    >
                      <p className="min-w-0 text-xs text-[#d9dee8] sm:text-sm">{row.label}</p>
                      <p
                        className="text-sm text-white"
                        style={{ fontFamily: 'var(--font-press-start-2p), monospace' }}
                      >
                        {row.value}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className={`${panelClass} p-5`}>
              <div className={scanlineClass} />
              <div className="relative text-sm leading-7 text-[#c7ccd6]">
                <p
                  className="mb-4 border-b border-white/15 pb-3 text-[10px] uppercase tracking-[0.16em] text-[#f4f4f4]"
                  style={{ fontFamily: 'var(--font-press-start-2p), monospace' }}
                >
                  Readout
                </p>
                <p>
                  Average guessed level: <strong className="text-white">{stats.averageLevel.toFixed(2)}</strong>.
                </p>
                <p className="mt-3">
                  {stats.averageLevel < 1.5
                    ? 'Mostly solved from drums alone.'
                    : stats.averageLevel < 2.5
                      ? 'Usually solved after instruments arrive.'
                      : 'Often solved near the full mix.'}
                </p>
                <p className="mt-3">
                  Drums-only clears: <strong className="text-white">{stats.distribution.level1}</strong>.
                </p>
                <p className="mt-3">
                  Overall guess rate: <strong className="text-white">{guessRate}%</strong>.
                </p>
              </div>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
