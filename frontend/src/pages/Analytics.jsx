import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../services/api';
import {
  IoChevronBack,
  IoPeopleOutline,
  IoChatbubbleEllipsesOutline,
  IoShieldOutline,
  IoHardwareChipOutline,
  IoWarningOutline,
  IoFlameOutline,
  IoRefreshOutline,
  IoTimeOutline,
  IoGlobeOutline,
  IoDocumentTextOutline,
  IoSparklesOutline,
  IoAlertCircleOutline,
} from 'react-icons/io5';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import Toast from '../components/Toast';

const AI_FEATURE_COLORS = {
  Translation: '#38bdf8',
  Summarization: '#a855f7',
  'Smart Reply': '#10b981',
  'Toxicity Detection': '#f43f5e',
};

const CATEGORY_ICONS = {
  'Abusive Language': <IoAlertCircleOutline className="h-4 w-4 text-rose-400" />,
  'Threats / Violence': <IoFlameOutline className="h-4 w-4 text-red-500" />,
  'Hate Speech': <IoWarningOutline className="h-4 w-4 text-amber-400" />,
  'Harassment & Bullying': <IoShieldOutline className="h-4 w-4 text-orange-400" />,
  'Sexual Harassment': <IoAlertCircleOutline className="h-4 w-4 text-pink-400" />,
  Insults: <IoAlertCircleOutline className="h-4 w-4 text-yellow-400" />,
};

const Analytics = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    try {
      const { data } = await API.get('/analytics');
      setStats(data.data);
      if (isManualRefresh) {
        setToast({ message: 'Analytics data refreshed successfully', type: 'success' });
      }
    } catch (err) {
      console.error('Fetch stats error:', err);
      setToast({
        message: 'Failed to fetch analytics metrics: ' + (err.response?.data?.message || err.message),
        type: 'error',
      });
    } finally {
      setLoading(false);
      if (isManualRefresh) setRefreshing(false);
    }
  };

  const statCards = [
    {
      title: 'Total Users',
      value: stats?.totalUsers || 0,
      subtitle: 'Registered accounts',
      icon: <IoPeopleOutline className="h-5 w-5 text-blue-400" />,
      accent: 'border-blue-500/20 from-blue-500/10 to-transparent',
    },
    {
      title: 'Total Messages',
      value: stats?.totalMessages || 0,
      subtitle: 'Platform exchange',
      icon: <IoChatbubbleEllipsesOutline className="h-5 w-5 text-emerald-400" />,
      accent: 'border-emerald-500/20 from-emerald-500/10 to-transparent',
    },
    {
      title: 'AI Requests',
      value: stats?.totalAiMessages || 0,
      subtitle: 'Assistant queries & replies',
      icon: <IoHardwareChipOutline className="h-5 w-5 text-purple-400" />,
      accent: 'border-purple-500/20 from-purple-500/10 to-transparent',
    },
    {
      title: 'Toxic Messages Flagged',
      value: stats?.toxicityStats?.totalDetected || stats?.toxicMessagesBlocked || 0,
      subtitle: 'Safety alerts triggered',
      icon: <IoShieldOutline className="h-5 w-5 text-rose-400" />,
      accent: 'border-rose-500/20 from-rose-500/10 to-transparent',
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

  const aiFeatures = stats?.aiFeatureUsage || [];
  const topEngagement = stats?.topChatEngagement || [];

  return (
    <div className="flex flex-col min-h-screen w-full bg-[#111b21] text-[#e9edef] font-sans p-4 md:p-6 overflow-y-auto">
      <div className="max-w-6xl mx-auto w-full space-y-5 pb-10">
        
        {/* Navigation & Header */}
        <div className="flex items-center justify-between border-b border-[#222e35] pb-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/')}
              aria-label="Back to chat"
              className="p-2 hover:bg-[#202c33] text-[#8696a0] hover:text-[#e9edef] rounded-full transition-colors"
            >
              <IoChevronBack className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
                Platform Analytics & AI Safety
              </h1>
              <p className="text-xs text-[#8696a0]">
                Real-time usage metrics, AI feature adoption, and safety telemetry
              </p>
            </div>
          </div>

          <button
            onClick={() => fetchStats(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#202c33] hover:bg-[#2a3942] border border-[#222e35] text-xs font-medium text-[#cfd9df] transition-all disabled:opacity-50"
          >
            <IoRefreshOutline className={`h-4 w-4 ${refreshing ? 'animate-spin text-emerald-400' : ''}`} />
            <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </div>

        {loading ? (
          <div className="h-96 flex flex-col items-center justify-center gap-3">
            <div className="animate-spin rounded-full h-10 w-10 border-2 border-emerald-500 border-t-transparent"></div>
            <p className="text-xs text-[#8696a0]">Loading real-time platform telemetry...</p>
          </div>
        ) : (
          <>
            {/* ROW 1: TOP 4 STATISTIC CARDS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              {statCards.map((card, i) => (
                <div
                  key={i}
                  className={`p-4 rounded-xl border bg-gradient-to-br ${card.accent} bg-[#182229] flex items-center justify-between transition-all hover:border-[#374248]`}
                >
                  <div className="space-y-1">
                    <h3 className="text-[11px] font-semibold text-[#8696a0] uppercase tracking-wider">
                      {card.title}
                    </h3>
                    <p className="text-2xl font-extrabold text-white tracking-tight leading-none">
                      {card.value}
                    </p>
                    <p className="text-[10px] text-[#8696a0]">{card.subtitle}</p>
                  </div>
                  <div className="p-2.5 bg-[#111b21] rounded-lg border border-[#222e35] shadow-inner">
                    {card.icon}
                  </div>
                </div>
              ))}
            </div>

            {/* ROW 2: DAILY MESSAGE ACTIVITY (Clean Line/Area Chart) */}
            <div className="p-5 rounded-xl border border-[#222e35] bg-[#182229] space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-white tracking-wide">
                    Daily Message Activity
                  </h2>
                  <p className="text-[11px] text-[#8696a0]">
                    Message volume trends across the platform over time
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Live Activity
                  </span>
                </div>
              </div>

              {stats?.dailyActivity && stats.dailyActivity.length > 0 ? (
                <div className="h-56 w-full pt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={stats.dailyActivity}
                      margin={{ top: 10, right: 10, left: -25, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="activityColor" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="#222e35" strokeDasharray="3 3" vertical={false} />
                      <XAxis
                        dataKey="date"
                        stroke="#8696a0"
                        tickLine={false}
                        axisLine={{ stroke: '#222e35' }}
                        style={{ fontSize: '11px' }}
                      />
                      <YAxis
                        stroke="#8696a0"
                        tickLine={false}
                        axisLine={{ stroke: '#222e35' }}
                        style={{ fontSize: '11px' }}
                        allowDecimals={false}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#111b21',
                          borderColor: '#222e35',
                          borderRadius: '8px',
                          color: '#e9edef',
                          fontSize: '12px',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                        }}
                        labelStyle={{ color: '#8696a0', marginBottom: '4px' }}
                        formatter={(val) => [`${val} messages`, 'Volume']}
                      />
                      <Area
                        type="monotone"
                        dataKey="messages"
                        stroke="#10b981"
                        strokeWidth={2.5}
                        fillOpacity={1}
                        fill="url(#activityColor)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-44 flex items-center justify-center border border-dashed border-[#222e35] rounded-lg text-[#8696a0] text-xs">
                  No activity records logged yet.
                </div>
              )}
            </div>

            {/* ROW 3: AI FEATURE USAGE & TOXICITY SUMMARY */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              
              {/* Card 1: AI Feature Usage (Donut Chart & Legend) */}
              <div className="p-5 rounded-xl border border-[#222e35] bg-[#182229] flex flex-col justify-between space-y-4">
                <div>
                  <h2 className="text-sm font-bold text-white tracking-wide">
                    AI Feature Usage
                  </h2>
                  <p className="text-[11px] text-[#8696a0]">
                    Distribution of AI capabilities utilized across chats
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-4 py-1">
                  {/* Donut Chart */}
                  <div className="h-40 w-40 relative flex items-center justify-center flex-shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={aiFeatures}
                          dataKey="count"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={45}
                          outerRadius={68}
                          paddingAngle={3}
                          stroke="#182229"
                          strokeWidth={2}
                        >
                          {aiFeatures.map((entry, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={AI_FEATURE_COLORS[entry.name] || '#64748b'}
                            />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#111b21',
                            borderColor: '#222e35',
                            borderRadius: '8px',
                            color: '#e9edef',
                            fontSize: '11px',
                          }}
                          formatter={(value, name) => [`${value} calls`, name]}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-xs font-semibold text-[#8696a0]">Total</span>
                      <span className="text-sm font-bold text-white">
                        {aiFeatures.reduce((acc, f) => acc + (f.count || 0), 0)}
                      </span>
                    </div>
                  </div>

                  {/* Compact Legend & Percentages */}
                  <div className="grid grid-cols-2 sm:grid-cols-1 gap-2 w-full max-w-xs text-xs">
                    {aiFeatures.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-2 rounded-lg bg-[#111b21] border border-[#222e35]/80"
                      >
                        <div className="flex items-center gap-2 truncate pr-1">
                          <span
                            className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: AI_FEATURE_COLORS[item.name] || '#64748b' }}
                          />
                          <span className="text-[11px] text-[#cfd9df] truncate">{item.name}</span>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <span className="text-[11px] font-bold text-white">{item.count}</span>
                          <span className="text-[10px] text-[#8696a0] font-mono">({item.percentage}%)</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Card 2: Toxicity Summary */}
              <div className="p-5 rounded-xl border border-rose-500/20 bg-gradient-to-b from-rose-950/10 to-[#182229] flex flex-col justify-between space-y-4">
                <div className="flex items-center justify-between border-b border-[#222e35] pb-3">
                  <div>
                    <h2 className="text-sm font-bold text-white tracking-wide flex items-center gap-2">
                      <IoShieldOutline className="h-4 w-4 text-rose-400" />
                      Toxicity Summary
                    </h2>
                    <p className="text-[11px] text-[#8696a0]">
                      Safety moderation telemetry and severity distribution
                    </p>
                  </div>
                  <span className="px-2.5 py-1 rounded-md bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-semibold">
                    Rate: {toxicity.detectionRate}
                  </span>
                </div>

                {/* Top Banner: Total Flagged & Total Analyzed */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-[#111b21] border border-[#222e35]">
                  <div>
                    <span className="text-[10px] text-[#8696a0] uppercase font-semibold">Total Flagged Messages</span>
                    <p className="text-2xl font-extrabold text-rose-400 leading-none mt-1">
                      {toxicity.totalDetected}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-[#8696a0] uppercase font-semibold">Messages Analyzed</span>
                    <p className="text-lg font-bold text-white leading-none mt-1">
                      {toxicity.totalAnalyzed}
                    </p>
                  </div>
                </div>

                {/* 3 Severity Cards */}
                <div className="grid grid-cols-3 gap-2.5">
                  {/* High */}
                  <div className="p-3 rounded-lg bg-[#111b21] border border-red-500/30 text-center space-y-0.5">
                    <span className="text-[10px] font-semibold text-red-400 uppercase tracking-wide">High</span>
                    <p className="text-xl font-bold text-red-400">
                      {toxicity.severityBreakdown?.high || 0}
                    </p>
                    <span className="text-[9px] text-[#8696a0] block">Severe Threats</span>
                  </div>

                  {/* Medium */}
                  <div className="p-3 rounded-lg bg-[#111b21] border border-orange-500/30 text-center space-y-0.5">
                    <span className="text-[10px] font-semibold text-orange-400 uppercase tracking-wide">Medium</span>
                    <p className="text-xl font-bold text-orange-400">
                      {toxicity.severityBreakdown?.medium || 0}
                    </p>
                    <span className="text-[9px] text-[#8696a0] block">Abusive/Harass</span>
                  </div>

                  {/* Low */}
                  <div className="p-3 rounded-lg bg-[#111b21] border border-yellow-500/30 text-center space-y-0.5">
                    <span className="text-[10px] font-semibold text-yellow-400 uppercase tracking-wide">Low</span>
                    <p className="text-xl font-bold text-yellow-400">
                      {toxicity.severityBreakdown?.low || 0}
                    </p>
                    <span className="text-[9px] text-[#8696a0] block">Mild Insults</span>
                  </div>
                </div>
              </div>
            </div>

            {/* ROW 4: DETECTED CATEGORIES & TOP CHAT ENGAGEMENT */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              
              {/* Card 1: Detected Categories (All 6 canonical categories in compact 2-column grid) */}
              <div className="p-5 rounded-xl border border-[#222e35] bg-[#182229] space-y-3">
                <div>
                  <h2 className="text-sm font-bold text-white tracking-wide flex items-center gap-2">
                    <IoFlameOutline className="h-4 w-4 text-rose-400" />
                    Detected Categories
                  </h2>
                  <p className="text-[11px] text-[#8696a0]">
                    Classification counts across all 6 safety categories
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
                  {toxicity.categoriesBreakdown?.map((cat, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2.5 rounded-lg bg-[#111b21] border border-[#222e35] hover:border-[#374248] transition-colors"
                    >
                      <div className="flex items-center gap-2 truncate pr-1">
                        {CATEGORY_ICONS[cat.name] || <IoAlertCircleOutline className="h-4 w-4 text-[#8696a0]" />}
                        <span className="text-[11px] text-[#cfd9df] truncate font-medium">
                          {cat.name}
                        </span>
                      </div>
                      <span className="font-bold text-white text-[11px] px-2 py-0.5 rounded bg-white/5 font-mono border border-white/5">
                        {cat.count}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Card 2: Top Chat Engagement (Rank, Avatar, Name, Session Duration, Messages) */}
              <div className="p-5 rounded-xl border border-[#222e35] bg-[#182229] space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-bold text-white tracking-wide flex items-center gap-2">
                      <IoTimeOutline className="h-4 w-4 text-emerald-400" />
                      Top Chat Engagement
                    </h2>
                    <p className="text-[11px] text-[#8696a0]">
                      Active session durations (5-min inactivity timeout)
                    </p>
                  </div>
                  <span className="text-[10px] text-[#8696a0] font-mono">Ranked by msgs</span>
                </div>

                <div className="space-y-2 pt-1">
                  {topEngagement.length > 0 ? (
                    topEngagement.map((item) => (
                      <div
                        key={item.rank}
                        className="flex items-center justify-between p-2.5 rounded-lg bg-[#111b21] border border-[#222e35] hover:border-[#374248] transition-colors text-xs"
                      >
                        {/* Rank & Contact Info */}
                        <div className="flex items-center gap-2.5 truncate">
                          <span
                            className={`h-5 w-5 rounded-full flex items-center justify-center font-bold text-[10px] flex-shrink-0 ${
                              item.rank === 1
                                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                : item.rank === 2
                                ? 'bg-slate-300/20 text-slate-300 border border-slate-300/30'
                                : item.rank === 3
                                ? 'bg-amber-700/20 text-amber-600 border border-amber-700/30'
                                : 'bg-[#202c33] text-[#8696a0]'
                            }`}
                          >
                            #{item.rank}
                          </span>

                          <img
                            src={
                              item.contact?.avatar ||
                              `https://api.dicebear.com/7.x/bottts/svg?seed=${item.contact?.username || 'User'}`
                            }
                            alt={item.contact?.username}
                            className="h-7 w-7 rounded-full object-cover border border-[#222e35] flex-shrink-0 bg-[#202c33]"
                          />

                          <div className="truncate">
                            <span className="font-semibold text-white text-[12px] truncate block">
                              {item.contact?.username || 'Unknown'}
                            </span>
                          </div>

                          {item.contact?.isAi && (
                            <span className="px-1.5 py-0.2 rounded bg-purple-500/20 border border-purple-500/30 text-purple-300 text-[9px] font-semibold flex-shrink-0">
                              AI Bot
                            </span>
                          )}
                        </div>

                        {/* Engagement Metrics */}
                        <div className="flex items-center gap-3 flex-shrink-0">
                          <div className="text-right">
                            <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1 justify-end">
                              <IoTimeOutline className="h-3.5 w-3.5" />
                              {item.estimatedChatTime}
                            </span>
                            <span className="text-[9px] text-[#8696a0] block">session time</span>
                          </div>

                          <div className="text-right min-w-[55px]">
                            <span className="text-[11px] font-bold text-white px-2 py-0.5 rounded bg-white/5 border border-white/5">
                              {item.messagesExchanged} msgs
                            </span>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="h-36 flex flex-col items-center justify-center border border-dashed border-[#222e35] rounded-lg text-[#8696a0] text-xs gap-1">
                      <span>No active chat conversations found.</span>
                      <span className="text-[10px]">Start messaging to see top engagement metrics!</span>
                    </div>
                  )}
                </div>
              </div>
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
