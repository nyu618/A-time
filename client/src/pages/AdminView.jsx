import React, { useEffect, useState } from 'react';
import { UserCheck, PhoneCall, XCircle, Undo2, BellRing } from 'lucide-react';

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

  const actionMessages = {
    approve: '本当に整理券発行承認しますか？',
    reject: '本当に拒否しますか？',
    call: '本当に来店呼出しますか？',
    instore: '本当にステータスを「店内待機」に変更しますか？',
    assess: '本当に査定受付呼出をしますか？',
    'assess-done': '本当に査定完了にしますか？',
    complete: '本当に対応完了にしますか？',
    cancel: '本当にキャンセルしますか？',
    rollback: '本当に一つ前の状態に戻しますか？',
    'post-assess-call': '本当に査定完了呼出にしますか？'
  };

  const handleAction = async (id, action) => {
    const message = actionMessages[action] || "本当にこの処理を実行しますか？";
    if (!window.confirm(message)) return;
    try {
      await fetch(`/api/admin/queue/${id}/${action}`, { method: 'POST' });
      fetchQueues(selectedDate);
    } catch (err) {
      console.error(err);
    }
  };

  const pendingQueues = queues.filter(q => q.status === 'PENDING');
  const activeQueues = queues.filter(q => q.status === 'WAITING' || q.status === 'CALLED' || q.status === 'IN_STORE' || q.status === 'ASSESSING' || q.status === 'POST_ASSESS_CALL');
  const historyQueues = queues.filter(q => q.status === 'COMPLETED' || q.status === 'CANCELED');

  const queuesWaiting = queues.filter(q => q.status === 'WAITING');
  const queuesCalled = queues.filter(q => q.status === 'CALLED');
  const queuesInStore = queues.filter(q => q.status === 'IN_STORE');
  const queuesAssessing = queues.filter(q => q.status === 'ASSESSING');
  const queuesPostAssessCall = queues.filter(q => q.status === 'POST_ASSESS_CALL');

  const renderQueueItem = (q) => (
    <div key={q.id} className={`queue-item ${q.status.toLowerCase()}`}>
      <div className="queue-info">
        <span className="q-number">#{q.dailyNumber}</span>
        <span className="q-name">{q.displayName || '名無しゲスト'}</span>
        {q.user && <span className="q-visit-count" style={{fontSize: '0.8rem', backgroundColor: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.3)', padding: '2px 8px', borderRadius: '12px', marginLeft: '10px', fontWeight: '500', letterSpacing: '0.5px'}}>来店: {q.user.visitCount}回目</span>}
        {q.cancelCount > 0 && <span className="q-cancel-count" style={{fontSize: '0.8rem', backgroundColor: 'rgba(249, 115, 22, 0.15)', color: '#f97316', border: '1px solid rgba(249, 115, 22, 0.3)', padding: '2px 8px', borderRadius: '12px', marginLeft: '10px', fontWeight: '500'}}>再受付 (キャンセル{q.cancelCount}回)</span>}
        <span className="q-time">{new Date(q.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
      </div>
      <div className="queue-actions">
        {q.status === 'WAITING' && (
          <>
            <button className="action-btn call" onClick={() => handleAction(q.id, 'call')} title="来店呼出">
              <PhoneCall size={18} />
              <span>来店呼出</span>
            </button>
            <button className="action-btn arrive" onClick={() => handleAction(q.id, 'instore')} title="店内待機" style={{backgroundColor: '#0284c7'}}>
              <UserCheck size={18} />
              <span>店内待機</span>
            </button>
            <button className="action-btn cancel" onClick={() => handleAction(q.id, 'cancel')} title="キャンセル">
              <XCircle size={18} />
              <span>キャンセル</span>
            </button>
          </>
        )}
        {q.status === 'CALLED' && (
          <>
            <button className="action-btn arrive" onClick={() => handleAction(q.id, 'instore')} title="店内待機" style={{backgroundColor: '#0284c7'}}>
              <UserCheck size={18} />
              <span>店内待機</span>
            </button>
            <button className="action-btn cancel" onClick={() => handleAction(q.id, 'cancel')} title="キャンセル">
              <XCircle size={18} />
              <span>キャンセル</span>
            </button>
          </>
        )}
        {q.status === 'IN_STORE' && (
          <>
            <button className="action-btn" onClick={() => handleAction(q.id, 'assess')} title="査定受付呼出" style={{backgroundColor: '#ea580c', color: 'white'}}>
              <UserCheck size={18} />
              <span>査定受付呼出</span>
            </button>
            <button className="action-btn cancel" onClick={() => handleAction(q.id, 'cancel')} title="キャンセル">
              <XCircle size={18} />
              <span>キャンセル</span>
            </button>
          </>
        )}
        {q.status === 'ASSESSING' && (
          <button className="action-btn call" onClick={() => handleAction(q.id, 'post-assess-call')} title="査定完了呼出" style={{backgroundColor: '#db2777', color: 'white'}}>
            <BellRing size={18} />
            <span>査定完了呼出</span>
          </button>
        )}
        {q.status === 'POST_ASSESS_CALL' && (
          <>
            <button className="action-btn arrive" onClick={() => handleAction(q.id, 'complete')} title="査定結果案内完了" style={{backgroundColor: '#a855f7', color: 'white'}}>
              <UserCheck size={18} />
              <span>査定結果案内完了</span>
            </button>
            <button className="action-btn cancel" onClick={() => handleAction(q.id, 'cancel')} title="キャンセル">
              <XCircle size={18} />
              <span>キャンセル</span>
            </button>
          </>
        )}
        <button className="action-btn" onClick={() => handleAction(q.id, 'rollback')} title="戻る" style={{backgroundColor: '#9ca3af', color: 'white'}}>
          <Undo2 size={18} />
          <span>戻る</span>
        </button>
      </div>
    </div>
  );

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
        <div className="stats" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <span className="stat-badge" style={{backgroundColor: '#fef08a', color: '#854d0e'}}>承認待: {pendingQueues.length}</span>
          <span className="stat-badge">整理券発行済: {activeQueues.filter(q => q.status === 'WAITING').length}</span>
          <span className="stat-badge called">受付後呼出中: {activeQueues.filter(q => q.status === 'CALLED').length}</span>
          <span className="stat-badge" style={{backgroundColor: '#bae6fd', color: '#0369a1'}}>呼出後店内待機: {activeQueues.filter(q => q.status === 'IN_STORE').length}</span>
          <span className="stat-badge" style={{backgroundColor: '#fed7aa', color: '#c2410c'}}>査定受付呼出: {activeQueues.filter(q => q.status === 'ASSESSING').length}</span>
          <span className="stat-badge" style={{backgroundColor: '#fbcfe8', color: '#be185d'}}>査定完了後呼出中: {activeQueues.filter(q => q.status === 'POST_ASSESS_CALL').length}</span>
        </div>
      </header>

      {loading ? (
        <div className="spinner-container"><div className="spinner"></div></div>
      ) : (
        <div className="admin-content">
          <section className="queue-section" style={{ marginBottom: '40px' }}>
            <h2>承認待ちリスト</h2>
            <div className="queue-list">
              {pendingQueues.length === 0 ? (
                <p className="empty-state">現在承認待ちのお客様はいません。</p>
              ) : (
                pendingQueues.map((q) => (
                  <div key={q.id} className="queue-item pending" style={{ borderLeftColor: '#eab308' }}>
                    <div className="queue-info">
                      <span className="q-number">#{q.dailyNumber}</span>
                      <span className="q-name">{q.displayName || '名無しゲスト'}</span>
                      {q.user && <span className="q-visit-count" style={{fontSize: '0.8rem', backgroundColor: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.3)', padding: '2px 8px', borderRadius: '12px', marginLeft: '10px', fontWeight: '500', letterSpacing: '0.5px'}}>来店: {q.user.visitCount}回目</span>}
                      <span className="q-status pending" style={{color: '#ca8a04', fontWeight: 'bold'}}>
                        承認待ち
                      </span>
                      <span className="q-time">{new Date(q.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <div className="queue-actions">
                      <button className="action-btn" onClick={() => handleAction(q.id, 'approve')} title="整理券発行承認" style={{backgroundColor: '#10b981', color: 'white'}}>
                        <UserCheck size={18} />
                        <span>整理券発行承認</span>
                      </button>
                      <button className="action-btn cancel" onClick={() => handleAction(q.id, 'reject')} title="拒否">
                        <XCircle size={18} />
                        <span>拒否</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
          
          <section className="queue-section" style={{ marginTop: '40px' }}>
            <h2>進行中のお客様</h2>

            <div className="status-block" style={{ borderLeft: '4px solid #10b981', paddingLeft: '10px', marginBottom: '20px', backgroundColor: '#f0fdf4', padding: '15px', borderRadius: '8px' }}>
              <h3 style={{ marginTop: 0, color: '#047857', borderBottom: '1px solid #a7f3d0', paddingBottom: '8px' }}>整理券発行済 ({queuesWaiting.length}名)</h3>
              <div className="queue-list" style={{ marginTop: '10px' }}>
                {queuesWaiting.length === 0 ? <p className="empty-state" style={{margin:0, padding:'10px'}}>現在このステータスのお客様はいません。</p> : queuesWaiting.map(renderQueueItem)}
              </div>
            </div>

            <div className="status-block" style={{ borderLeft: '4px solid #f59e0b', paddingLeft: '10px', marginBottom: '20px', backgroundColor: '#fffbeb', padding: '15px', borderRadius: '8px' }}>
              <h3 style={{ marginTop: 0, color: '#b45309', borderBottom: '1px solid #fde68a', paddingBottom: '8px' }}>受付後呼出中 ({queuesCalled.length}名)</h3>
              <div className="queue-list" style={{ marginTop: '10px' }}>
                {queuesCalled.length === 0 ? <p className="empty-state" style={{margin:0, padding:'10px'}}>現在このステータスのお客様はいません。</p> : queuesCalled.map(renderQueueItem)}
              </div>
            </div>

            <div className="status-block" style={{ borderLeft: '4px solid #0284c7', paddingLeft: '10px', marginBottom: '20px', backgroundColor: '#f0f9ff', padding: '15px', borderRadius: '8px' }}>
              <h3 style={{ marginTop: 0, color: '#0369a1', borderBottom: '1px solid #bae6fd', paddingBottom: '8px' }}>呼出後店内待機 ({queuesInStore.length}名)</h3>
              <div className="queue-list" style={{ marginTop: '10px' }}>
                {queuesInStore.length === 0 ? <p className="empty-state" style={{margin:0, padding:'10px'}}>現在このステータスのお客様はいません。</p> : queuesInStore.map(renderQueueItem)}
              </div>
            </div>

            <div className="status-block" style={{ borderLeft: '4px solid #ea580c', paddingLeft: '10px', marginBottom: '20px', backgroundColor: '#fff7ed', padding: '15px', borderRadius: '8px' }}>
              <h3 style={{ marginTop: 0, color: '#c2410c', borderBottom: '1px solid #fed7aa', paddingBottom: '8px' }}>査定受付呼出 ({queuesAssessing.length}名)</h3>
              <div className="queue-list" style={{ marginTop: '10px' }}>
                {queuesAssessing.length === 0 ? <p className="empty-state" style={{margin:0, padding:'10px'}}>現在このステータスのお客様はいません。</p> : queuesAssessing.map(renderQueueItem)}
              </div>
            </div>

            <div className="status-block" style={{ borderLeft: '4px solid #db2777', paddingLeft: '10px', marginBottom: '20px', backgroundColor: '#fdf2f8', padding: '15px', borderRadius: '8px' }}>
              <h3 style={{ marginTop: 0, color: '#be185d', borderBottom: '1px solid #fbcfe8', paddingBottom: '8px' }}>査定完了後呼出中 ({queuesPostAssessCall.length}名)</h3>
              <div className="queue-list" style={{ marginTop: '10px' }}>
                {queuesPostAssessCall.length === 0 ? <p className="empty-state" style={{margin:0, padding:'10px'}}>現在このステータスのお客様はいません。</p> : queuesPostAssessCall.map(renderQueueItem)}
              </div>
            </div>

          </section>

          <section className="queue-section" style={{ marginTop: '40px' }}>
            <h2>対応完了・履歴リスト</h2>
            <div className="queue-list">
              {historyQueues.length === 0 ? (
                <p className="empty-state">履歴はありません。</p>
              ) : (
                historyQueues.map((q) => (
                  <div key={q.id} className={`queue-item history ${q.status.toLowerCase()}`} style={{ opacity: 0.8, backgroundColor: q.status === 'CANCELED' ? 'rgba(239, 68, 68, 0.25)' : undefined }}>
                    <div className="queue-info">
                      <span className="q-number">#{q.dailyNumber}</span>
                      <span className="q-name">{q.displayName || '名無しゲスト'}</span>
                      {q.user && <span className="q-visit-count" style={{fontSize: '0.8rem', backgroundColor: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.3)', padding: '2px 8px', borderRadius: '12px', marginLeft: '10px', fontWeight: '500', letterSpacing: '0.5px'}}>来店累計: {q.user.visitCount}回</span>}
                      <span className={`q-status ${q.status.toLowerCase()}`} style={{
                        color: q.status === 'COMPLETED' ? '#10b981' : (q.status === 'CANCELED' ? '#ef4444' : undefined),
                        fontWeight: 'bold'
                      }}>
                        {q.status === 'COMPLETED' ? '査定結果案内完了' : 'キャンセル'}
                      </span>
                      <span className="q-time">{new Date(q.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <div className="queue-actions">
                      <button className="action-btn" onClick={() => handleAction(q.id, 'rollback')} title="戻る" style={{backgroundColor: '#9ca3af', color: 'white'}}>
                        <Undo2 size={18} />
                        <span>戻る</span>
                      </button>
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
