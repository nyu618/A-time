import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import liff from '@line/liff';
import SignatureCanvas from 'react-signature-canvas';
import './AgreementView.css';

export default function AgreementView() {
  const { queueId } = useParams();
  const navigate = useNavigate();
  const sigCanvas = useRef({});

  const draftKey = `agreementDraft_${queueId}`;
  const getDraft = () => {
    try {
      const stored = sessionStorage.getItem(draftKey);
      return stored ? JSON.parse(stored) : null;
    } catch (e) {
      return null;
    }
  };
  const draft = getDraft();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [profile, setProfile] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [isEditingProfile, setIsEditingProfile] = useState(draft ? draft.isEditingProfile : true);

  // Form State
  const [formData, setFormData] = useState(draft?.formData || {
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

  const [idCardImageUrl, setIdCardImageUrl] = useState(draft?.idCardImageUrl || null); // Base64
  const [isAgreedToTerms, setIsAgreedToTerms] = useState(draft?.isAgreedToTerms || false);
  const [signatureData, setSignatureData] = useState(draft?.signatureData || null);
  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);
  const [errors, setErrors] = useState({});

  // Save to draft on change
  useEffect(() => {
    if (!loading) {
      try {
        sessionStorage.setItem(draftKey, JSON.stringify({
          formData,
          idCardImageUrl,
          isAgreedToTerms,
          isNotTaxFree,
          isEditingProfile,
          signatureData
        }));
      } catch (err) {
        console.warn("Draft save failed (likely due to large image size):", err);
        // Fallback: save draft without images to preserve text data and avoid crash
        try {
          sessionStorage.setItem(draftKey, JSON.stringify({
            formData,
            idCardImageUrl: null,
            isAgreedToTerms,
            isEditingProfile,
            signatureData: null
          }));
        } catch (e) {
          console.error("Fallback draft save failed:", e);
        }
      }
    }
  }, [formData, idCardImageUrl, isAgreedToTerms, isEditingProfile, signatureData, loading, queueId, draftKey]);

  // Remove the useEffect that loads from draft to sigCanvas on mount
  // because sigCanvas is now only rendered inside the modal when open.

  useEffect(() => {
    const initLiff = async () => {
      try {
        // Use new LIFF ID directly or via env
        const liffId = import.meta.env.VITE_LIFF_ID || "2010494802-asj2kOFe";
        // Force override to new LIFF ID if old one is stuck
        const finalLiffId = (liffId === "2010316224-EHzt5FIl" || liffId === "YOUR_LIFF_ID") ? "2010494802-asj2kOFe" : liffId;

        if (!finalLiffId || finalLiffId === "YOUR_LIFF_ID") {
          // Mock mode
          fetchUserData('mock_user_123');
          setProfile({ userId: 'mock_user_123', displayName: 'Mock User' });
          return;
        }

        await liff.init({ liffId: finalLiffId });
        if (!liff.isLoggedIn()) {
          liff.login();
          return;
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
        const currentDraft = getDraft();
        if (data && !currentDraft) {
          // Auto fill form with existing data ONLY IF no draft exists
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
          if (data.agreements && data.agreements.length > 0 && data.agreements[0].idCardImageUrl) {
            setIdCardImageUrl(data.agreements[0].idCardImageUrl);
          }

          if (data.fullName && data.address && data.bankName && data.agreements && data.agreements.length > 0 && data.agreements[0].idCardImageUrl) {
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

  const handleCompleteSignature = () => {
    try {
      if (sigCanvas.current && !sigCanvas.current.isEmpty()) {
        setSignatureData(sigCanvas.current.toDataURL('image/png'));
        setIsSignatureModalOpen(false);
      } else {
        alert("サインが入力されていません。");
      }
    } catch (e) {
      console.error(e);
      alert("サインの保存に失敗しました。もう一度お試しください。");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!profile) {
      alert("プロフィール情報が取得できません。もう一度お試しください。");
      return;
    }

    const newErrors = {};
    let firstErrorField = null;

    if (isEditingProfile) {
      const requiredFields = {
        fullName: 'お名前（本名）',
        fullNameKana: 'フリガナ',
        birthDate: '生年月日',
        phoneNumber: '電話番号',
        postalCode: '郵便番号',
        address: 'ご住所',
        occupation: 'ご職業',
        bankName: '銀行名',
        branchName: '支店名',
        accountNumber: '口座番号',
        accountName: '口座名義',
      };

      for (const [key, label] of Object.entries(requiredFields)) {
        if (!formData[key] || formData[key].trim() === '') {
          newErrors[key] = `${label}を入力してください。`;
          if (!firstErrorField) firstErrorField = key;
        }
      }

      if (formData.fullNameKana && !/^[ァ-ヶー\s]+$/.test(formData.fullNameKana)) {
        newErrors.fullNameKana = 'フリガナは全角カタカナで入力してください。';
        if (!firstErrorField) firstErrorField = 'fullNameKana';
      }
      if (formData.phoneNumber && !/^[0-9]+$/.test(formData.phoneNumber)) {
        newErrors.phoneNumber = '電話番号は半角数字で入力してください（ハイフンなし）。';
        if (!firstErrorField) firstErrorField = 'phoneNumber';
      }
      if (formData.postalCode && !/^[0-9]+$/.test(formData.postalCode)) {
        newErrors.postalCode = '郵便番号は半角数字で入力してください（ハイフンなし）。';
        if (!firstErrorField) firstErrorField = 'postalCode';
      }
      if (formData.accountNumber && !/^[0-9]+$/.test(formData.accountNumber)) {
        newErrors.accountNumber = '口座番号は半角数字で入力してください。';
        if (!firstErrorField) firstErrorField = 'accountNumber';
      }
      if (formData.accountName && !/^[ァ-ヶー\s]+$/.test(formData.accountName)) {
        newErrors.accountName = '口座名義は全角カタカナで入力してください。';
        if (!firstErrorField) firstErrorField = 'accountName';
      }

      if (formData.birthDate) {
        const today = new Date();
        const birthDate = new Date(formData.birthDate);
        if (birthDate > today) {
          newErrors.birthDate = '生年月日に未来の日付は指定できません。';
          if (!firstErrorField) firstErrorField = 'birthDate';
        } else {
          let age = today.getFullYear() - birthDate.getFullYear();
          const m = today.getMonth() - birthDate.getMonth();
          if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
            age--;
          }
          if (age < 18) {
            newErrors.birthDate = '18歳未満の方は保護者の同意が必要です。同意書を持参してください。';
            if (!firstErrorField) firstErrorField = 'birthDate';
          }
        }
      }

      if (!idCardImageUrl) {
        newErrors.idCardImageUrl = '身分証明書の画像をアップロードしてください。';
        if (!firstErrorField) firstErrorField = 'idCardImageUrl';
      }
    }

    if (!signatureData) {
      newErrors.signatureData = 'ご署名をお願いいたします。';
      if (!firstErrorField) firstErrorField = 'signatureData';
    }

    if (!isAgreedToTerms) {
        newErrors.isAgreedToTerms = '免責事項に同意してください。';
        if (!firstErrorField) firstErrorField = 'isAgreedToTerms';
    }

    setErrors(newErrors);

    if (Object.keys(newErrors).length > 0) {
      alert("入力内容にエラーがあります。赤字の項目を修正してください。");
      if (firstErrorField) {
        const el = document.getElementById(`field-${firstErrorField}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
      return;
    }

    setSubmitting(true);

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

      sessionStorage.removeItem(draftKey);
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

        <form onSubmit={handleSubmit} noValidate>
          
          {!isEditingProfile ? (
            <section className="form-section">
              <h2 className="section-title">ご登録済みのお客様情報</h2>
              <p className="section-desc" style={{ marginBottom: '1rem', color: '#4b5563', lineHeight: '1.5' }}>
                前回ご登録いただいた以下の情報を使用します。<br/>
                ・<strong>お客様情報</strong>（{formData.fullName} 様）<br/>
                ・<strong>お振込先口座情報</strong>（{formData.bankName}）<br/>
                ・<strong>身分証明書</strong>（登録済み）<br/>
                <br/>
                住所や口座情報、身分証などに変更がある場合のみ、以下のボタンから情報を編集してください。
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
                
                <div className="form-group" id="field-fullName">
                  <label>お名前（本名） <span className="required-mark">*</span></label>
                  <input required type="text" name="fullName" value={formData.fullName} onChange={handleChange} className={`form-control ${errors.fullName ? 'input-error' : ''}`} placeholder="山田 太郎" />
                  {errors.fullName && <span className="error-msg">{errors.fullName}</span>}
                </div>
                <div className="form-group" id="field-fullNameKana">
                  <label>フリガナ <span className="required-mark">*</span></label>
                  <input required type="text" name="fullNameKana" value={formData.fullNameKana} onChange={handleChange} className={`form-control ${errors.fullNameKana ? 'input-error' : ''}`} placeholder="ヤマダ タロウ" />
                  {errors.fullNameKana && <span className="error-msg">{errors.fullNameKana}</span>}
                </div>
                <div className="form-group" id="field-birthDate">
                  <label>生年月日 <span className="required-mark">*</span></label>
                  <input required type="date" name="birthDate" value={formData.birthDate} onChange={handleChange} className={`form-control ${errors.birthDate ? 'input-error' : ''}`} />
                  {errors.birthDate && <span className="error-msg">{errors.birthDate}</span>}
                </div>
                <div className="form-group" id="field-phoneNumber">
                  <label>電話番号 <span className="required-mark">*</span></label>
                  <input required type="tel" name="phoneNumber" value={formData.phoneNumber} onChange={handleChange} className={`form-control ${errors.phoneNumber ? 'input-error' : ''}`} placeholder="09012345678" />
                  {errors.phoneNumber && <span className="error-msg">{errors.phoneNumber}</span>}
                </div>
                <div className="form-group" id="field-postalCode">
                  <label>郵便番号 <span className="required-mark">*</span></label>
                  <input required type="text" name="postalCode" value={formData.postalCode} onChange={handleChange} className={`form-control ${errors.postalCode ? 'input-error' : ''}`} placeholder="1234567" />
                  {errors.postalCode && <span className="error-msg">{errors.postalCode}</span>}
                </div>
                <div className="form-group" id="field-address">
                  <label>ご住所 <span className="required-mark">*</span></label>
                  <input required type="text" name="address" value={formData.address} onChange={handleChange} className={`form-control ${errors.address ? 'input-error' : ''}`} placeholder="東京都渋谷区..." />
                  {errors.address && <span className="error-msg">{errors.address}</span>}
                </div>
                <div className="form-group" id="field-occupation">
                  <label>ご職業 <span className="required-mark">*</span></label>
                  <select required name="occupation" value={formData.occupation} onChange={handleChange} className={`form-control ${errors.occupation ? 'input-error' : ''}`}>
                    <option value="">選択してください</option>
                    <option value="会社員">会社員</option>
                    <option value="公務員">公務員</option>
                    <option value="自営業">自営業</option>
                    <option value="学生">学生</option>
                    <option value="主婦・主夫">主婦・主夫</option>
                    <option value="その他">その他</option>
                  </select>
                  {errors.occupation && <span className="error-msg">{errors.occupation}</span>}
                </div>
              </section>

              {/* 2. 口座情報 */}
              <section className="form-section">
                <h2 className="section-title"><span className="section-badge">2</span>お振込先口座情報</h2>
                <p className="section-desc">買取金額のお振込先をご入力ください。</p>
                
                <div className="form-group" id="field-bankName">
                  <label>銀行名 <span className="required-mark">*</span></label>
                  <input required type="text" name="bankName" value={formData.bankName} onChange={handleChange} className={`form-control ${errors.bankName ? 'input-error' : ''}`} placeholder="〇〇銀行" />
                  {errors.bankName && <span className="error-msg">{errors.bankName}</span>}
                </div>
                <div className="form-group" id="field-branchName">
                  <label>支店名 <span className="required-mark">*</span></label>
                  <input required type="text" name="branchName" value={formData.branchName} onChange={handleChange} className={`form-control ${errors.branchName ? 'input-error' : ''}`} placeholder="〇〇支店" />
                  {errors.branchName && <span className="error-msg">{errors.branchName}</span>}
                </div>
                <div className="form-group" id="field-accountType">
                  <label>口座種類 <span className="required-mark">*</span></label>
                  <select required name="accountType" value={formData.accountType} onChange={handleChange} className={`form-control ${errors.accountType ? 'input-error' : ''}`}>
                    <option value="普通">普通</option>
                    <option value="当座">当座</option>
                    <option value="貯蓄">貯蓄</option>
                  </select>
                  {errors.accountType && <span className="error-msg">{errors.accountType}</span>}
                </div>
                <div className="form-group" id="field-accountNumber">
                  <label>口座番号 <span className="required-mark">*</span></label>
                  <input required type="text" name="accountNumber" value={formData.accountNumber} onChange={handleChange} className={`form-control ${errors.accountNumber ? 'input-error' : ''}`} placeholder="1234567" />
                  {errors.accountNumber && <span className="error-msg">{errors.accountNumber}</span>}
                </div>
                <div className="form-group" id="field-accountName">
                  <label>口座名義（カタカナ） <span className="required-mark">*</span></label>
                  <input required type="text" name="accountName" value={formData.accountName} onChange={handleChange} className={`form-control ${errors.accountName ? 'input-error' : ''}`} placeholder="ヤマダ タロウ" />
                  {errors.accountName && <span className="error-msg">{errors.accountName}</span>}
                </div>
              </section>

              {/* 3. 身分証明書 */}
              <section className="form-section" id="field-idCardImageUrl">
                <h2 className="section-title"><span className="section-badge">3</span>身分証明書アップロード</h2>
                <p className="section-desc">運転免許証やマイナンバーカード等、現住所が確認できる身分証明書を撮影してアップロードしてください。</p>
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={handleImageChange}
                  className={`file-input ${errors.idCardImageUrl ? 'input-error' : ''}`}
                />
                {errors.idCardImageUrl && <span className="error-msg" style={{marginBottom: '10px'}}>{errors.idCardImageUrl}</span>}
                {idCardImageUrl && (
                  <div className="preview-container">
                    <img src={idCardImageUrl} alt="身分証プレビュー" className="preview-image" />
                  </div>
                )}
              </section>
            </>
          )}

          {/* 4. 免責事項 */}
          <section className="form-section">
            <h2 className="section-title"><span className="section-badge">4</span>免責事項・同意</h2>
            
            <div className="terms-box">
              <strong>【買取に関する免責事項】</strong><br/>
              1. 買取金のお渡しは銀行振り込みになること。<br/>
              2. 銀行お振込みは、買取契約締結から３営業日以内でのお振込みになること。<br/>
              3. お客様にご記入いただいた銀行口座情報に誤りがある場合の弊社からの振込手続きが不可になることにたいして同意すること。<br/>
              4. A-time店舗（株式会社エースタイル、イーグッズジャパン）の社員・スタッフによりお客様のお持ちいただいた商品に対して必要な査定行為の作業を実施することに異存はないこと。<br/>
              5. 買取をご希望する商品は全てお客様ご自身の所有物であること。<br/>
              6. 弊社からの査定結果をお伝えする呼び出し案内からお客様が戻られるまでに1週間経過した場合にはお客様の買取希望品の所有権を全て放棄すること。<br/>
              7. 買取希望商品は免税購入品ではないこと。<br/>
              8. 適格請求書発行事業者に該当しないこと。<br/>
              9. 弊社の買取基準に満たない場合、買取金額の減額や買取できない状況が発生すること。<br/>
              10. 弊社の買取表の満額査定が出た場合はキャンセル不可であること。
            </div>

            <div className="checkbox-group">
              <label className="checkbox-label">
                <input 
                  type="checkbox" 
                  checked={isAgreedToTerms}
                  onChange={(e) => setIsAgreedToTerms(e.target.checked)}
                  className="checkbox-input" 
                />
                <span className="checkbox-text">上記の免責事項をすべて確認し、同意します。</span>
              </label>
            </div>
          </section>

          {/* 5. ご署名 */}
          <section className="form-section" id="field-signatureData">
            <h2 className="section-title"><span className="section-badge">5</span>ご署名</h2>
            <p className="section-desc">下記ボタンよりサインを入力してください。</p>
            {errors.signatureData && <span className="error-msg" style={{marginBottom: '10px'}}>{errors.signatureData}</span>}
            
            {signatureData ? (
              <div>
                <div className="signed-image-container">
                  <img src={signatureData} alt="ご署名" className="signed-image" />
                </div>
                <button 
                  type="button" 
                  onClick={() => setIsSignatureModalOpen(true)}
                  className="open-signature-btn"
                >
                  🖊️ サインを書き直す
                </button>
              </div>
            ) : (
              <button 
                type="button" 
                onClick={() => setIsSignatureModalOpen(true)}
                className="open-signature-btn"
              >
                🖊️ タップしてサインを入力
              </button>
            )}
          </section>

          {/* Submit */}
          <div className="submit-container">
            <button 
              type="submit" 
              disabled={submitting}
              className="submit-btn"
            >
              {submitting ? '送信中...' : '買取申込を送信する'}
            </button>
            <p className="submit-hint">送信ボタンを押すと受付完了となります。</p>
          </div>

        </form>
      </div>

      {/* Signature Modal */}
      {isSignatureModalOpen && (
        <div className="signature-modal-backdrop" onClick={() => setIsSignatureModalOpen(false)}>
          <div className="signature-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="signature-modal-header">
              <span>ご署名を入力</span>
              <button type="button" onClick={() => setIsSignatureModalOpen(false)} style={{background:'none', border:'none', fontSize:'1.25rem', color:'#9ca3af', cursor:'pointer'}}>&times;</button>
            </div>
            <div className="signature-modal-body">
              <div className="signature-container">
                <SignatureCanvas 
                  ref={sigCanvas} 
                  penColor="black"
                  canvasProps={{ className: 'signature-canvas' }} 
                />
              </div>
              <div className="clear-btn-container">
                <button type="button" onClick={() => sigCanvas.current && sigCanvas.current.clear()} className="clear-btn">書き直す</button>
              </div>
            </div>
            <div className="signature-modal-actions">
              <button type="button" className="btn-secondary" onClick={() => setIsSignatureModalOpen(false)}>キャンセル</button>
              <button type="button" className="btn-primary" onClick={handleCompleteSignature}>完了</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
