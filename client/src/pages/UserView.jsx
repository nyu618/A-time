import React, { useEffect, useState } from 'react';
import liff from '@line/liff';

export default function UserView() {
  const [liffError, setLiffError] = useState(null);
  const [profile, setProfile] = useState(null);
  const [queueStatus, setQueueStatus] = useState(null);
  const [waitCount, setWaitCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initLiff = async () => {
      try {
        const liffId = import.meta.env.VITE_LIFF_ID;
        if (!liffId || liffId === "YOUR_LIFF_ID") {
          console.warn("LIFF ID is not configured. Using mock user.");
          // For testing without LIFF, set a mock profile
          setProfile({ userId: 'mock_user_123', displayName: 'Mock User' });
          fetchQueueStatus('mock_user_123');
          return;
        }

        await liff.init({ liffId });
        if (!liff.isLoggedIn()) {
          liff.login();
        } else {
          const userProfile = await liff.getProfile();
          setProfile(userProfile);
          fetchQueueStatus(userProfile.userId);
        }
      } catch (err) {
        console.error('LIFF initialization failed', err);
        setLiffError(err.toString());
      }
    };
    initLiff();
  }, []);

  const fetchQueueStatus = async (lineUserId) => {
    try {
      const res = await fetch(`/api/queue/status/${lineUserId}`);
      const data = await res.json();
      setQueueStatus(data.queueItem);
      setWaitCount(data.waitCount);
      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!profile) return;
    setLoading(true);
    try {
      const d = new Date();
      const targetDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      
      await fetch('/api/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lineUserId: profile.userId,
          displayName: profile.displayName,
          targetDate
        })
      });
      fetchQueueStatus(profile.userId);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  if (loading) return <div className="loading-screen"><div className="spinner"></div></div>;

  return (
    <div className="user-view-container">
      <div className="glass-card">
        <div className="logo-container" style={{ textAlign: 'center', marginBottom: '20px' }}>
          <img src="/logo.jpg" alt="A-time CARD SHOP" style={{ maxWidth: '150px', borderRadius: '12px' }} />
        </div>
        <h1 className="title">順番待ち受付</h1>
        {liffError && <p className="error-text">{liffError}</p>}
        
        {queueStatus ? (
          <div className="status-section">
            <h2 className={`status-badge ${queueStatus.status.toLowerCase()}`}>
              {queueStatus.status === 'CALLED' ? 'お呼び出し中' : 
               queueStatus.status === 'IN_STORE' ? '店内待機中' : 
               queueStatus.status === 'ASSESSING' ? '査定中' : 
               queueStatus.status === 'ASSESSMENT_DONE' ? '査定完了' : 
               '受付完了'}
            </h2>
            <div className="queue-number">
              <span className="label">お客様の受付番号</span>
              <span className="number">{queueStatus.dailyNumber}</span>
            </div>
            {queueStatus.status === 'WAITING' && (
              <div className="wait-info">
                <div className="info-box">
                  <span className="label">前に待っている組数</span>
                  <span className="value">{waitCount} 組</span>
                </div>
                <div className="info-box">
                  <span className="label">ご案内目安時間</span>
                  <span className="value">約 {waitCount * 5} 分</span>
                </div>
              </div>
            )}
            {queueStatus.status === 'CALLED' && (
              <div className="called-alert">
                <p>順番が近づきました！店舗までお越しください。</p>
              </div>
            )}
            {queueStatus.status === 'IN_STORE' && (
              <div className="called-alert" style={{backgroundColor: '#e0f2fe', color: '#0369a1', borderColor: '#bae6fd'}}>
                <p>店内で順番にお待ちください。</p>
              </div>
            )}
            {queueStatus.status === 'ASSESSING' && (
              <div className="called-alert" style={{backgroundColor: '#ffedd5', color: '#c2410c', borderColor: '#fed7aa'}}>
                <p>現在査定中です。しばらくお待ちください。</p>
              </div>
            )}
            <button className="refresh-btn" onClick={() => fetchQueueStatus(profile.userId)}>
              最新の状況を更新
            </button>
          </div>
        ) : (
          <div className="register-section">
            <p className="welcome-text">ご来店ありがとうございます。<br/>下のボタンから順番待ち受付を行ってください。</p>
            <button className="primary-btn" onClick={handleRegister}>
              順番待ちを受付する
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
