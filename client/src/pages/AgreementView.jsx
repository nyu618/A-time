import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import liff from '@line/liff';
import SignatureCanvas from 'react-signature-canvas';
import './AgreementView.css';

export default function AgreementView() {
  const { queueId } = useParams();
  const navigate = useNavigate();
  const sigCanvas = useRef({});

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [profile, setProfile] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [isEditingProfile, setIsEditingProfile] = useState(true);

  // Form State
  const [formData, setFormData] = useState({
    fullName: '',
    fullNameKana: '',
    birthDate: '',
    phoneNumber: '',
    postalCode: '',
    address: '',
    occupation: '',
    bankName: '',
    branchName: '',
    accountType: '普通',
    accountNumber: '',
    accountName: '',
  });

  const [idCardImageUrl, setIdCardImageUrl] = useState(null); // Base64
  const [isAgreedToTerms, setIsAgreedToTerms] = useState(false);
  const [isNotTaxFree, setIsNotTaxFree] = useState(false);

  useEffect(() => {
    const initLiff = async () => {
      try {
        const liffId = import.meta.env.VITE_LIFF_ID;
        if (!liffId || liffId === "YOUR_LIFF_ID") {
          // Mock mode
          fetchUserData('mock_user_123');
          setProfile({ userId: 'mock_user_123', displayName: 'Mock User' });
          return;
        }

        await liff.init({ liffId });
        if (!liff.isLoggedIn()) {
          liff.login();
        } else {
          const userProfile = await liff.getProfile();
          setProfile(userProfile);
          fetchUserData(userProfile.userId);
        }
      } catch (err) {
        console.error('LIFF init failed', err);
        setErrorMsg('LIFF初期化エラー');
        setLoading(false);
      }
    };
    initLiff();
  }, []);

  const fetchUserData = async (lineUserId) => {
    try {
      const res = await fetch(`/api/user/${lineUserId}`);
      if (res.ok) {
        const data = await res.json();
        if (data) {
          // Auto fill form with existing data
          setFormData({
            fullName: data.fullName || '',
            fullNameKana: data.fullNameKana || '',
            birthDate: data.birthDate || '',
            phoneNumber: data.phoneNumber || '',
            postalCode: data.postalCode || '',
            address: data.address || '',
            occupation: data.occupation || '',
            bankName: data.bankName || '',
            branchName: data.branchName || '',
            accountType: data.accountType || '普通',
            accountNumber: data.accountNumber || '',
            accountName: data.accountName || '',
          });
          if (data.fullName && data.address && data.bankName) {
            setIsEditingProfile(false);
          }
        }
      }
    } catch (err) {
      console.error('Failed to fetch user data', err);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setIdCardImageUrl(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const clearSignature = () => {
    sigCanvas.current.clear();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isAgreedToTerms || !isNotTaxFree) {
      alert("すべての同意項目にチェックを入れてください。");
      return;
    }
    if (sigCanvas.current.isEmpty()) {
      alert("ご署名をお願いいたします。");
      return;
    }

    setSubmitting(true);
    const signatureData = sigCanvas.current.getTrimmedCanvas().toDataURL('image/png');

    const payload = {
      queueId: parseInt(queueId),
      userId: profile.userId,
      userInfo: formData,
      idCardImageUrl: idCardImageUrl,
      signatureData: signatureData,
      isAgreedToTerms: true,
      isInvoiceRegistered: false
    };

    try {
      const res = await fetch('/api/agreement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Submit failed');
      }

      alert("買取申込を受け付けました！ありがとうございました。");
      navigate('/');
    } catch (err) {
      console.error(err);
      alert("エラーが発生しました: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <p className="loading-text">読み込み中...</p>
      </div>
    );
  }

  const today = new Date();
  const dateString = `${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日`;

  return (
    <div className="agreement-container">
      <div className="agreement-header">
        <h1>買取申込フォーム ({dateString})</h1>
        <button onClick={() => navigate('/')} className="back-button">戻る</button>
      </div>

      <div className="agreement-content">
        {errorMsg && <div className="error-message">{errorMsg}</div>}

        <form onSubmit={handleSubmit}>
          
          {!isEditingProfile ? (
            <section className="form-section">
              <h2 className="section-title">ご登録済みのお客様情報</h2>
              <p className="section-desc" style={{ marginBottom: '1rem', color: '#4b5563', lineHeight: '1.5' }}>
                前回ご登録いただいた情報（<strong>{formData.fullName}</strong> 様）を使用します。<br/>
                住所や口座情報などに変更がある場合のみ、以下のボタンから情報を編集してください。
              </p>
              <button 
                type="button" 
                onClick={() => setIsEditingProfile(true)} 
                className="submit-btn" 
                style={{ backgroundColor: '#f3f4f6', color: '#374151', padding: '0.75rem', fontSize: '0.875rem', boxShadow: 'none', border: '1px solid #d1d5db' }}
              >
                情報を編集する
              </button>
            </section>
          ) : (
            <>
              {/* 1. お客様情報 */}
              <section className="form-section">
                <h2 className="section-title"><span className="section-badge">1</span>お客様情報</h2>
                
                <div className="form-group">
                  <label>お名前（本名） <span className="required-mark">*</span></label>
                  <input required type="text" name="fullName" value={formData.fullName} onChange={handleChange} className="form-control" placeholder="山田 太郎" />
                </div>
                <div className="form-group">
                  <label>フリガナ <span className="required-mark">*</span></label>
                  <input required type="text" name="fullNameKana" value={formData.fullNameKana} onChange={handleChange} className="form-control" placeholder="ヤマダ タロウ" />
                </div>
                <div className="form-group">
                  <label>生年月日 <span className="required-mark">*</span></label>
                  <input required type="date" name="birthDate" value={formData.birthDate} onChange={handleChange} className="form-control" />
                </div>
                <div className="form-group">
                  <label>電話番号 <span className="required-mark">*</span></label>
                  <input required type="tel" name="phoneNumber" value={formData.phoneNumber} onChange={handleChange} className="form-control" placeholder="090-1234-5678" />
                </div>
                <div className="form-group">
                  <label>郵便番号 <span className="required-mark">*</span></label>
                  <input required type="text" name="postalCode" value={formData.postalCode} onChange={handleChange} className="form-control" placeholder="123-4567" />
                </div>
                <div className="form-group">
                  <label>ご住所 <span className="required-mark">*</span></label>
                  <input required type="text" name="address" value={formData.address} onChange={handleChange} className="form-control" placeholder="東京都渋谷区..." />
                </div>
                <div className="form-group">
                  <label>ご職業 <span className="required-mark">*</span></label>
                  <select required name="occupation" value={formData.occupation} onChange={handleChange} className="form-control">
                    <option value="">選択してください</option>
                    <option value="会社員">会社員</option>
                    <option value="公務員">公務員</option>
                    <option value="自営業">自営業</option>
                    <option value="学生">学生</option>
                    <option value="主婦・主夫">主婦・主夫</option>
                    <option value="その他">その他</option>
                  </select>
                </div>
              </section>

              {/* 2. 口座情報 */}
              <section className="form-section">
                <h2 className="section-title"><span className="section-badge">2</span>お振込先口座情報</h2>
                <p className="section-desc">買取金額のお振込先をご入力ください。</p>
                
                <div className="form-group">
                  <label>銀行名 <span className="required-mark">*</span></label>
                  <input required type="text" name="bankName" value={formData.bankName} onChange={handleChange} className="form-control" placeholder="〇〇銀行" />
                </div>
                <div className="form-group">
                  <label>支店名 <span className="required-mark">*</span></label>
                  <input required type="text" name="branchName" value={formData.branchName} onChange={handleChange} className="form-control" placeholder="〇〇支店" />
                </div>
                <div className="form-group">
                  <label>口座種類 <span className="required-mark">*</span></label>
                  <select required name="accountType" value={formData.accountType} onChange={handleChange} className="form-control">
                    <option value="普通">普通</option>
                    <option value="当座">当座</option>
                    <option value="貯蓄">貯蓄</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>口座番号 <span className="required-mark">*</span></label>
                  <input required type="text" name="accountNumber" value={formData.accountNumber} onChange={handleChange} className="form-control" placeholder="1234567" />
                </div>
                <div className="form-group">
                  <label>口座名義（カタカナ） <span className="required-mark">*</span></label>
                  <input required type="text" name="accountName" value={formData.accountName} onChange={handleChange} className="form-control" placeholder="ヤマダ タロウ" />
                </div>
              </section>
            </>
          )}

          {/* 3. 身分証明書 */}
          <section className="form-section">
            <h2 className="section-title"><span className="section-badge">3</span>身分証明書アップロード</h2>
            <p className="section-desc">運転免許証やマイナンバーカード等、現住所が確認できる身分証明書を撮影してアップロードしてください。</p>
            <input 
              type="file" 
              accept="image/*" 
              onChange={handleImageChange}
              className="file-input"
            />
            {idCardImageUrl && (
              <div className="preview-container">
                <img src={idCardImageUrl} alt="身分証プレビュー" className="preview-image" />
              </div>
            )}
          </section>

          {/* 4. 免責事項 */}
          <section className="form-section">
            <h2 className="section-title"><span className="section-badge">4</span>免責事項・同意</h2>
            
            <div className="terms-box">
              <strong>【買取に関する免責事項】</strong><br/>
              1. 査定金額にご納得いただき、承諾をいただいた後のキャンセルはお受けできません。<br/>
              2. 盗品、偽造品、または他人の所有物であることが判明した場合、直ちに警察へ通報し、損害賠償を請求する場合がございます。<br/>
              3. ご提供いただいた個人情報は、古物営業法に基づく本人確認および買取業務のみに使用し、厳重に管理いたします。<br/>
              4. 銀行振込によるお支払いの場合、振込手数料はお客様負担となる場合がございます。（※店舗規定に準拠）<br/>
              5. 未成年の方からの買取は、保護者の同意書が必要となります。
            </div>

            <div className="checkbox-group">
              <label className="checkbox-label">
                <input 
                  type="checkbox" 
                  checked={isAgreedToTerms}
                  onChange={(e) => setIsAgreedToTerms(e.target.checked)}
                  className="checkbox-input" 
                />
                <span className="checkbox-text">免責事項・プライバシーポリシーをすべて確認し、同意します。</span>
              </label>

              <label className="checkbox-label">
                <input 
                  type="checkbox" 
                  checked={isNotTaxFree}
                  onChange={(e) => setIsNotTaxFree(e.target.checked)}
                  className="checkbox-input" 
                />
                <span className="checkbox-text">査定に出す商品は、免税で購入した商品ではありません。</span>
              </label>
            </div>
          </section>

          {/* 5. ご署名 */}
          <section className="form-section">
            <h2 className="section-title"><span className="section-badge">5</span>ご署名</h2>
            <p className="section-desc">下記枠内に指でサインをお願いいたします。</p>
            <div className="signature-container">
              <SignatureCanvas 
                ref={sigCanvas} 
                penColor="black"
                canvasProps={{ className: 'signature-canvas' }} 
              />
            </div>
            <div className="clear-btn-container">
              <button type="button" onClick={clearSignature} className="clear-btn">書き直す</button>
            </div>
          </section>

          {/* Submit */}
          <div className="submit-container">
            <button 
              type="submit" 
              disabled={submitting || !isAgreedToTerms || !isNotTaxFree}
              className="submit-btn"
            >
              {submitting ? '送信中...' : '買取申込を送信する'}
            </button>
            <p className="submit-hint">送信ボタンを押すと受付完了となります。</p>
          </div>

        </form>
      </div>
    </div>
  );
}
