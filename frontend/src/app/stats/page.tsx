'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getStats, type Stats } from '@/lib/api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';

export default function StatsPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  
  useEffect(() => {
    fetchStats();
  }, []);
  
  const fetchStats = async () => {
    try {
      setIsLoading(true);
      const data = await getStats();
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
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-white mx-auto mb-4"></div>
          <p className="text-white text-xl font-semibold">Loading statistics...</p>
        </div>
      </main>
    );
  }
  
  if (error) {
    return (
      <main className="min-h-screen flex items-center justify-center p-8 bg-[#0E0E10]">
        <div className="text-center">
          <p className="text-white text-xl font-semibold mb-4">❌ {error}</p>
          <Link href="/">
            <button className="bg-white text-indigo-600 font-semibold py-2 px-6 rounded-lg">
              Back to Home
            </button>
          </Link>
        </div>
      </main>
    );
  }
  
  if (!stats) return null;
  
  // Prepare chart data
  const chartData = [
    { name: 'Level 1', value: stats.distribution.level1, fill: '#10b981' },
    { name: 'Level 2', value: stats.distribution.level2, fill: '#f59e0b' },
    { name: 'Level 3', value: stats.distribution.level3, fill: '#ef4444' },
    { name: 'Failed', value: stats.distribution.failed, fill: '#6b7280' },
  ];
  
  const successRate = stats.totalPlays > 0
    ? ((stats.correctPlays / stats.totalPlays) * 100).toFixed(1)
    : '0.0';
  
  return (
    <main className="min-h-screen p-8 bg-[#0E0E10]">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <Link href="/">
            <button className="mb-4 bg-white/20 hover:bg-white/30 text-white font-semibold py-2 px-6 rounded-lg backdrop-blur-sm transition">
              ← Back to Home
            </button>
          </Link>
          <h1 className="text-4xl font-bold text-white mb-2">📊 Statistics</h1>
          <p className="text-white/80 text-lg">Global game statistics</p>
        </div>
        
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-lg p-6 text-center">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Total Plays</p>
            <p className="text-4xl font-bold text-indigo-600">{stats.totalPlays}</p>
          </div>
          
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-lg p-6 text-center">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Success Rate</p>
            <p className="text-4xl font-bold text-green-600">{successRate}%</p>
          </div>
          
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-lg p-6 text-center">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Avg Level</p>
            <p className="text-4xl font-bold text-purple-600">{stats.averageLevel.toFixed(2)}</p>
          </div>
          
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-lg p-6 text-center">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Correct Guesses</p>
            <p className="text-4xl font-bold text-teal-600">{stats.correctPlays}</p>
          </div>
        </div>
        
        {/* Chart */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-8 mb-6">
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-6 text-center">
            Distribution by Level
          </h2>
          
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="value" name="Guesses">
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          
          <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-green-50 dark:bg-green-900 rounded-lg">
              <p className="text-3xl font-bold text-green-600 dark:text-green-300">{stats.distribution.level1}</p>
              <p className="text-sm text-gray-600 dark:text-gray-300">Level 1 (Drums)</p>
            </div>
            
            <div className="text-center p-4 bg-yellow-50 dark:bg-yellow-900 rounded-lg">
              <p className="text-3xl font-bold text-yellow-600 dark:text-yellow-300">{stats.distribution.level2}</p>
              <p className="text-sm text-gray-600 dark:text-gray-300">Level 2 (+Instruments)</p>
            </div>
            
            <div className="text-center p-4 bg-red-50 dark:bg-red-900 rounded-lg">
              <p className="text-3xl font-bold text-red-600 dark:text-red-300">{stats.distribution.level3}</p>
              <p className="text-sm text-gray-600 dark:text-gray-300">Level 3 (Full)</p>
            </div>
            
            <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <p className="text-3xl font-bold text-gray-600 dark:text-gray-300">{stats.distribution.failed}</p>
              <p className="text-sm text-gray-600 dark:text-gray-300">Failed</p>
            </div>
          </div>
        </div>
        
        {/* Insights */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-lg p-8">
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-4">
            💡 Insights
          </h2>
          <ul className="space-y-3 text-gray-700 dark:text-gray-300">
            <li className="flex items-start">
              <span className="text-xl mr-3">🎯</span>
              <span>
                Average guessed level of <strong>{stats.averageLevel.toFixed(2)}</strong> means players typically guess correctly 
                {stats.averageLevel < 1.5 ? ' very early (mostly at Level 1)!' : stats.averageLevel < 2.5 ? ' around Level 2.' : ' late in the game.'}
              </span>
            </li>
            <li className="flex items-start">
              <span className="text-xl mr-3">🏆</span>
              <span>
                {stats.distribution.level1} players guessed on drums alone - impressive!
              </span>
            </li>
            <li className="flex items-start">
              <span className="text-xl mr-3">📈</span>
              <span>
                Overall success rate: <strong>{successRate}%</strong>
              </span>
            </li>
          </ul>
        </div>
      </div>
    </main>
  );
}

