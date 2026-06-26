import React, { useState, useEffect } from 'react';
import './CustomerDetailsModal.css';

function CustomerDetailsModal({ queueId, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [fullscreenImage, setFullscreenImage] = useState(null);

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

  const { user, agreement } = data || {};
  const hasAgreement = !!agreement;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h2>承諾情報詳細 (受付番号: {data?.dailyNumber})</h2>
          <button className="close-icon-btn" onClick={onClose}>&times;</button>
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
                    <span className="label">身分証画像</span>
                    {agreement?.idCardImageUrl ? (
                      <img 
                        src={agreement.idCardImageUrl} 
                        alt="身分証" 
                        onClick={() => setFullscreenImage(agreement.idCardImageUrl)}
                      />
                    ) : (
                      <div className="no-image">未提出</div>
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
          <button className="close-btn" onClick={onClose}>閉じる</button>
        </div>
      </div>

      {/* Fullscreen Image Overlay */}
      {fullscreenImage && (
        <div className="fullscreen-overlay" onClick={() => setFullscreenImage(null)}>
          <button className="close-fullscreen">&times;</button>
          <img src={fullscreenImage} alt="拡大画像" />
        </div>
      )}
    </div>
  );
}

export default CustomerDetailsModal;
