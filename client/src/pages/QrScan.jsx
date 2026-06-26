import React, { useEffect, useState } from 'react';
import liff from '@line/liff';
import './QrScan.css';

function QrScan() {
  const [errorDetails, setErrorDetails] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  useEffect(() => {
    const initLiff = async () => {
      try {
        const envLiffId = import.meta.env.VITE_SCAN_LIFF_ID;
        const finalLiffId = envLiffId && envLiffId !== "YOUR_SCAN_LIFF_ID" ? envLiffId : "2010494802-XUrGaS3R";
        
        if (!finalLiffId || finalLiffId === "YOUR_SCAN_LIFF_ID") {
          throw new Error("VITE_SCAN_LIFF_ID is not configured");
        }

        await liff.init({ liffId: finalLiffId });

        if (!liff.isLoggedIn()) {
          liff.login();
          return;
        }

        let lineUserId = null;
        try {
          const profile = await liff.getProfile();
          lineUserId = profile.userId;
        } catch (profileError) {
          console.warn("getProfile failed, trying getContext", profileError);
          const context = liff.getContext();
          if (context && context.userId) {
            lineUserId = context.userId;
          }
        }

        if (!lineUserId) {
          throw new Error("LINEのユーザーIDが取得できませんでした。時間をおいて再度お試しください。");
        }

        const res = await fetch('/api/send-entry-message', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lineUserId })
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => 'No response text');
          throw new Error(`API Error: ${res.status} ${res.statusText} - ${errText}`);
        }

        // Close the LIFF window upon success
        liff.closeWindow();
        
        // In case closeWindow doesn't work (e.g. testing in external browser)
        setSuccessMsg("画面左上の「×」で閉じて、LINEのトーク画面をご確認ください。");

      } catch (err) {
        console.error("LIFF Init / API Error:", err);
        setErrorDetails(`[${err.name || 'Error'}] ${err.message}\n${err.stack || ''}`);
      }
    };

    initLiff();
  }, []);

  return (
    <div className="qr-scan-container">
      <div className="qr-scan-content">
        {!errorDetails && !successMsg ? (
          <>
            <div className="spinner" style={{ marginBottom: '20px' }}></div>
            <p style={{ fontWeight: 'bold', color: '#1f2937' }}>受付メッセージを送信しています...</p>
          </>
        ) : successMsg ? (
          <p className="qr-scan-success" style={{ fontWeight: 'bold', color: '#047857' }}>{successMsg}</p>
        ) : (
          <div className="qr-scan-error" style={{ textAlign: 'left', wordBreak: 'break-all' }}>
            <p style={{ fontWeight: 'bold', marginBottom: '10px' }}>エラー詳細情報</p>
            <pre style={{ whiteSpace: 'pre-wrap', fontSize: '11px', background: 'rgba(255,255,255,0.7)', padding: '10px', borderRadius: '4px' }}>
              {errorDetails}
            </pre>
            <p style={{ fontSize: '12px', marginTop: '10px', fontWeight: 'bold' }}>画面左上の「×」で閉じて、再度お試しください。</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default QrScan;
