import React, { useState, useEffect } from 'react';
import './CustomerDetailsModal.css';

function CustomerDetailsModal({ queueId, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [fullscreenImage, setFullscreenImage] = useState(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);

  useEffect(() => {
    const fetchDetails = async () => {
      try {
        const response = await fetch(`/api/admin/agreement/${queueId}`);
        if (!response.ok) {
          throw new Error('データの取得に失敗しました');
        }
        const result = await response.json();
        setData(result);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchDetails();
  }, [queueId]);

  if (loading) {
    return (
      <div className="modal-overlay">
        <div className="modal-content loading">
          <div className="spinner"></div>
          <p>読み込み中...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="modal-overlay">
        <div className="modal-content error">
          <p className="error-text">{error}</p>
          <button className="close-btn" onClick={onClose}>閉じる</button>
        </div>
      </div>
    );
  }

  const { user, agreement, isCustomerInfoConfirmed } = data || {};
  const hasAgreement = !!agreement;

  const handleCloseClick = () => {
    if (!hasAgreement || isCustomerInfoConfirmed) {
      onClose();
    } else {
      setShowConfirmModal(true);
    }
  };

  const handleConfirmInfo = async () => {
    setIsConfirming(true);
    try {
      await fetch(`/api/admin/queue/${queueId}/confirm-info`, { method: 'POST' });
      onClose(); // Parent should refetch on close
    } catch (err) {
      console.error(err);
      alert('エラーが発生しました');
    } finally {
      setIsConfirming(false);
    }
  };

  const handleJustClose = () => {
    onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h2>承諾情報詳細 (受付番号: {data?.dailyNumber})</h2>
          <button className="close-icon-btn" onClick={handleCloseClick}>&times;</button>
        </div>

        <div className="modal-body">
          {!hasAgreement ? (
            <div className="no-agreement-banner">
              <p>このお客様はまだ同意フォームを送信していません。</p>
            </div>
          ) : (
            <>
              <div className="info-section">
                <h3>顧客情報</h3>
                <div className="info-grid">
                  <div className="info-item">
                    <span className="label">本名</span>
                    <span className="value">{user?.fullName || '-'}</span>
                  </div>
                  <div className="info-item">
                    <span className="label">フリガナ</span>
                    <span className="value">{user?.fullNameKana || '-'}</span>
                  </div>
                  <div className="info-item">
                    <span className="label">生年月日</span>
                    <span className="value">{user?.birthDate || '-'}</span>
                  </div>
                  <div className="info-item">
                    <span className="label">電話番号</span>
                    <span className="value">{user?.phoneNumber || '-'}</span>
                  </div>
                  <div className="info-item full-width">
                    <span className="label">住所</span>
                    <span className="value">〒{user?.postalCode} {user?.address}</span>
                  </div>
                  <div className="info-item">
                    <span className="label">職業</span>
                    <span className="value">{user?.occupation || '-'}</span>
                  </div>
                </div>
              </div>

              <div className="info-section">
                <h3>口座情報</h3>
                <div className="info-grid">
                  <div className="info-item">
                    <span className="label">銀行名</span>
                    <span className="value">{user?.bankName || '-'}</span>
                  </div>
                  <div className="info-item">
                    <span className="label">支店名</span>
                    <span className="value">{user?.branchName || '-'}</span>
                  </div>
                  <div className="info-item">
                    <span className="label">口座種類</span>
                    <span className="value">{user?.accountType || '-'}</span>
                  </div>
                  <div className="info-item">
                    <span className="label">口座番号</span>
                    <span className="value">{user?.accountNumber || '-'}</span>
                  </div>
                  <div className="info-item full-width">
                    <span className="label">口座名義</span>
                    <span className="value">{user?.accountName || '-'}</span>
                  </div>
                </div>
              </div>

              <div className="info-section">
                <h3>同意状況</h3>
                <div className="info-grid">
                  <div className="info-item">
                    <span className="label">規約同意</span>
                    <span className="value success">{agreement?.isAgreedToTerms ? '同意済' : '未同意'}</span>
                  </div>
                  <div className="info-item">
                    <span className="label">同意日時</span>
                    <span className="value">
                      {agreement?.agreedAt ? new Date(agreement.agreedAt).toLocaleString('ja-JP') : '-'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="info-section">
                <h3>本人確認画像・署名</h3>
                <div className="image-grid">
                  <div className="image-box">
                    <span className="label">身分証（表面）</span>
                    {agreement?.idCardImageFront ? (
                      <img 
                        src={agreement.idCardImageFront} 
                        alt="身分証表面" 
                        onClick={() => setFullscreenImage(agreement.idCardImageFront)}
                      />
                    ) : (
                      <div className="no-image">未提出</div>
                    )}
                  </div>
                  <div className="image-box">
                    <span className="label">身分証（裏面）</span>
                    {agreement?.idCardImageBack ? (
                      <img 
                        src={agreement.idCardImageBack} 
                        alt="身分証裏面" 
                        onClick={() => setFullscreenImage(agreement.idCardImageBack)}
                      />
                    ) : (
                      <div className="no-image">裏面画像なし</div>
                    )}
                  </div>
                  <div className="image-box">
                    <span className="label">電子署名</span>
                    {agreement?.signatureData ? (
                      <img 
                        src={agreement.signatureData} 
                        alt="電子署名" 
                        onClick={() => setFullscreenImage(agreement.signatureData)}
                        className="signature-img"
                      />
                    ) : (
                      <div className="no-image">未提出</div>
                    )}
                  </div>
                </div>
                <p className="image-hint">※ 画像をクリックすると拡大表示します</p>
              </div>
            </>
          )}
        </div>

        <div className="modal-footer">
          <button className="close-btn" onClick={handleCloseClick}>閉じる</button>
        </div>
      </div>

      {/* Fullscreen Image Overlay */}
      {fullscreenImage && (
        <div className="fullscreen-overlay" onClick={() => setFullscreenImage(null)}>
          <button className="close-fullscreen">&times;</button>
          <img src={fullscreenImage} alt="拡大画像" />
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="modal-overlay" style={{ zIndex: 2000 }}>
          <div className="modal-content" style={{ maxWidth: '400px', textAlign: 'center', padding: '30px' }}>
            <h3 style={{ marginTop: 0, marginBottom: '20px', fontSize: '1.2rem', color: '#1f2937' }}>
              お客様情報の確認を済みにしますか？
            </h3>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '20px' }}>
              <button 
                onClick={handleJustClose} 
                style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', backgroundColor: '#9ca3af', color: 'white', cursor: 'pointer', fontWeight: 'bold' }}
                disabled={isConfirming}
              >
                キャンセル
              </button>
              <button 
                onClick={handleConfirmInfo} 
                style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', backgroundColor: '#22c55e', color: 'white', cursor: 'pointer', fontWeight: 'bold' }}
                disabled={isConfirming}
              >
                {isConfirming ? '処理中...' : 'OK（済みにする）'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CustomerDetailsModal;
