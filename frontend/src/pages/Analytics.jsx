import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../services/api';
import {
  IoChevronBack,
  IoPeopleOutline,
  IoChatbubbleEllipsesOutline,
  IoShieldOutline,
  IoHardwareChipOutline,
  IoAlertCircleOutline,
  IoWarningOutline,
  IoFlameOutline,
  IoCheckmarkCircleOutline,
} from 'react-icons/io5';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import Toast from '../components/Toast';

const Analytics = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const { data } = await API.get('/analytics');
      setStats(data.data);
    } catch (err) {
      console.error('Fetch stats error:', err);
      setToast({
        message: 'Failed to fetch analytics metrics: ' + (err.response?.data?.message || err.message),
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      title: 'Total Users',
      value: stats?.totalUsers || 0,
      icon: <IoPeopleOutline className="h-6 w-6 text-blue-400" />,
      bg: 'from-blue-500/10 to-blue-600/5 border-blue-500/20',
    },
    {
      title: 'Total Messages',
      value: stats?.totalMessages || 0,
      icon: <IoChatbubbleEllipsesOutline className="h-6 w-6 text-emerald-400" />,
      bg: 'from-emerald-500/10 to-emerald-600/5 border-emerald-500/20',
    },
    {
      title: 'AI Consultations',
      value: stats?.totalAiMessages || 0,
      icon: <IoHardwareChipOutline className="h-6 w-6 text-purple-400 animate-pulse" />,
      bg: 'from-purple-500/10 to-purple-600/5 border-purple-500/20',
    },
    {
      title: 'Toxic Messages Flagged',
      value: stats?.toxicityStats?.totalDetected || stats?.toxicMessagesBlocked || 0,
      icon: <IoShieldOutline className="h-6 w-6 text-rose-400" />,
      bg: 'from-rose-500/10 to-rose-600/5 border-rose-500/20',
    },
  ];

  const toxicity = stats?.toxicityStats || {
    totalAnalyzed: 0,
    totalDetected: 0,
    detectionRate: '0.0%',
    severityBreakdown: { high: 0, medium: 0, low: 0 },
    categoriesBreakdown: [],
    falsePositiveCount: 0,
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-chatBg text-chatText font-sans p-4 md:p-8 overflow-y-auto bg-chat-pattern bg-repeat">
      <div className="max-w-6xl mx-auto w-full space-y-6 pb-12">
        {/* Navigation & Title */}
        <div className="flex items-center gap-3 border-b border-chatBorder pb-4">
          <button
            onClick={() => navigate('/')}
            className="p-2 hover:bg-chatActive text-chatMuted hover:text-white rounded-full transition-colors"
          >
            <IoChevronBack className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
              🚀 Platform Analytics & AI Safety
            </h1>
            <p className="text-xs text-chatMuted">Real-Time platform metrics and automated AI moderation telemetry</p>
          </div>
        </div>

        {loading ? (
          <div className="h-96 flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-chatAccent"></div>
          </div>
        ) : (
          <>
            {/* Stat Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {statCards.map((card, i) => (
                <div
                  key={i}
                  className={`p-5 rounded-2xl border bg-gradient-to-br flex items-center justify-between glass-card ${card.bg}`}
                >
                  <div>
                    <h3 className="text-xs font-semibold text-chatMuted uppercase tracking-wider">
                      {card.title}
                    </h3>
                    <p className="text-3xl font-extrabold text-white mt-1.5 leading-none">
                      {card.value}
                    </p>
                  </div>
                  <div className="p-3 bg-chatBg rounded-xl border border-chatBorder shadow-inner">
                    {card.icon}
                  </div>
                </div>
              ))}
            </div>

            {/* AI Toxicity & Safety Intelligence Panel */}
            <div className="p-5 md:p-6 rounded-2xl glass-card border border-rose-500/20 bg-gradient-to-b from-rose-950/10 to-[#111b21] flex flex-col space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#222e35] pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-rose-500/15 text-rose-400 border border-rose-500/20">
                    <IoShieldOutline className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                      AI Safety & Toxic Message Intelligence
                    </h2>
                    <p className="text-xs text-chatMuted">Automated background moderation metrics powered by Gemini</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-semibold">
                    Detection Rate: {toxicity.detectionRate}
                  </span>
                </div>
              </div>

              {/* Sub metrics grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-xl bg-[#182229] border border-[#222e35]">
                  <span className="text-[10px] text-chatMuted uppercase font-semibold">Analyzed</span>
                  <p className="text-xl font-bold text-white mt-0.5">{toxicity.totalAnalyzed}</p>
                </div>
                <div className="p-3.5 rounded-xl bg-[#182229] border border-[#222e35]">
                  <span className="text-[10px] text-rose-300 uppercase font-semibold">Flagged Toxic</span>
                  <p className="text-xl font-bold text-rose-400 mt-0.5">{toxicity.totalDetected}</p>
                </div>
                <div className="p-3.5 rounded-xl bg-[#182229] border border-[#222e35]">
                  <span className="text-[10px] text-amber-300 uppercase font-semibold">High Severity</span>
                  <p className="text-xl font-bold text-amber-400 mt-0.5">{toxicity.severityBreakdown?.high || 0}</p>
                </div>
                <div className="p-3.5 rounded-xl bg-[#182229] border border-[#222e35]">
                  <span className="text-[10px] text-emerald-300 uppercase font-semibold">False Positives</span>
                  <p className="text-xl font-bold text-emerald-400 mt-0.5">{toxicity.falsePositiveCount || 0}</p>
                </div>
              </div>

              {/* Severity & Categories Distribution */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                {/* Severity Breakdown */}
                <div className="p-4 rounded-xl bg-[#182229]/80 border border-[#222e35] space-y-3">
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                    <IoWarningOutline className="h-4 w-4 text-amber-400" />
                    Severity Distribution
                  </h3>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-rose-400 font-medium flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-rose-500" /> High Severity
                      </span>
                      <span className="font-bold text-white">{toxicity.severityBreakdown?.high || 0}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-amber-400 font-medium flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-amber-500" /> Medium Severity
                      </span>
                      <span className="font-bold text-white">{toxicity.severityBreakdown?.medium || 0}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-yellow-400 font-medium flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-yellow-500" /> Low Severity
                      </span>
                      <span className="font-bold text-white">{toxicity.severityBreakdown?.low || 0}</span>
                    </div>
                  </div>
                </div>

                {/* Categories Breakdown */}
                <div className="p-4 rounded-xl bg-[#182229]/80 border border-[#222e35] space-y-3">
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                    <IoFlameOutline className="h-4 w-4 text-rose-400" />
                    Detected Categories
                  </h3>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {toxicity.categoriesBreakdown?.map((cat, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-[#111b21] border border-[#222e35]">
                        <span className="text-[11px] text-[#cfd9df] truncate pr-1">{cat.name}</span>
                        <span className="font-bold text-white text-[11px] px-1.5 py-0.5 rounded bg-white/5">{cat.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Daily Activity Chart Panel */}
            <div className="p-5 md:p-6 rounded-2xl glass-card border border-chatBorder flex flex-col space-y-4">
              <div>
                <h2 className="text-lg font-bold text-white">Daily Traffic & Safety Trends</h2>
                <p className="text-xs text-chatMuted">Platform utilization and toxic detection trends for the past 10 days</p>
              </div>

              {stats?.dailyActivity && stats.dailyActivity.length > 0 ? (
                <div className="h-80 w-full bg-chatBg/30 p-2 border border-chatBorder/50 rounded-xl">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={stats.dailyActivity}
                      margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="colorMessages" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="colorAi" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#a855f7" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="colorToxic" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="#222e35" strokeDasharray="3 3" />
                      <XAxis dataKey="date" stroke="#8696a0" style={{ fontSize: '10px' }} />
                      <YAxis stroke="#8696a0" style={{ fontSize: '10px' }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#111b21',
                          borderColor: '#222e35',
                          borderRadius: '8px',
                          color: '#e9edef',
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="messages"
                        name="Total Messages"
                        stroke="#10b981"
                        fillOpacity={1}
                        fill="url(#colorMessages)"
                      />
                      <Area
                        type="monotone"
                        dataKey="aiQueries"
                        name="AI Interactions"
                        stroke="#a855f7"
                        fillOpacity={1}
                        fill="url(#colorAi)"
                      />
                      <Area
                        type="monotone"
                        dataKey="toxicDetected"
                        name="Toxic Messages Flagged"
                        stroke="#f43f5e"
                        fillOpacity={1}
                        fill="url(#colorToxic)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-64 flex items-center justify-center border border-dashed border-chatBorder rounded-xl text-chatMuted text-sm">
                  Active stats stream is currently empty. Start chatting to feed data!
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
};

export default Analytics;
