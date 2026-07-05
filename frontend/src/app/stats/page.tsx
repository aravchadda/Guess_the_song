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
      <main className="min-h-screen flex items-center justify-center p-8 bg-[#0E0E10]">
        <p className="text-white/60 text-sm tracking-widest uppercase">Loading statistics...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen flex items-center justify-center p-8 bg-[#0E0E10]">
        <div className="text-center">
          <p className="text-white text-lg mb-4">{error}</p>
          <Link href="/">
            <button className="border border-white/40 text-white text-sm py-2 px-6 rounded hover:bg-white/10 transition">
              Back to Home
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

  return (
    <main className="min-h-screen p-8 bg-[#0E0E10]">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-10">
          <Link href="/">
            <button className="mb-6 text-white/60 text-sm hover:text-white transition">
              ← Back to Home
            </button>
          </Link>
          <h1 className="text-3xl font-bold text-white mb-1">Your Statistics</h1>
          <p className="text-white/50 text-sm">
            {user ? user.name : 'Your game statistics'}
          </p>
        </div>

        {/* Primary stats - plain grid, no boxes */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-8 mb-12 pb-12 border-b border-white/10">
          {primaryStats.map((stat) => (
            <div key={stat.label}>
              <p className="text-white text-3xl font-bold mb-1">{stat.value}</p>
              <p className="text-white/50 text-xs uppercase tracking-widest">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Distribution chart */}
        <div className="mb-12 pb-12 border-b border-white/10">
          <h2 className="text-white/50 text-xs uppercase tracking-widest mb-6">
            Distribution by Level
          </h2>

          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
              <XAxis dataKey="name" stroke="rgba(255,255,255,0.4)" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }} />
              <YAxis stroke="rgba(255,255,255,0.4)" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }} allowDecimals={false} />
              <Tooltip
                contentStyle={{ background: '#0E0E10', border: '1px solid rgba(255,255,255,0.2)' }}
                labelStyle={{ color: '#fff' }}
                itemStyle={{ color: '#fff' }}
              />
              <Bar dataKey="value" name="Guesses" fill="#ffffff" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>

          <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
            {distributionRows.map((row) => (
              <div key={row.label}>
                <p className="text-white text-xl font-bold">{row.value}</p>
                <p className="text-white/50 text-xs">{row.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Summary */}
        <div className="text-white/70 text-sm space-y-2">
          <p>
            Average guessed level of <strong className="text-white">{stats.averageLevel.toFixed(2)}</strong>
            {stats.averageLevel < 1.5 ? ' — mostly on drums alone.' : stats.averageLevel < 2.5 ? ' — usually by the instruments.' : ' — often not until the full mix.'}
          </p>
          <p>
            Guessed correctly on drums alone <strong className="text-white">{stats.distribution.level1}</strong> time(s).
          </p>
          <p>
            Overall guess rate: <strong className="text-white">{guessRate}%</strong>
          </p>
        </div>
      </div>
    </main>
  );
}
