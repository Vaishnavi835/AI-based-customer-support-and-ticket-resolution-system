import { useState, useEffect, useCallback } from 'react';
import {
  PieChart, Pie, Cell, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts';
import { ticketsAPI } from '../api/services';
import { RefreshCw, Tag, PieChart as PieChartIcon, Target } from 'lucide-react';

const COLORS = ['#6C63FF', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#3B82F6', '#14B8A6'];

export default function TicketStatistics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  const loadData = useCallback(() => {
    ticketsAPI.analytics(days).then(res => {
      setData(res.data);
    }).catch(err => console.error(err));
  }, [days]);

  useEffect(() => {
    loadData();
    const timer = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(timer);
  }, [loadData]);

  return (
    <div style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* ── Header ──────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 className="text-dashboard-title" style={{ margin: 0, fontSize: '26px', fontWeight: '800', letterSpacing: '-0.5px' }}>Ticket Statistics</h1>
          <p style={{ margin: '4px 0 0 0', fontSize: '14.5px', color: '#64748B' }}>
            Breakdown of ticket categories, statuses, and priorities.
          </p>
        </div>
        
        <div style={{ display: 'flex', gap: '12px' }}>
          <select 
            value={days} 
            onChange={e => setDays(Number(e.target.value))}
            style={{ padding: '9px 12px', border: '1.5px solid #E4E7EC', borderRadius: '10px', background: '#fff', fontSize: '13px', fontWeight: '600', color: '#374151', outline: 'none', cursor: 'pointer' }}
          >
            <option value={7}>Last 7 Days</option>
            <option value={30}>Last 30 Days</option>
            <option value={90}>Last 90 Days</option>
          </select>
          <button onClick={() => { setLoading(true); loadData(); setTimeout(() => setLoading(false), 500); }} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 16px', border: '1.5px solid #E4E7EC', borderRadius: '10px', background: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: '600', color: '#374151', transition: 'border-color 0.15s' }}>
            <RefreshCw size={14} className={loading ? "spin" : ""} /> Refresh
          </button>
        </div>
      </div>

      {loading && !data ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '100px', color: '#6C63FF' }}>
          <RefreshCw size={32} className="spin" />
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          
          {/* ── Category Breakdown ──────────────────────────────── */}
          <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid #E4E7EC', padding: '24px', boxShadow: '0 1px 3px rgba(15,23,42,0.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <PieChartIcon size={20} color="#F59E0B" />
              <h3 style={{ fontSize: '16px', fontWeight: '700', margin: 0, color: '#0F172A' }}>Category Distribution</h3>
            </div>
            
            <div style={{ width: '100%', height: 300 }}>
              {data?.categories?.length > 0 ? (
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={data.categories} cx="50%" cy="50%" innerRadius={70} outerRadius={100} paddingAngle={5} dataKey="value">
                      {data.categories.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                    </Pie>
                    <RechartsTooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} itemStyle={{ color: '#0F172A', fontWeight: 600 }} />
                    <Legend iconType="circle" />
                  </PieChart>
                </ResponsiveContainer>
              ) : <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: '#9CA3AF' }}>No data</div>}
            </div>
          </div>

          {/* ── Status Breakdown ──────────────────────────────── */}
          <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid #E4E7EC', padding: '24px', boxShadow: '0 1px 3px rgba(15,23,42,0.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <Tag size={20} color="#6C63FF" />
              <h3 style={{ fontSize: '16px', fontWeight: '700', margin: 0, color: '#0F172A' }}>Status Breakdown</h3>
            </div>
            
            <div style={{ width: '100%', height: 300 }}>
              {data?.statuses?.length > 0 ? (
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={data.statuses} cx="50%" cy="50%" innerRadius={70} outerRadius={100} paddingAngle={5} dataKey="value">
                      {data.statuses.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[(index + 2) % COLORS.length]} />)}
                    </Pie>
                    <RechartsTooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} itemStyle={{ color: '#0F172A', fontWeight: 600 }} />
                    <Legend iconType="circle" />
                  </PieChart>
                </ResponsiveContainer>
              ) : <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: '#9CA3AF' }}>No data</div>}
            </div>
          </div>

          {/* ── Priority Breakdown ──────────────────────────────── */}
          <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid #E4E7EC', padding: '24px', boxShadow: '0 1px 3px rgba(15,23,42,0.06)', gridColumn: '1 / -1' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <Target size={20} color="#EF4444" />
              <h3 style={{ fontSize: '16px', fontWeight: '700', margin: 0, color: '#0F172A' }}>Priority Distribution</h3>
            </div>
            
            <div style={{ width: '100%', height: 300 }}>
              {data?.priorities?.length > 0 ? (
                <ResponsiveContainer>
                  <BarChart data={data.priorities} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                    <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#6B7280' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 12, fill: '#6B7280' }} axisLine={false} tickLine={false} />
                    <RechartsTooltip cursor={{ fill: '#F3F4F6' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                    <Bar dataKey="value" fill="#3B82F6" radius={[4, 4, 0, 0]} barSize={40}>
                      {data.priorities.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: '#9CA3AF' }}>No data</div>}
            </div>
          </div>

        </div>
      )}

      {/* Global spin animation class */}
      <style>{`
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
