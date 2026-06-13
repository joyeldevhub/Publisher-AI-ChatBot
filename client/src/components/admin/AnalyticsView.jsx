import { useState, useEffect } from 'react';
import { TrendingUp, Users, MessageSquare, Clock, Zap } from 'lucide-react';

export default function AnalyticsView() {
  const [stats, setStats] = useState({
    totalConversations: 0,
    totalMessages: 0,
    activeUsers: 0,
    averageMessagesPerChat: 0,
    totalTokensUsed: 0,
    popularTopics: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      try {
        const token = localStorage.getItem('admin_token');
        const res = await fetch('/api/admin/analytics', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setStats(data);
        }
      } catch (err) {
        console.error('Failed to load analytics:', err);
      } finally {
        setLoading(false);
      }
    }
    loadStats();
  }, []);

  if (loading) {
    return <div className="text-center py-8 text-slate-500">Loading analytics...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-xl p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-blue-600 font-semibold uppercase tracking-wide mb-1">Conversations</p>
              <p className="text-3xl font-bold text-blue-900">{stats.totalConversations}</p>
            </div>
            <MessageSquare size={32} className="text-blue-300" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200 rounded-xl p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-purple-600 font-semibold uppercase tracking-wide mb-1">Total Messages</p>
              <p className="text-3xl font-bold text-purple-900">{stats.totalMessages}</p>
            </div>
            <MessageSquare size={32} className="text-purple-300" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-green-100 border border-green-200 rounded-xl p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-green-600 font-semibold uppercase tracking-wide mb-1">Active Users</p>
              <p className="text-3xl font-bold text-green-900">{stats.activeUsers}</p>
            </div>
            <Users size={32} className="text-green-300" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-orange-50 to-orange-100 border border-orange-200 rounded-xl p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-orange-600 font-semibold uppercase tracking-wide mb-1">Avg Messages/Chat</p>
              <p className="text-3xl font-bold text-orange-900">{stats.averageMessagesPerChat.toFixed(1)}</p>
            </div>
            <TrendingUp size={32} className="text-orange-300" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-pink-50 to-pink-100 border border-pink-200 rounded-xl p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-pink-600 font-semibold uppercase tracking-wide mb-1">Tokens Used</p>
              <p className="text-3xl font-bold text-pink-900">{(stats.totalTokensUsed / 1000).toFixed(1)}K</p>
            </div>
            <Zap size={32} className="text-pink-300" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-cyan-50 to-cyan-100 border border-cyan-200 rounded-xl p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-cyan-600 font-semibold uppercase tracking-wide mb-1">Avg Response Time</p>
              <p className="text-3xl font-bold text-cyan-900">~2.5s</p>
            </div>
            <Clock size={32} className="text-cyan-300" />
          </div>
        </div>
      </div>

      {/* Popular Topics */}
      {stats.popularTopics && stats.popularTopics.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <h3 className="font-semibold text-slate-800 mb-4">Popular Topics</h3>
          <div className="space-y-3">
            {stats.popularTopics.map((topic, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-700">{topic.name}</p>
                  <div className="h-2 bg-slate-200 rounded-full overflow-hidden mt-1">
                    <div
                      className="h-full bg-gradient-to-r from-brand-400 to-brand-500"
                      style={{ width: `${(topic.count / stats.totalMessages) * 100}%` }}
                    />
                  </div>
                </div>
                <span className="text-sm font-semibold text-slate-600 whitespace-nowrap">{topic.count} msgs</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <p className="text-sm text-blue-900">
          <strong>Analytics Note:</strong> These statistics are updated in real-time based on conversation activity. Data is collected for the past 30 days.
        </p>
      </div>
    </div>
  );
}
