import React, { useEffect, useState } from 'react';
import { UserCheck, PhoneCall, XCircle } from 'lucide-react';

export default function AdminView() {
  const [queues, setQueues] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchQueues = async () => {
    try {
      const res = await fetch('/api/admin/queue');
      const data = await res.json();
      setQueues(data);
      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueues();
    const interval = setInterval(fetchQueues, 10000); // Poll every 10s
    return () => clearInterval(interval);
  }, []);

  const handleAction = async (id, action) => {
    try {
      await fetch(`/api/admin/queue/${id}/${action}`, { method: 'POST' });
      fetchQueues();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="admin-container">
      <header className="admin-header">
        <h1>順番待ち管理パネル</h1>
        <div className="stats">
          <span className="stat-badge">待ち組数: {queues.filter(q => q.status === 'WAITING').length}</span>
          <span className="stat-badge called">呼出中: {queues.filter(q => q.status === 'CALLED').length}</span>
        </div>
      </header>

      {loading ? (
        <div className="spinner-container"><div className="spinner"></div></div>
      ) : (
        <div className="queue-list">
          {queues.length === 0 ? (
            <p className="empty-state">現在お待ちのお客様はいません。</p>
          ) : (
            queues.map((q) => (
              <div key={q.id} className={`queue-item ${q.status.toLowerCase()}`}>
                <div className="queue-info">
                  <span className="q-number">#{q.id}</span>
                  <span className="q-name">{q.displayName || '名無しゲスト'}</span>
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
      )}
    </div>
  );
}
