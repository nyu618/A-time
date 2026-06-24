import React, { useEffect, useState } from 'react';
import liff from '@line/liff';
import './QrScan.css';

function QrScan() {
  const [error, setError] = useState(null);

  useEffect(() => {
    const initLiff = async () => {
      try {
        const liffId = import.meta.env.VITE_SCAN_LIFF_ID;
        if (!liffId || liffId === "YOUR_SCAN_LIFF_ID") {
          throw new Error("VITE_SCAN_LIFF_ID is not configured");
        }

        await liff.init({ liffId });

        if (!liff.isLoggedIn()) {
          liff.login();
          return;
        }

        const profile = await liff.getProfile();
        const lineUserId = profile.userId;

        const res = await fetch('/api/send-entry-message', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lineUserId })
        });

        if (!res.ok) {
          throw new Error("Failed to send message via API");
        }

        // Close the LIFF window upon success
        liff.closeWindow();
        
        // In case closeWindow doesn't work (e.g. testing in external browser)
        setError("画面左上の「×」で閉じて、LINEのトーク画面をご確認ください。");

      } catch (err) {
        console.error("LIFF Init / API Error:", err);
        setError("エラーが発生しました。画面左上の「×」で閉じて、再度お試しください。");
      }
    };

    initLiff();
  }, []);

  return (
    <div className="qr-scan-container">
      <div className="qr-scan-content">
        {!error ? (
          <>
            <div className="spinner" style={{ marginBottom: '20px' }}></div>
            <p style={{ fontWeight: 'bold', color: '#1f2937' }}>受付メッセージを送信しています...</p>
          </>
        ) : (
          <p className="qr-scan-error">{error}</p>
        )}
      </div>
    </div>
  );
}

export default QrScan;
