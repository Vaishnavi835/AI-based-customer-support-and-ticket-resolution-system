import { useState, useEffect, useCallback } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  BarChart, Bar
} from 'recharts';
import { ticketsAPI } from '../api/services';
import { RefreshCw, TrendingUp, Activity } from 'lucide-react';

export default function Reports() {
  const [data, setData] = useState(null);
  const [workload, setWorkload] = useState([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  const loadData = useCallback(() => {
    ticketsAPI.analytics(days).then(res => {
      setData(res.data);
    }).catch(err => console.error(err));
    
    ticketsAPI.workload().then(res => {
      const processedWorkload = res.data.map(agent => ({
        name: agent.agent_name || agent.email.split('@')[0],
        Open: agent.open_tickets,
        Total: agent.total_tickets
      }));
      setWorkload(processedWorkload);
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
          <h1 className="text-dashboard-title" style={{ margin: 0, fontSize: '26px', fontWeight: '800', letterSpacing: '-0.5px' }}>Reports</h1>
          <p style={{ margin: '4px 0 0 0', fontSize: '14.5px', color: '#64748B' }}>
            Deep dive into ticket volume trends and agent workload.
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
        <>
          {/* ── Trend Chart ──────────────────────────────── */}
          <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid #E4E7EC', padding: '24px', boxShadow: '0 1px 3px rgba(15,23,42,0.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
              <TrendingUp size={20} color="#6C63FF" />
              <h3 style={{ fontSize: '16px', fontWeight: '700', margin: 0, color: '#0F172A' }}>Ticket Volume Trend</h3>
            </div>
            
            <div style={{ width: '100%', height: 350 }}>
              <ResponsiveContainer>
                <LineChart data={data?.trend || []} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                  <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#6B7280' }} tickMargin={10} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: '#6B7280' }} axisLine={false} tickLine={false} />
                  <RechartsTooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}
                    itemStyle={{ fontWeight: 600 }}
                  />
                  <Legend wrapperStyle={{ paddingTop: '20px' }} iconType="circle" />
                  <Line type="monotone" dataKey="opened" name="Tickets Opened" stroke="#6C63FF" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                  <Line type="monotone" dataKey="resolved" name="Tickets Resolved" stroke="#10B981" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px', marginTop: '24px' }}>
            {/* ── Agent Workload ──────────────────────────────── */}
            <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid #E4E7EC', padding: '24px', boxShadow: '0 1px 3px rgba(15,23,42,0.06)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <Activity size={20} color="#EF4444" />
                <h3 style={{ fontSize: '16px', fontWeight: '700', margin: 0, color: '#0F172A' }}>Agent Workload (Open Tickets)</h3>
              </div>
              
              <div style={{ width: '100%', height: 400 }}>
                {workload.length > 0 ? (
                  <ResponsiveContainer>
                    <BarChart data={workload} margin={{ top: 20, right: 30, left: 0, bottom: 5 }} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#E5E7EB" />
                      <XAxis type="number" tick={{ fontSize: 12, fill: '#6B7280' }} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: '#374151', fontWeight: 600 }} axisLine={false} tickLine={false} width={100} />
                      <RechartsTooltip 
                        cursor={{ fill: '#F3F4F6' }}
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} 
                      />
                      <Bar dataKey="Open" fill="#6C63FF" radius={[0, 4, 4, 0]} barSize={24} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: '#9CA3AF' }}>No data available</div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Global spin animation class */}
      <style>{`
        .spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
