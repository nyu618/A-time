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

  useEffect(() => {
    let intervalId;
    if (profile && profile.userId) {
      intervalId = setInterval(() => {
        fetchQueueStatus(profile.userId);
      }, 10000); // Poll every 10 seconds
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [profile]);

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
        <h1 className="title">順番待ち整理券受付</h1>
        {liffError && <p className="error-text">{liffError}</p>}
        
        {queueStatus ? (
          <div className="status-section">
            <h2 className={`status-badge ${queueStatus.status.toLowerCase()}`}>
              {queueStatus.status === 'PENDING' ? '承認待ち' : 
               queueStatus.status === 'WAITING' ? '受付済' : 
               queueStatus.status === 'CALLED' ? '受付後呼出中' : 
               queueStatus.status === 'IN_STORE' ? '呼出後店内待機' : 
               queueStatus.status === 'ASSESSING' ? '査定受付呼出' : 
               queueStatus.status === 'POST_ASSESS_CALL' ? '査定完了後呼出中' : 
               queueStatus.status === 'POST_ASSESS_WAIT' ? '査定結果案内完了' : 
               '受付完了'}
            </h2>
            <div className="queue-number">
              <span className="label">お客様の受付番号(整理券番号)</span>
              <span className="number">{queueStatus.dailyNumber}</span>
            </div>
            {queueStatus.status === 'PENDING' && (
              <div className="pending-alert" style={{backgroundColor: '#fef08a', padding: '15px', borderRadius: '12px', marginTop: '20px', color: '#854d0e', fontWeight: 'bold', border: '1px solid #fde047'}}>
                <p style={{margin: 0}}>ただいま承認待ちです。店頭のスタッフにお名前をお伝えいただき、承認を受けてください。</p>
              </div>
            )}
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
                <p>査定の受付を開始しました。しばらくお待ちください。</p>
              </div>
            )}
            {queueStatus.status === 'POST_ASSESS_CALL' && (
              <div className="called-alert" style={{backgroundColor: '#fce7f3', color: '#be185d', borderColor: '#fbcfe8'}}>
                <p>査定が完了しました。ご案内まで店舗へお戻りください。</p>
              </div>
            )}
            {queueStatus.status === 'POST_ASSESS_WAIT' && (
              <div className="called-alert" style={{backgroundColor: '#faf5ff', color: '#7e22ce', borderColor: '#e9d5ff'}}>
                <p>査定結果のご案内が完了しました。精算までしばらくお待ちください。</p>
              </div>
            )}
            <button className="refresh-btn" onClick={() => fetchQueueStatus(profile.userId)}>
              最新の状況を更新
            </button>
          </div>
        ) : (
          <div className="register-section">
            <p className="welcome-text">ご来店ありがとうございます。<br/>下のボタンから順番待ち整理券を発行してください。</p>
            <button className="primary-btn" onClick={handleRegister}>
              順番待ち整理券を発行する
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
