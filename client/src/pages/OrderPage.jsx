

import Navbar from './Navbar'

const PAYMENT_METHODS = [
  { key: "kakaopay", label: "카카오페이" },
  { key: "naverpay", label: "네이버페이" },
  { key: "payco", label: "PAYCO" },
  { key: "tosspay", label: "토스페이" },
  { key: "card", label: "신용/체크카드" },
  { key: "account", label: "실시간 계좌이체" },
]

import { useEffect, useState } from "react"

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL
  || (import.meta.env.DEV ? '/api' : 'http://localhost:5000')
).replace(/\/+$/, '')




function OrderPage({ orderData, user, onGoHome, onGoLogin, onGoRegister, onGoAdmin, onGoCart, onGoOrderSuccess, onGoMyOrders, onLogout }) {
  // 포트원(아임포트) 결제 모듈 동적 로드 및 초기화
  useEffect(() => {
    function loadIamportScript() {
      return new Promise((resolve, reject) => {
        if (window.IMP && typeof window.IMP.init === 'function') {
          resolve();
          return;
        }
        const script = document.createElement('script');
        script.src = 'https://cdn.iamport.kr/v1/iamport.js';
        script.async = true;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });
    }
    loadIamportScript().then(() => {
      if (window.IMP && typeof window.IMP.init === 'function') {
        window.IMP.init('imp05405751');
      }
    });
  }, []);
  // 필수 입력값 체크 함수
  function isRequiredFieldsFilled() {
    // 배송지
    if (!recipient.trim() || !address.trim() || !addressDetail.trim()) return false;
    // 배송 요청사항
    if (deliveryRequestType === '직접 입력' && !deliveryRequestCustom.trim()) return false;
    if (!deliveryRequestType) return false;
    // 결제수단
    if (!paymentMethod) return false;
    // 주문고객
    if (!customer.name.trim() || !customer.email.trim() || !customer.phone1 || !customer.phone2.trim() || !customer.phone3.trim()) return false;
    return true;
  }

  function handlePayClick() {
    if (!isRequiredFieldsFilled()) {
      alert('필수 입력값을 모두 입력해 주세요.');
      return;
    }
    if (!window.IMP || typeof window.IMP.request_pay !== 'function') {
      alert('결제 모듈이 로드되지 않았습니다. 잠시 후 다시 시도해 주세요.');
      return;
    }
    const payData = {
      pg: 'html5_inicis', // 예시 PG사, 실제 연동시 변경 가능
      pay_method: 'card', // 예시 결제수단, 실제 선택된 값으로 변경
      merchant_uid: 'mid_' + new Date().getTime(),
      name: items.map(i => i.name).join(', '),
      amount: finalAmount,
      buyer_email: customer.email,
      buyer_name: customer.name,
      buyer_tel: `${customer.phone1}-${customer.phone2}-${customer.phone3}`,
      buyer_addr: address + ' ' + addressDetail,
      buyer_postcode: '',
      custom_data: {
        deliveryRequest: deliveryRequestType === '직접 입력' ? deliveryRequestCustom : deliveryRequestType
      }
    };
    window.IMP.request_pay(payData, async function (rsp) {
      if (rsp.success) {
        // 결제 성공 시 서버에 주문 저장
        try {
          const orderPayload = {
            cartId: orderData?._id || '',
            recipient: {
              name: recipient,
              phone: `${recipientPhone1}-${recipientPhone2}-${recipientPhone3}`,
              address: [address, addressDetail].filter(Boolean).join(' '),
              request: deliveryRequestType === '직접 입력' ? deliveryRequestCustom : deliveryRequestType
            },
            email: customer.email,
            pointsUsed: usedPoint,
            paymentMethod,
            paymentStatus: 'paid',
            totalAmount,
            finalAmount,
            items: items.map(item => ({
              product: item.productId || '',
              name: item.name,
              image: item.image,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              options: {
                size: item.size,
                color: item.color
              }
            })),
            status: 'paid',
            paidAmount: Number(rsp.paid_amount || finalAmount),
            imp_uid: rsp.imp_uid,
            merchant_uid: payData.merchant_uid
          };
          const token = localStorage.getItem('accessToken');
          const response = await fetch(`${API_BASE_URL}/orders`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(orderPayload)
          });
          const responseData = await response.json().catch(() => null);
          if (response.ok) {
            if (orderData?._id) {
              await fetch(`${API_BASE_URL}/carts/${orderData._id}`, {
                method: 'DELETE',
              }).catch(() => null)
            }
            sessionStorage.removeItem('orderData')
            window.dispatchEvent(new Event('cart-updated'))
            onGoOrderSuccess && onGoOrderSuccess({ ...(responseData || {}), user })
          } else {
            alert((responseData?.message || '결제는 완료되었으나 주문 저장에 실패했습니다.') + '\n관리자에 문의하세요.');
          }
        } catch (err) {
          alert('결제는 완료되었으나 주문 저장 중 오류가 발생했습니다.\n' + err.message);
        }
      } else {
        alert('결제에 실패했습니다.\n' + rsp.error_msg);
      }
    });
  }
  const [recipient, setRecipient] = useState("")
  const [address, setAddress] = useState("")
  const [addressDetail, setAddressDetail] = useState("")
  const [pointInput, setPointInput] = useState(0) // 입력값
  const [point, setPoint] = useState(0) // 실제 적용값
  const [paymentMethod, setPaymentMethod] = useState(PAYMENT_METHODS[0].key)
  const [customer, setCustomer] = useState({ name: "", email: "", phone1: "010", phone2: "", phone3: "" })
  const [recipientPhone1, setRecipientPhone1] = useState("010")
  const [recipientPhone2, setRecipientPhone2] = useState("")
  const [recipientPhone3, setRecipientPhone3] = useState("")
  const [recipientPhone, setRecipientPhone] = useState("")

  // 배송 요청사항
  const DELIVERY_REQUESTS = [
    "문 앞에 놓아주세요",
    "경비실에 맡겨주세요",
    "배송 전 연락 바랍니다",
    "파손 주의 부탁드립니다",
    "직접 입력"
  ];
  const [deliveryRequestType, setDeliveryRequestType] = useState(DELIVERY_REQUESTS[0]);
  const [deliveryRequestCustom, setDeliveryRequestCustom] = useState("");

  // 로그인 안 된 경우 로그인 페이지로 이동
  useEffect(() => {
    if (!user) {
      onGoLogin && onGoLogin()
    } else {
      setCustomer((prev) => ({
        ...prev,
        name: user.name || "",
        email: user.email || "",
      }))
    }
  }, [user, onGoLogin])

  if (!user) return null

  const userName = typeof user?.name === 'string' ? user.name : ''
  const isAdmin = typeof user?.user_type === 'string' && user.user_type.toLowerCase() === 'admin'

  const items = orderData?.items || []
  const totalAmount = orderData?.totalAmount || 0
  const usedPoint = Math.min(point, 5000)
  const finalAmount = totalAmount - usedPoint

  return (
    <div className="mall-home" style={{ background: "#fff", minHeight: "100vh", padding: "0 0 60px 0" }}>
      <Navbar
        userName={userName}
        isAdmin={isAdmin}
        onGoHome={onGoHome}
        onGoLogin={onGoLogin}
        onGoRegister={onGoRegister}
        onLogout={onLogout}
        onGoAdmin={onGoAdmin}
        onGoCart={onGoCart}
        onGoMyOrders={onGoMyOrders}
      />
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 0 0 0" }}>
        <h1 style={{ fontSize: "1.7rem", fontWeight: 700, margin: "0 0 32px 0", letterSpacing: "0.02em", borderBottom: "2px solid #222", paddingBottom: 18 }}>주문서</h1>
        <div style={{ display: "flex", gap: 32, alignItems: "flex-start" }}>
          {/* LEFT */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* 배송지 */}
            <section style={{ marginBottom: 36 }}>
              <h2 style={{ fontSize: "1.1rem", fontWeight: 700, margin: "0 0 16px 0" }}>
                배송지 <span style={{ color: '#dc2626', fontSize: 18 }}>*</span>
              </h2>
              <div style={{ display: "flex", gap: 12, marginBottom: 10, alignItems: 'center' }}>
                <input style={{ flex: 1, height: 40 }} placeholder="받는 분(직접 입력)" value={recipient} onChange={e => setRecipient(e.target.value)} />
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <select value={recipientPhone1} onChange={e => setRecipientPhone1(e.target.value)} style={{ width: 70, height: 40 }}>
                    <option value="010">010</option>
                    <option value="011">011</option>
                    <option value="016">016</option>
                    <option value="017">017</option>
                    <option value="018">018</option>
                    <option value="019">019</option>
                  </select>
                  <input style={{ width: 70, height: 40 }} maxLength={4} placeholder="중간번호" value={recipientPhone2} onChange={e => setRecipientPhone2(e.target.value.replace(/[^0-9]/g, ''))} />
                  <input style={{ width: 70, height: 40 }} maxLength={4} placeholder="끝번호" value={recipientPhone3} onChange={e => setRecipientPhone3(e.target.value.replace(/[^0-9]/g, ''))} />
                </div>
                <button
                  type="button"
                  style={{ marginLeft: 8, padding: '6px 14px', borderRadius: 8, border: '1px solid #0f766e', background: '#fff', color: '#0f766e', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}
                  onClick={() => setRecipientPhone(`${recipientPhone1}-${recipientPhone2}-${recipientPhone3}`)}
                >
                  입력
                </button>
                <span style={{ marginLeft: 10, minWidth: 100, color: '#222', fontWeight: 600 }}>
                  {recipientPhone && recipientPhone2 && recipientPhone3 ? recipientPhone : ''}
                </span>
              </div>
              <div style={{ display: "flex", gap: 12 }}>
                <input style={{ width: 400, height: 40 }} placeholder="배송지 입력" value={address} onChange={e => setAddress(e.target.value)} />
                <input style={{ width: 300, height: 40 }} placeholder="상세주소(직접 입력)" value={addressDetail} onChange={e => setAddressDetail(e.target.value)} />
              </div>
              <div style={{ marginTop: 8, marginBottom: 0 }}>
                <button
                  type="button"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '7px 18px', borderRadius: 8, border: '1px solid #0f766e', background: '#fff', color: '#0f766e', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}
                  onClick={() => alert('주소찾기 기능은 추후 구현 예정입니다.')}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ display: 'inline', verticalAlign: 'middle' }}>
                    <circle cx="11" cy="11" r="7" strokeWidth="2" />
                    <line x1="16.5" y1="16.5" x2="21" y2="21" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                  주소찾기
                </button>

              </div>
              {/* 배송 요청사항 */}
              <div style={{ marginTop: 18 }}>
                <label style={{ fontWeight: 600, marginRight: 10 }}>
                  배송 요청사항 <span style={{ color: '#dc2626', fontSize: 18 }}>*</span>
                </label>
                <select
                  value={deliveryRequestType}
                  onChange={e => setDeliveryRequestType(e.target.value)}
                  style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 15, height: 40 }}
                >
                  {DELIVERY_REQUESTS.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
                {deliveryRequestType === '직접 입력' && (
                  <input
                    type="text"
                    value={deliveryRequestCustom}
                    onChange={e => setDeliveryRequestCustom(e.target.value)}
                    placeholder="배송 요청사항을 입력하세요"
                    style={{ marginLeft: 10, width: 400, maxWidth: '100%', padding: '7px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 15, height: 40 }}
                  />
                )}
              </div>
            </section>

            <div style={{ borderTop: '1px solid #e5e7eb', margin: '32px 0' }} />
            {/* 할인/포인트 */}
            <section style={{ marginBottom: 36 }}>
              <h2 style={{ fontSize: "1.1rem", fontWeight: 700, margin: "0 0 16px 0" }}>할인/포인트</h2>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                <span style={{ fontWeight: 600, color: "#0f766e" }}>포인트 사용</span>
                <input
                  type="number"
                  min={0}
                  max={5000}
                  value={pointInput}
                  onChange={e => setPointInput(Number(e.target.value))}
                  style={{ width: 100, marginRight: 8, height: 40 }}
                />
                <span style={{ color: "#888", fontSize: 13 }}>최대 5,000P</span>
                <button
                  style={{ marginLeft: 10, padding: "6px 16px", borderRadius: 8, border: 0, background: "#0f766e", color: "#fff", fontWeight: 700, cursor: "pointer" }}
                  onClick={() => setPoint(pointInput)}
                  disabled={pointInput < 1000 || pointInput > 5000}
                >
                  적용
                </button>
              </div>
              <div style={{ color: "#888", fontSize: 13, marginTop: 4 }}>
                * 포인트는 1,000P 이상부터 사용 가능하며, 최대 5,000P까지 사용 가능합니다.
              </div>
            </section>

            <div style={{ borderTop: '1px solid #e5e7eb', margin: '32px 0' }} />
            {/* 결제수단 */}
            <section style={{ marginBottom: 36 }}>
              <h2 style={{ fontSize: "1.1rem", fontWeight: 700, margin: "0 0 16px 0" }}>
                결제수단 <span style={{ color: '#dc2626', fontSize: 18 }}>*</span>
              </h2>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
                {PAYMENT_METHODS.map((pm) => (
                  <label key={pm.key} style={{ display: "flex", alignItems: "center", gap: 6, border: paymentMethod === pm.key ? "2px solid #0f766e" : "1px solid #e5e7eb", borderRadius: 8, padding: "8px 16px", cursor: "pointer", background: paymentMethod === pm.key ? "#f0fdfa" : "#fff" }}>
                    <input
                      type="radio"
                      name="paymentMethod"
                      checked={paymentMethod === pm.key}
                      onChange={() => setPaymentMethod(pm.key)}
                      style={{ accentColor: "#0f766e" }}
                    />
                    <span>{pm.label}</span>
                  </label>
                ))}
              </div>
              {/* 단일동의서 시행 체크박스 삭제됨 */}
            </section>

            <div style={{ borderTop: '1px solid #e5e7eb', margin: '32px 0' }} />
            {/* 주문고객 */}
            <section style={{ marginBottom: 36 }}>
              <h2 style={{ fontSize: "1.1rem", fontWeight: 700, margin: "0 0 16px 0" }}>
                주문 고객 <span style={{ color: '#dc2626', fontSize: 18 }}>*</span>
              </h2>
              <div style={{ display: "flex", gap: 12, marginBottom: 10, alignItems: 'center' }}>
                <input style={{ flex: 1, background: '#f3f4f6', height: 40 }} placeholder="이름" value={customer.name} readOnly />
                <input style={{ flex: 2, background: '#f3f4f6', height: 40 }} placeholder="이메일 주소" value={customer.email} readOnly />
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <select value={customer.phone1} onChange={e => setCustomer(c => ({ ...c, phone1: e.target.value }))} style={{ width: 70, height: 40 }}>
                    <option value="010">010</option>
                    <option value="011">011</option>
                    <option value="016">016</option>
                    <option value="017">017</option>
                    <option value="018">018</option>
                    <option value="019">019</option>
                  </select>
                  <input style={{ width: 70, height: 40 }} maxLength={4} placeholder="중간번호" value={customer.phone2} onChange={e => setCustomer(c => ({ ...c, phone2: e.target.value.replace(/[^0-9]/g, '') }))} />
                  <input style={{ width: 70, height: 40 }} maxLength={4} placeholder="끝번호" value={customer.phone3} onChange={e => setCustomer(c => ({ ...c, phone3: e.target.value.replace(/[^0-9]/g, '') }))} />
                </div>
                <button
                  type="button"
                  style={{ marginLeft: 8, padding: '6px 14px', borderRadius: 8, border: '1px solid #0f766e', background: '#fff', color: '#0f766e', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}
                  onClick={() => setCustomer(c => ({ ...c, phone: `${c.phone1}-${c.phone2}-${c.phone3}` }))}
                >
                  입력
                </button>
                <span style={{ marginLeft: 10, minWidth: 100, color: '#222', fontWeight: 600 }}>
                  {customer.phone && customer.phone2 && customer.phone3 ? customer.phone : ''}
                </span>
              </div>
              <div style={{ color: "#888", fontSize: 13, marginTop: 4 }}>
                * 이름/이메일은 로그인 정보로 자동 입력되며, 연락처는 직접 입력해 주세요.
              </div>
            </section>

            <div style={{ borderTop: '1px solid #e5e7eb', margin: '32px 0' }} />
            {/* 주문 상품 */}
            <section style={{ marginBottom: 36 }}>
              <h2 style={{ fontSize: "1.1rem", fontWeight: 700, margin: "0 0 16px 0" }}>주문 상품</h2>
              <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden" }}>
                {items.map((item, idx) => (
                  <div key={idx} style={{ display: "flex", alignItems: "center", gap: 18, padding: "16px 18px", borderBottom: idx !== items.length - 1 ? "1px solid #f3f4f6" : "none", background: "#fff" }}>
                    <img src={item.image} alt={item.name} style={{ width: 64, height: 64, borderRadius: 8, objectFit: "cover", background: "#f3f4f6" }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 15 }}>{item.name}</div>
                      <div style={{ color: "#6b7280", fontSize: 13 }}>{item.size ? `사이즈: ${item.size}` : ''} {item.color ? `색상: ${item.color}` : ''}</div>
                    </div>
                    <div style={{ fontWeight: 600, fontSize: 15 }}>x{item.quantity}</div>
                    <div style={{ fontWeight: 800, color: "#0f766e", fontSize: 16 }}>₩{(item.unitPrice * item.quantity).toLocaleString('ko-KR')}</div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* RIGHT - 결제 요약 및 안내 */}
          <aside style={{ width: 340, minWidth: 280 }}>
            <div style={{ background: "#fafbfc", border: "1px solid #e5e7eb", borderRadius: 12, padding: 24, marginBottom: 18 }}>
              <h2 style={{ fontSize: "1.1rem", fontWeight: 700, margin: "0 0 18px 0" }}>결제정보</h2>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span>주문 금액</span>
                <span style={{ fontWeight: 600 }}>₩{totalAmount.toLocaleString('ko-KR')}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span>할인/포인트</span>
                <span style={{ color: "#0f766e" }}>-₩{usedPoint.toLocaleString('ko-KR')}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span>배송비</span>
                <span style={{ color: "#0f766e" }}>무료</span>
              </div>
              <div style={{ borderTop: "1px solid #e5e7eb", margin: "16px 0" }} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontWeight: 800, fontSize: 18, color: "#eab308" }}>
                <span>최종 결제금액</span>
                <span>₩{finalAmount.toLocaleString('ko-KR')}</span>
              </div>
              <button
                style={{ width: "100%", marginTop: 18, padding: "14px 0", background: "#0f766e", color: "#fff", border: 0, borderRadius: 8, fontWeight: 700, fontSize: 17, cursor: "pointer" }}
                onClick={handlePayClick}
              >
                결제하기
              </button>
            </div>
            <div style={{ background: "#fff7ed", border: "1px solid #facc15", borderRadius: 10, padding: 16, color: "#b45309", fontSize: 13, lineHeight: 1.7 }}>
              <b style={{ color: "#eab308" }}>안내</b><br />
              - 주문 상품 및 결제정보를 꼭 확인해 주세요.<br />
              - 결제완료 후에는 주문정보 변경이 불가합니다.<br />
              - 결제수단별로 결제창이 별도 제공될 수 있습니다.<br />
              - 포인트 사용 시 환불/취소 시 복원되지 않을 수 있습니다.<br />
              - 기타 문의는 고객센터로 연락 바랍니다.
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}

export default OrderPage