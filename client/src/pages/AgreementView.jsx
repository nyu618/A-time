import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import liff from '@line/liff';
import SignatureCanvas from 'react-signature-canvas';

export default function AgreementView() {
  const { queueId } = useParams();
  const navigate = useNavigate();
  const sigCanvas = useRef({});

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [profile, setProfile] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

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
      isInvoiceRegistered: false // As requested, skipped for now
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

      alert("買取承諾を受け付けました！ありがとうございました。");
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
      <div className="min-h-screen bg-[#f3f4f6] flex items-center justify-center p-4">
        <p className="text-gray-500 font-medium">読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f3f4f6] pb-12">
      <div className="bg-white shadow-sm sticky top-0 z-10 px-4 py-4 flex items-center justify-between">
        <h1 className="text-lg font-bold text-gray-800">買取承諾フォーム</h1>
        <button onClick={() => navigate('/')} className="text-sm text-blue-600 font-medium px-3 py-1 bg-blue-50 rounded-full">戻る</button>
      </div>

      <div className="max-w-xl mx-auto mt-6 px-4">
        {errorMsg && <div className="bg-red-50 text-red-600 p-4 mb-4 rounded-xl border border-red-100 text-sm">{errorMsg}</div>}

        <form onSubmit={handleSubmit} className="space-y-8">
          
          {/* 1. お客様情報 */}
          <section className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
            <h2 className="font-bold text-gray-800 mb-4 border-b pb-2 flex items-center"><span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm mr-2">1</span>お客様情報</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">お名前（本名） <span className="text-red-500">*</span></label>
                <input required type="text" name="fullName" value={formData.fullName} onChange={handleChange} className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="山田 太郎" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">フリガナ <span className="text-red-500">*</span></label>
                <input required type="text" name="fullNameKana" value={formData.fullNameKana} onChange={handleChange} className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="ヤマダ タロウ" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">生年月日 <span className="text-red-500">*</span></label>
                <input required type="date" name="birthDate" value={formData.birthDate} onChange={handleChange} className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">電話番号 <span className="text-red-500">*</span></label>
                <input required type="tel" name="phoneNumber" value={formData.phoneNumber} onChange={handleChange} className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="090-1234-5678" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">郵便番号 <span className="text-red-500">*</span></label>
                <input required type="text" name="postalCode" value={formData.postalCode} onChange={handleChange} className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="123-4567" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ご住所 <span className="text-red-500">*</span></label>
                <input required type="text" name="address" value={formData.address} onChange={handleChange} className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="東京都渋谷区..." />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ご職業 <span className="text-red-500">*</span></label>
                <select required name="occupation" value={formData.occupation} onChange={handleChange} className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none">
                  <option value="">選択してください</option>
                  <option value="会社員">会社員</option>
                  <option value="公務員">公務員</option>
                  <option value="自営業">自営業</option>
                  <option value="学生">学生</option>
                  <option value="主婦・主夫">主婦・主夫</option>
                  <option value="その他">その他</option>
                </select>
              </div>
            </div>
          </section>

          {/* 2. 口座情報 */}
          <section className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
            <h2 className="font-bold text-gray-800 mb-4 border-b pb-2 flex items-center"><span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm mr-2">2</span>お振込先口座情報</h2>
            <p className="text-xs text-gray-500 mb-4">買取金額のお振込先をご入力ください。</p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">銀行名 <span className="text-red-500">*</span></label>
                <input required type="text" name="bankName" value={formData.bankName} onChange={handleChange} className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="〇〇銀行" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">支店名 <span className="text-red-500">*</span></label>
                <input required type="text" name="branchName" value={formData.branchName} onChange={handleChange} className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="〇〇支店" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">口座種類 <span className="text-red-500">*</span></label>
                <select required name="accountType" value={formData.accountType} onChange={handleChange} className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none">
                  <option value="普通">普通</option>
                  <option value="当座">当座</option>
                  <option value="貯蓄">貯蓄</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">口座番号 <span className="text-red-500">*</span></label>
                <input required type="text" name="accountNumber" value={formData.accountNumber} onChange={handleChange} className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="1234567" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">口座名義（カタカナ） <span className="text-red-500">*</span></label>
                <input required type="text" name="accountName" value={formData.accountName} onChange={handleChange} className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="ヤマダ タロウ" />
              </div>
            </div>
          </section>

          {/* 3. 身分証明書 */}
          <section className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
            <h2 className="font-bold text-gray-800 mb-4 border-b pb-2 flex items-center"><span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm mr-2">3</span>身分証明書アップロード</h2>
            <p className="text-xs text-gray-500 mb-4">運転免許証やマイナンバーカード等、現住所が確認できる身分証明書を撮影してアップロードしてください。</p>
            <input 
              type="file" 
              accept="image/*" 
              capture="environment" 
              onChange={handleImageChange}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 mb-4"
            />
            {idCardImageUrl && (
              <div className="mt-2 rounded-lg overflow-hidden border border-gray-200">
                <img src={idCardImageUrl} alt="身分証プレビュー" className="w-full object-cover max-h-64" />
              </div>
            )}
          </section>

          {/* 4. 免責事項 */}
          <section className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
            <h2 className="font-bold text-gray-800 mb-4 border-b pb-2 flex items-center"><span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm mr-2">4</span>免責事項・同意</h2>
            
            <div className="bg-gray-50 p-4 rounded-lg text-xs text-gray-600 h-32 overflow-y-auto mb-4 border border-gray-200 leading-relaxed">
              <strong>【買取に関する免責事項】</strong><br/>
              1. 査定金額にご納得いただき、承諾をいただいた後のキャンセルはお受けできません。<br/>
              2. 盗品、偽造品、または他人の所有物であることが判明した場合、直ちに警察へ通報し、損害賠償を請求する場合がございます。<br/>
              3. ご提供いただいた個人情報は、古物営業法に基づく本人確認および買取業務のみに使用し、厳重に管理いたします。<br/>
              4. 銀行振込によるお支払いの場合、振込手数料はお客様負担となる場合がございます。（※店舗規定に準拠）<br/>
              5. 未成年の方からの買取は、保護者の同意書が必要となります。
            </div>

            <div className="space-y-3">
              <label className="flex items-start cursor-pointer p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                <input 
                  type="checkbox" 
                  checked={isAgreedToTerms}
                  onChange={(e) => setIsAgreedToTerms(e.target.checked)}
                  className="mt-1 mr-3 h-5 w-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500" 
                />
                <span className="text-sm font-medium text-gray-800 leading-snug">免責事項・プライバシーポリシーをすべて確認し、同意します。</span>
              </label>

              <label className="flex items-start cursor-pointer p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                <input 
                  type="checkbox" 
                  checked={isNotTaxFree}
                  onChange={(e) => setIsNotTaxFree(e.target.checked)}
                  className="mt-1 mr-3 h-5 w-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500" 
                />
                <span className="text-sm font-medium text-gray-800 leading-snug">査定に出す商品は、免税で購入した商品ではありません。</span>
              </label>
            </div>
          </section>

          {/* 5. ご署名 */}
          <section className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
            <h2 className="font-bold text-gray-800 mb-4 border-b pb-2 flex items-center"><span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm mr-2">5</span>ご署名</h2>
            <p className="text-xs text-gray-500 mb-4">下記枠内に指でサインをお願いいたします。</p>
            <div className="border-2 border-gray-300 border-dashed rounded-xl bg-gray-50 overflow-hidden touch-none relative">
              <SignatureCanvas 
                ref={sigCanvas} 
                penColor="black"
                canvasProps={{ className: 'w-full h-48 signature-canvas' }} 
              />
            </div>
            <div className="flex justify-end mt-2">
              <button type="button" onClick={clearSignature} className="text-sm text-gray-500 hover:text-gray-800 underline px-2 py-1">書き直す</button>
            </div>
          </section>

          {/* Submit */}
          <div className="pt-4 pb-8">
            <button 
              type="submit" 
              disabled={submitting || !isAgreedToTerms || !isNotTaxFree}
              className={`w-full py-4 rounded-xl font-bold text-lg shadow-sm transition-all ${
                submitting || !isAgreedToTerms || !isNotTaxFree ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700 hover:shadow-md active:scale-[0.98]'
              }`}
            >
              {submitting ? '送信中...' : '買取を承諾して送信する'}
            </button>
            <p className="text-center text-xs text-gray-400 mt-4">送信ボタンを押すと受付完了となります。</p>
          </div>

        </form>
      </div>
    </div>
  );
}
