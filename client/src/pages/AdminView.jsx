import React, { useEffect, useState } from 'react';
import { UserCheck, PhoneCall, XCircle } from 'lucide-react';

export default function AdminView() {
  const [queues, setQueues] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Date picker state (default to today)
  const d = new Date();
  const todayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const [selectedDate, setSelectedDate] = useState(todayStr);

  const fetchQueues = async (date) => {
    try {
      const res = await fetch(`/api/admin/queue?date=${date}`);
      const data = await res.json();
      setQueues(data);
      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueues(selectedDate);
    const interval = setInterval(() => fetchQueues(selectedDate), 10000); // Poll every 10s
    return () => clearInterval(interval);
  }, [selectedDate]);

  const handleAction = async (id, action) => {
    try {
      await fetch(`/api/admin/queue/${id}/${action}`, { method: 'POST' });
      fetchQueues(selectedDate);
    } catch (err) {
      console.error(err);
    }
  };

  const activeQueues = queues.filter(q => q.status === 'WAITING' || q.status === 'CALLED');
  const historyQueues = queues.filter(q => q.status === 'COMPLETED' || q.status === 'CANCELED');

  return (
    <div className="admin-container">
      <header className="admin-header">
        <h1>順番待ち管理パネル</h1>
        <div className="date-picker-container" style={{ margin: '10px 0' }}>
          <input 
            type="date" 
            value={selectedDate} 
            onChange={(e) => setSelectedDate(e.target.value)} 
            className="date-picker"
            style={{ padding: '8px', borderRadius: '8px', border: '1px solid #ccc' }}
          />
        </div>
        <div className="stats">
          <span className="stat-badge">待ち組数: {activeQueues.filter(q => q.status === 'WAITING').length}</span>
          <span className="stat-badge called">呼出中: {activeQueues.filter(q => q.status === 'CALLED').length}</span>
        </div>
      </header>

      {loading ? (
        <div className="spinner-container"><div className="spinner"></div></div>
      ) : (
        <div className="admin-content">
          <section className="queue-section">
            <h2>待機中・呼出中リスト</h2>
            <div className="queue-list">
              {activeQueues.length === 0 ? (
                <p className="empty-state">現在お待ちのお客様はいません。</p>
              ) : (
                activeQueues.map((q) => (
                  <div key={q.id} className={`queue-item ${q.status.toLowerCase()}`}>
                    <div className="queue-info">
                      <span className="q-number">#{q.id}</span>
                      <span className="q-name">{q.displayName || '名無しゲスト'}</span>
                      {q.user && <span className="q-visit-count" style={{fontSize: '0.8rem', backgroundColor: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.3)', padding: '2px 8px', borderRadius: '12px', marginLeft: '10px', fontWeight: '500', letterSpacing: '0.5px'}}>来店: {q.user.visitCount}回目</span>}
                      <span className={`q-status ${q.status.toLowerCase()}`}>
                        {q.status === 'WAITING' ? '待機中' : '呼出中'}
                      </span>
                      <span className="q-time">{new Date(q.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <div className="queue-actions">
                      {q.status === 'WAITING' && (
                        <button className="action-btn call" onClick={() => handleAction(q.id, 'call')} title="呼出">
                          <PhoneCall size={18} />
                          <span>呼出</span>
                        </button>
                      )}
                      <button className="action-btn arrive" onClick={() => handleAction(q.id, 'arrive')} title="案内済">
                        <UserCheck size={18} />
                        <span>案内済</span>
                      </button>
                      <button className="action-btn cancel" onClick={() => handleAction(q.id, 'cancel')} title="キャンセル">
                        <XCircle size={18} />
                        <span>キャンセル</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="queue-section" style={{ marginTop: '40px' }}>
            <h2>対応完了・履歴リスト</h2>
            <div className="queue-list">
              {historyQueues.length === 0 ? (
                <p className="empty-state">履歴はありません。</p>
              ) : (
                historyQueues.map((q) => (
                  <div key={q.id} className={`queue-item history ${q.status.toLowerCase()}`} style={{ opacity: 0.7 }}>
                    <div className="queue-info">
                      <span className="q-number">#{q.id}</span>
                      <span className="q-name">{q.displayName || '名無しゲスト'}</span>
                      {q.user && <span className="q-visit-count" style={{fontSize: '0.8rem', backgroundColor: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.3)', padding: '2px 8px', borderRadius: '12px', marginLeft: '10px', fontWeight: '500', letterSpacing: '0.5px'}}>来店累計: {q.user.visitCount}回</span>}
                      <span className={`q-status ${q.status.toLowerCase()}`}>
                        {q.status === 'COMPLETED' ? '案内済' : 'キャンセル'}
                      </span>
                      <span className="q-time">{new Date(q.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
