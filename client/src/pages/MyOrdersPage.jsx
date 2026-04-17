import { useEffect, useMemo, useState } from 'react'
import Navbar from './Navbar'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL
  || (import.meta.env.DEV ? '/api' : 'http://localhost:5000')

const AUTH_STORAGE_KEYS = ['accessToken', 'tokenType', 'currentUser', 'tokenExpiresIn', 'loginAt']

const PAYMENT_LABELS = {
  kakaopay: '카카오페이',
  naverpay: '네이버페이',
  payco: 'PAYCO',
  tosspay: '토스페이',
  card: '신용/체크카드',
  account: '실시간 계좌이체',
}

const FILTER_OPTIONS = [
  { key: 'all', label: '전체' },
  { key: 'paid', label: '결제완료' },
  { key: 'shipped', label: '배송중' },
  { key: 'delivered', label: '배송완료' },
  { key: 'cancelled', label: '취소' },
]

function clearAuthStorage() {
  AUTH_STORAGE_KEYS.forEach((key) => {
    localStorage.removeItem(key)
  })
}

function parseJwtPayload(token) {
  if (typeof token !== 'string') {
    return null
  }

  const parts = token.split('.')
  if (parts.length !== 3) {
    return null
  }

  try {
    const normalized = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
    return JSON.parse(atob(padded))
  } catch {
    return null
  }
}

function getValidStoredSession() {
  const accessToken = localStorage.getItem('accessToken')
  if (!accessToken) {
    return null
  }

  const tokenType = localStorage.getItem('tokenType') || 'Bearer'
  if (tokenType !== 'Bearer') {
    clearAuthStorage()
    return null
  }

  const payload = parseJwtPayload(accessToken)
  if (!payload?.exp || Date.now() >= payload.exp * 1000) {
    clearAuthStorage()
    return null
  }

  return { accessToken, tokenType }
}

function getStoredUser() {
  try {
    const storedUser = localStorage.getItem('currentUser')
    return storedUser ? JSON.parse(storedUser) : null
  } catch {
    return null
  }
}

function formatPrice(value) {
  return `₩${Number(value || 0).toLocaleString('ko-KR')}`
}

function formatDate(value) {
  if (!value) return '-'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'

  return date.toLocaleString('ko-KR', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

function getOrderStatusMeta(order) {
  const rawStatus = String(order?.status || order?.paymentStatus || 'paid').toLowerCase()

  if (rawStatus === 'shipped') {
    return { label: '배송중', color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe', filterKey: 'shipped' }
  }

  if (rawStatus === 'delivered') {
    return { label: '배송완료', color: '#166534', bg: '#f0fdf4', border: '#bbf7d0', filterKey: 'delivered' }
  }

  if (rawStatus === 'cancelled') {
    return { label: '주문취소', color: '#b91c1c', bg: '#fef2f2', border: '#fecaca', filterKey: 'cancelled' }
  }

  if (rawStatus === 'failed') {
    return { label: '결제실패', color: '#b45309', bg: '#fff7ed', border: '#fed7aa', filterKey: 'cancelled' }
  }

  return { label: '결제완료', color: '#047857', bg: '#ecfdf5', border: '#a7f3d0', filterKey: 'paid' }
}

function getOrderPreview(order) {
  const items = Array.isArray(order?.items) ? order.items : []
  const primaryItem = items[0] || null

  if (!primaryItem) {
    return {
      title: '주문 상품',
      image: '',
      summary: '상품 정보 없음',
      itemCount: 0,
      totalQuantity: Number(order?.totalQuantity) || 0,
    }
  }

  const extraCount = Math.max(items.length - 1, 0)

  return {
    title: primaryItem.name || '주문 상품',
    image: primaryItem.image || '',
    summary: extraCount > 0 ? `외 ${extraCount}건` : '단일 상품 주문',
    itemCount: items.length,
    totalQuantity: Number(order?.totalQuantity) || items.reduce((sum, item) => sum + (Number(item?.quantity) || 0), 0),
  }
}

function matchesFilter(order, filterKey) {
  if (filterKey === 'all') return true
  return getOrderStatusMeta(order).filterKey === filterKey
}

function OrderActionButtons({ order, onGoProducts }) {
  const status = getOrderStatusMeta(order)

  if (status.filterKey === 'shipped' || status.filterKey === 'delivered') {
    return (
      <>
        <button type="button" style={actionButtonStyle(true)} onClick={() => alert('리뷰 기능은 추후 구현 예정입니다.')}>리뷰쓰기</button>
        <button type="button" style={actionButtonStyle()} onClick={() => alert('장바구니 담기 기능은 추후 구현 예정입니다.')}>장바구니 담기</button>
        <button type="button" style={actionButtonStyle()} onClick={onGoProducts}>바로구매</button>
      </>
    )
  }

  if (status.filterKey === 'cancelled') {
    return (
      <>
        <button type="button" style={actionButtonStyle(true)} onClick={onGoProducts}>다른 상품보기</button>
        <button type="button" style={actionButtonStyle()} onClick={() => alert('장바구니 담기 기능은 추후 구현 예정입니다.')}>장바구니 담기</button>
        <button type="button" style={actionButtonStyle()} onClick={onGoProducts}>바로구매</button>
      </>
    )
  }

  return (
    <>
      <button type="button" style={actionButtonStyle()} onClick={() => alert('취소 요청 기능은 추후 구현 예정입니다.')}>취소요청</button>
      <button type="button" style={actionButtonStyle()} onClick={() => alert('배송지 변경 기능은 추후 구현 예정입니다.')}>배송지 변경</button>
      <button type="button" style={actionButtonStyle()} onClick={() => alert('배송 정보 조회 기능은 추후 구현 예정입니다.')}>배송정보</button>
    </>
  )
}

function actionButtonStyle(isPrimary = false) {
  return {
    flex: 1,
    minWidth: 0,
    padding: '11px 12px',
    borderRadius: 10,
    border: `1px solid ${isPrimary ? '#10b981' : '#d1d5db'}`,
    background: isPrimary ? '#f0fdf4' : '#fff',
    color: isPrimary ? '#047857' : '#374151',
    fontWeight: 700,
    cursor: 'pointer',
  }
}

function OrderCard({ order, onGoProducts }) {
  const preview = getOrderPreview(order)
  const status = getOrderStatusMeta(order)

  return (
    <article style={{ border: '1px solid #e5e7eb', borderRadius: 18, background: '#fff', padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 6 }}>{formatDate(order?.createdAt)} 주문</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <strong style={{ fontSize: 18, color: '#111827' }}>{order?.orderNumber || '주문번호 확인중'}</strong>
            <span style={{ padding: '4px 10px', borderRadius: 999, fontSize: 12, fontWeight: 800, color: status.color, background: status.bg, border: `1px solid ${status.border}` }}>
              {status.label}
            </span>
          </div>
        </div>
        <button type="button" onClick={() => alert('판매자 문의 기능은 추후 구현 예정입니다.')} style={{ border: 0, background: 'transparent', color: '#6b7280', cursor: 'pointer', fontWeight: 700 }}>
          판매자문의 &gt;
        </button>
      </div>

      <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 16 }}>
        <div style={{ width: 88, height: 88, borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden', background: '#f9fafb', flexShrink: 0 }}>
          {preview.image ? (
            <img src={preview.image} alt={preview.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', color: '#9ca3af', fontSize: 12 }}>NO IMAGE</div>
          )}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 17, color: '#111827', marginBottom: 6 }}>{preview.title}</div>
          <div style={{ color: '#6b7280', fontSize: 14, marginBottom: 6 }}>
            {preview.summary} · 총 {preview.totalQuantity}개
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <strong style={{ fontSize: 24, color: '#111827' }}>{formatPrice(order?.finalAmount || order?.paidAmount || 0)}</strong>
            <span style={{ color: '#10b981', fontWeight: 800, fontSize: 13 }}>
              {PAYMENT_LABELS[order?.paymentMethod] || order?.paymentMethod || '결제완료'}
            </span>
          </div>
          <button type="button" onClick={() => alert('주문 상세 조회 기능은 추후 구현 예정입니다.')} style={{ marginTop: 6, border: 0, background: 'transparent', padding: 0, color: '#10b981', fontWeight: 700, cursor: 'pointer' }}>
            상세보기 &gt;
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <OrderActionButtons order={order} onGoProducts={onGoProducts} />
      </div>
    </article>
  )
}

function MyOrdersPage({ onGoHome, onGoLogin, onGoRegister, onGoAdmin, onGoCart, onGoProducts, onGoMyOrders, onLogout }) {
  const [currentUser, setCurrentUser] = useState(getStoredUser)
  const [orders, setOrders] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [searchKeyword, setSearchKeyword] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [activeFilter, setActiveFilter] = useState('all')
  const [reloadToken, setReloadToken] = useState(0)

  const userName = typeof currentUser?.name === 'string' ? currentUser.name : ''
  const isAdmin = typeof currentUser?.user_type === 'string' && currentUser.user_type.toLowerCase() === 'admin'

  useEffect(() => {
    function handleOrderStatusUpdated() {
      setReloadToken((prev) => prev + 1)
    }

    window.addEventListener('order-status-updated', handleOrderStatusUpdated)
    window.addEventListener('focus', handleOrderStatusUpdated)

    return () => {
      window.removeEventListener('order-status-updated', handleOrderStatusUpdated)
      window.removeEventListener('focus', handleOrderStatusUpdated)
    }
  }, [])

  useEffect(() => {
    const session = getValidStoredSession()

    if (!currentUser || !session) {
      clearAuthStorage()
      setCurrentUser(null)
      onGoLogin && onGoLogin()
      return
    }

    let isMounted = true

    async function fetchOrders() {
      try {
        setIsLoading(true)
        setErrorMessage('')

        const { accessToken, tokenType } = session
        const response = await fetch(`${API_BASE_URL}/orders`, {
          headers: {
            Authorization: `${tokenType} ${accessToken}`,
          },
        })

        const contentType = response.headers.get('content-type') || ''
        const rawText = await response.text()
        const data = contentType.includes('application/json') && rawText ? JSON.parse(rawText) : null

        if (!response.ok) {
          if (response.status === 401) {
            clearAuthStorage()
            if (isMounted) {
              setCurrentUser(null)
              setOrders([])
              setErrorMessage('')
            }
            onGoLogin && onGoLogin()
            return
          }

          throw new Error(data?.message || '주문 목록을 불러오지 못했습니다.')
        }

        if (isMounted) {
          setOrders(Array.isArray(data) ? data : [])
        }
      } catch (error) {
        if (isMounted) {
          setErrorMessage(error.message || '주문 조회 중 오류가 발생했습니다.')
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    fetchOrders()

    return () => {
      isMounted = false
    }
  }, [currentUser, onGoLogin, reloadToken])

  const filteredOrders = useMemo(() => {
    const keyword = searchKeyword.trim().toLowerCase()

    return orders.filter((order) => {
      if (!matchesFilter(order, activeFilter)) {
        return false
      }

      if (!keyword) {
        return true
      }

      const items = Array.isArray(order?.items) ? order.items : []
      const searchableText = [
        order?.orderNumber,
        order?.recipient?.name,
        order?.recipient?.address,
        order?.email,
        ...items.map((item) => item?.name),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      return searchableText.includes(keyword)
    })
  }, [orders, searchKeyword, activeFilter])

  const pageSize = 5
  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / pageSize))
  const safeCurrentPage = Math.min(currentPage, totalPages)
  const pageNumbers = Array.from({ length: totalPages }, (_, index) => index + 1)
  const pagedOrders = filteredOrders.slice((safeCurrentPage - 1) * pageSize, safeCurrentPage * pageSize)

  useEffect(() => {
    setCurrentPage(1)
  }, [searchKeyword, activeFilter])

  const handleLogout = () => {
    clearAuthStorage()
    setCurrentUser(null)
    onLogout && onLogout()
  }

  return (
    <div className="mall-home" style={{ background: '#f5f5f5', minHeight: '100vh', paddingBottom: 60 }}>
      <Navbar
        userName={userName}
        isAdmin={isAdmin}
        onGoHome={onGoHome}
        onGoLogin={onGoLogin}
        onGoRegister={onGoRegister}
        onLogout={handleLogout}
        onGoAdmin={onGoAdmin}
        onGoCart={onGoCart}
        onGoMyOrders={onGoMyOrders}
      />

      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '20px 16px 0' }}>
        <section style={{ background: '#fff', borderRadius: 18, padding: 20, marginBottom: 18, border: '1px solid #eceff3' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
            <h1 style={{ margin: 0, fontSize: '1.8rem', color: '#111827' }}>주문/배송내역</h1>
            <div style={{ padding: '7px 12px', borderRadius: 999, border: '1px solid #d1d5db', background: '#fff', fontSize: 13, color: '#374151', fontWeight: 700 }}>
              총 {filteredOrders.length}건
            </div>
          </div>

          <div style={{ position: 'relative', marginBottom: 14 }}>
            <input
              type="search"
              value={searchKeyword}
              onChange={(event) => setSearchKeyword(event.target.value)}
              placeholder="검색어를 입력하세요"
              style={{ width: '100%', height: 46, borderRadius: 12, border: '1px solid #e5e7eb', background: '#f9fafb', padding: '0 44px 0 14px', fontSize: 14 }}
            />
            <span style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', color: '#6b7280' }}>⌕</span>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {FILTER_OPTIONS.map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => setActiveFilter(option.key)}
                style={{
                  borderRadius: 999,
                  padding: '8px 14px',
                  border: activeFilter === option.key ? '1px solid #111827' : '1px solid #d1d5db',
                  background: activeFilter === option.key ? '#111827' : '#fff',
                  color: activeFilter === option.key ? '#fff' : '#10b981',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
        </section>

        <section style={{ display: 'grid', gap: 14 }}>
          {isLoading ? <div style={{ background: '#fff', borderRadius: 18, padding: 28, textAlign: 'center', color: '#6b7280' }}>주문 목록을 불러오는 중입니다...</div> : null}
          {!isLoading && errorMessage ? <div style={{ background: '#fff', borderRadius: 18, padding: 28, textAlign: 'center', color: '#b91c1c' }}>{errorMessage}</div> : null}
          {!isLoading && !errorMessage && pagedOrders.length === 0 ? (
            <div style={{ background: '#fff', borderRadius: 18, padding: 28, textAlign: 'center' }}>
              <p style={{ margin: '0 0 12px 0', color: '#6b7280' }}>조회된 주문 내역이 없습니다.</p>
              <button type="button" onClick={onGoProducts} style={{ border: 0, borderRadius: 10, padding: '11px 16px', background: '#0f766e', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
                상품 보러가기
              </button>
            </div>
          ) : null}
          {!isLoading && !errorMessage && pagedOrders.map((order) => (
            <OrderCard key={String(order?._id || order?.orderNumber)} order={order} onGoProducts={onGoProducts} />
          ))}
        </section>

        {!isLoading && !errorMessage && filteredOrders.length > 0 && totalPages > 1 ? (
          <div className="admin-pagination" style={{ marginTop: 24 }}>
            <button
              type="button"
              className="admin-pagination-button"
              disabled={safeCurrentPage === 1}
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
            >
              이전
            </button>

            <div className="admin-pagination-pages">
              {pageNumbers.map((pageNumber) => (
                <button
                  key={pageNumber}
                  type="button"
                  className={`admin-pagination-button${pageNumber === safeCurrentPage ? ' active' : ''}`}
                  onClick={() => setCurrentPage(pageNumber)}
                >
                  {pageNumber}
                </button>
              ))}
            </div>

            <button
              type="button"
              className="admin-pagination-button"
              disabled={safeCurrentPage === totalPages}
              onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
            >
              다음
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}

export default MyOrdersPage
