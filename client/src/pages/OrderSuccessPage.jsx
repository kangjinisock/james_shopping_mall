import Navbar from './Navbar'

const PAYMENT_LABELS = {
  kakaopay: '카카오페이',
  naverpay: '네이버페이',
  payco: 'PAYCO',
  tosspay: '토스페이',
  card: '신용/체크카드',
  account: '실시간 계좌이체',
}

function OrderSuccessPage({ orderInfo, onGoHome, onGoLogin, onGoRegister, onGoAdmin, onGoCart, onGoProducts, onGoMyOrders, onLogout }) {
  const userName = typeof orderInfo?.user?.name === 'string' ? orderInfo.user.name : ''
  const isAdmin = typeof orderInfo?.user?.user_type === 'string' && orderInfo.user.user_type.toLowerCase() === 'admin'
  const items = Array.isArray(orderInfo?.items) ? orderInfo.items : []
  const totalQuantity = typeof orderInfo?.totalQuantity === 'number'
    ? orderInfo.totalQuantity
    : items.reduce((sum, item) => sum + (Number(item?.quantity) || 0), 0)

  return (
    <div className="mall-home" style={{ background: '#fff', minHeight: '100vh', padding: '0 0 60px 0' }}>
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

      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '40px 20px' }}>
        <div style={{ border: '1px solid #d1fae5', background: '#f0fdf4', borderRadius: 18, padding: 28, marginBottom: 24 }}>
          <h1 style={{ margin: '0 0 12px 0', fontSize: '1.9rem', color: '#065f46' }}>주문이 완료되었습니다</h1>
          <p style={{ margin: 0, color: '#374151', fontSize: 16, lineHeight: 1.7 }}>
            주문해 주셔서 감사합니다. 주문이 성공적으로 완료되었으며, 주문정보는 아래와 같습니다.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 24 }}>
          <div style={{ border: '1px solid #e5e7eb', borderRadius: 14, padding: 20, background: '#fff' }}>
            <h2 style={{ margin: '0 0 14px 0', fontSize: '1.05rem' }}>주문 요약</h2>
            <div style={{ display: 'grid', gap: 10, color: '#374151' }}>
              <div><strong>주문번호</strong> : {orderInfo?.orderNumber || orderInfo?._id || '-'}</div>
              <div><strong>받는 분</strong> : {orderInfo?.recipient?.name || '-'}</div>
              <div><strong>연락처</strong> : {orderInfo?.recipient?.phone || '-'}</div>
              <div><strong>배송지</strong> : {orderInfo?.recipient?.address || '-'}</div>
              <div><strong>배송 요청사항</strong> : {orderInfo?.recipient?.request || '-'}</div>
            </div>
          </div>

          <div style={{ border: '1px solid #e5e7eb', borderRadius: 14, padding: 20, background: '#fff' }}>
            <h2 style={{ margin: '0 0 14px 0', fontSize: '1.05rem' }}>결제 정보</h2>
            <div style={{ display: 'grid', gap: 10, color: '#374151' }}>
              <div><strong>주문자 이메일</strong> : {orderInfo?.email || '-'}</div>
              <div><strong>결제수단</strong> : {PAYMENT_LABELS[orderInfo?.paymentMethod] || orderInfo?.paymentMethod || '-'}</div>
              <div><strong>총 수량</strong> : {totalQuantity}개</div>
              <div><strong>총 결제금액</strong> : ₩{Number(orderInfo?.finalAmount || 0).toLocaleString('ko-KR')}</div>
              <div><strong>결제 상태</strong> : {orderInfo?.paymentStatus || 'paid'}</div>
            </div>
          </div>
        </div>

        <div style={{ border: '1px solid #e5e7eb', borderRadius: 14, padding: 20, background: '#fff', marginBottom: 24 }}>
          <h2 style={{ margin: '0 0 14px 0', fontSize: '1.05rem' }}>주문 상품</h2>
          <div style={{ display: 'grid', gap: 12 }}>
            {items.length > 0 ? items.map((item, index) => (
              <div key={`${item?.name || 'item'}-${index}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: index !== items.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{item?.name || '상품'}</div>
                  <div style={{ color: '#6b7280', fontSize: 13 }}>
                    {item?.options?.size ? `사이즈: ${item.options.size} ` : ''}
                    {item?.options?.color ? `색상: ${item.options.color}` : ''}
                  </div>
                </div>
                <div style={{ fontWeight: 700, color: '#0f766e' }}>
                  {item?.quantity || 0}개 / ₩{Number((item?.unitPrice || 0) * (item?.quantity || 0)).toLocaleString('ko-KR')}
                </div>
              </div>
            )) : <p style={{ margin: 0, color: '#6b7280' }}>주문 상품 정보가 없습니다.</p>}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={onGoHome}
            style={{ padding: '12px 20px', borderRadius: 10, border: 0, background: '#0f766e', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
          >
            메인으로 이동
          </button>
          <button
            type="button"
            onClick={onGoMyOrders}
            style={{ padding: '12px 20px', borderRadius: 10, border: '1px solid #0f766e', background: '#ecfdf5', color: '#0f766e', fontWeight: 700, cursor: 'pointer' }}
          >
            주문 목록 보기
          </button>
          <button
            type="button"
            onClick={onGoProducts}
            style={{ padding: '12px 20px', borderRadius: 10, border: '1px solid #d1d5db', background: '#fff', color: '#111827', fontWeight: 700, cursor: 'pointer' }}
          >
            계속 쇼핑하기
          </button>
        </div>
      </div>
    </div>
  )
}

export default OrderSuccessPage
