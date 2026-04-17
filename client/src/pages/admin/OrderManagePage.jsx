import { useEffect, useMemo, useState } from 'react'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL
  || (import.meta.env.DEV ? '/api' : 'http://localhost:5000')

const ORDER_STATUS_META = {
  ordered: { label: '주문접수', color: '#1d4ed8' },
  paid: { label: '결제완료', color: '#166534' },
  shipped: { label: '배송중', color: '#0f766e' },
  delivered: { label: '배송완료', color: '#374151' },
  cancelled: { label: '취소', color: '#b91c1c' },
}

const PAYMENT_STATUS_META = {
  pending: { label: '대기', color: '#b45309' },
  paid: { label: '결제완료', color: '#166534' },
  failed: { label: '실패', color: '#b91c1c' },
  cancelled: { label: '취소', color: '#b91c1c' },
}

const FILTER_OPTIONS = [
  { key: 'all', label: '전체' },
  { key: 'paid', label: '결제완료' },
  { key: 'shipped', label: '배송중' },
  { key: 'delivered', label: '배송완료' },
  { key: 'cancelled', label: '취소/실패' },
]

const STATUS_UPDATE_OPTIONS = [
  { key: 'ordered', label: '주문접수' },
  { key: 'paid', label: '결제완료' },
  { key: 'shipped', label: '배송중' },
  { key: 'delivered', label: '배송완료' },
  { key: 'cancelled', label: '주문취소' },
]

const AUTH_STORAGE_KEYS = ['accessToken', 'tokenType', 'currentUser', 'tokenExpiresIn', 'loginAt']

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

function formatPrice(value) {
  const amount = Number(value)
  if (!Number.isFinite(amount)) {
    return '-'
  }

  return `${amount.toLocaleString('ko-KR')}원`
}

function formatDate(value) {
  if (!value) {
    return '-'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return '-'
  }

  return date.toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

function getStatusMeta(value, metaMap, fallbackLabel) {
  const statusKey = typeof value === 'string' ? value.toLowerCase() : ''
  return metaMap[statusKey] || { label: fallbackLabel, color: '#6b7280' }
}

function getPrimaryProductSummary(order) {
  const items = Array.isArray(order?.items) ? order.items : []
  if (items.length === 0) {
    return '-'
  }

  const firstItem = items[0]
  const extraLabel = items.length > 1 ? ` 외 ${items.length - 1}건` : ''
  return `${firstItem?.name || '상품'}${extraLabel}`
}

function matchesOrderFilter(order, filterKey) {
  if (filterKey === 'all') {
    return true
  }

  const status = typeof order?.status === 'string' ? order.status.toLowerCase() : ''
  const paymentStatus = typeof order?.paymentStatus === 'string' ? order.paymentStatus.toLowerCase() : ''

  if (filterKey === 'paid') {
    return paymentStatus === 'paid' && !['shipped', 'delivered', 'cancelled'].includes(status)
  }

  if (filterKey === 'shipped') {
    return status === 'shipped'
  }

  if (filterKey === 'delivered') {
    return status === 'delivered'
  }

  if (filterKey === 'cancelled') {
    return status === 'cancelled' || ['failed', 'cancelled'].includes(paymentStatus)
  }

  return true
}

function OrderManagePage({ onRequireLogin }) {
  const [orders, setOrders] = useState([])
  const [isLoadingOrders, setIsLoadingOrders] = useState(false)
  const [orderError, setOrderError] = useState('')
  const [searchKeyword, setSearchKeyword] = useState('')
  const [activeFilter, setActiveFilter] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [reloadToken, setReloadToken] = useState(0)
  const [updatingOrderId, setUpdatingOrderId] = useState('')
  const [selectedOrderId, setSelectedOrderId] = useState('')

  useEffect(() => {
    let isMounted = true

    async function fetchOrders() {
      try {
        setIsLoadingOrders(true)
        setOrderError('')

        const session = getValidStoredSession()

        if (!session) {
          clearAuthStorage()
          if (isMounted) {
            setOrders([])
            setOrderError('로그인이 만료되었습니다. 다시 로그인해 주세요.')
          }
          onRequireLogin && onRequireLogin()
          return
        }

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
              setOrders([])
              setOrderError('로그인이 만료되었습니다. 다시 로그인해 주세요.')
            }
            onRequireLogin && onRequireLogin()
            return
          }

          throw new Error(data?.message || '주문 목록을 불러오지 못했습니다.')
        }

        if (isMounted) {
          setOrders(Array.isArray(data) ? data : [])
        }
      } catch (error) {
        if (isMounted) {
          setOrderError(error.message || '주문 목록 조회 중 오류가 발생했습니다.')
        }
      } finally {
        if (isMounted) {
          setIsLoadingOrders(false)
        }
      }
    }

    fetchOrders()

    return () => {
      isMounted = false
    }
  }, [reloadToken])

  async function handleStatusChange(orderId, nextStatus) {
    if (!orderId || !nextStatus) {
      return
    }

    try {
      const session = getValidStoredSession()
      if (!session) {
        clearAuthStorage()
        setOrderError('로그인이 만료되었습니다. 다시 로그인해 주세요.')
        onRequireLogin && onRequireLogin()
        return
      }

      setUpdatingOrderId(String(orderId))
      setOrderError('')

      const { accessToken, tokenType } = session
      const response = await fetch(`${API_BASE_URL}/orders/${orderId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `${tokenType} ${accessToken}`,
        },
        body: JSON.stringify({ status: nextStatus }),
      })

      const contentType = response.headers.get('content-type') || ''
      const rawText = await response.text()
      const data = contentType.includes('application/json') && rawText ? JSON.parse(rawText) : null

      if (!response.ok) {
        throw new Error(data?.message || '주문 상태 변경에 실패했습니다.')
      }

      setOrders((prevOrders) => prevOrders.map((order) => (
        String(order?._id) === String(orderId) ? { ...order, ...(data || {}) } : order
      )))
      window.dispatchEvent(new Event('order-status-updated'))
    } catch (error) {
      setOrderError(error.message || '주문 상태 변경 중 오류가 발생했습니다.')
    } finally {
      setUpdatingOrderId('')
    }
  }

  const filteredOrders = useMemo(() => {
    const keyword = searchKeyword.trim().toLowerCase()

    return orders.filter((order) => {
      if (!matchesOrderFilter(order, activeFilter)) {
        return false
      }

      if (!keyword) {
        return true
      }

      const items = Array.isArray(order?.items) ? order.items : []
      const searchTarget = [
        order?.orderNumber,
        order?.email,
        order?.recipient?.name,
        order?.recipient?.phone,
        order?.recipient?.address,
        order?.status,
        order?.paymentStatus,
        ...items.map((item) => item?.name),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      return searchTarget.includes(keyword)
    })
  }, [orders, searchKeyword, activeFilter])

  const filterCounts = useMemo(() => ({
    all: orders.length,
    paid: orders.filter((order) => matchesOrderFilter(order, 'paid')).length,
    shipped: orders.filter((order) => matchesOrderFilter(order, 'shipped')).length,
    delivered: orders.filter((order) => matchesOrderFilter(order, 'delivered')).length,
    cancelled: orders.filter((order) => matchesOrderFilter(order, 'cancelled')).length,
  }), [orders])

  const totalOrders = filteredOrders.length
  const pageSize = 5
  const totalPages = Math.max(1, Math.ceil(totalOrders / pageSize))
  const pageNumbers = Array.from({ length: totalPages }, (_, index) => index + 1)
  const safeCurrentPage = Math.min(currentPage, totalPages)
  const pagedOrders = filteredOrders.slice((safeCurrentPage - 1) * pageSize, safeCurrentPage * pageSize)
  const selectedOrder = orders.find((order) => String(order?._id) === String(selectedOrderId)) || null
  const selectedOrderMeta = getStatusMeta(selectedOrder?.status, ORDER_STATUS_META, selectedOrder?.status || '-')

  useEffect(() => {
    setCurrentPage(1)
  }, [searchKeyword, activeFilter])

  return (
    <>
      <div className="admin-header-row">
        <div>
          <h2 className="admin-title">주문 관리</h2>
          <p className="admin-subtitle">전체 주문 내역을 조회하고 상태를 확인하세요.</p>
        </div>

        <button type="button" className="admin-secondary-button" onClick={() => setReloadToken((prev) => prev + 1)}>
          새로고침
        </button>
      </div>

      <section className="admin-section">
        <div className="admin-section-topbar">
          <h3 className="admin-section-title" style={{ fontSize: '1.2rem' }}>주문 목록</h3>

          <label className="admin-search-box admin-search-box-inline" htmlFor="order-search">
            <span>주문번호 · 주문자 · 상품명 검색</span>
            <div className="admin-search-input-wrap">
              <span className="admin-search-icon" aria-hidden="true">⌕</span>
              <input
                id="order-search"
                type="search"
                value={searchKeyword}
                onChange={(event) => setSearchKeyword(event.target.value)}
                placeholder="검색어를 입력하세요"
              />
            </div>
          </label>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
          {FILTER_OPTIONS.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => setActiveFilter(option.key)}
              style={{
                border: activeFilter === option.key ? '1px solid #111827' : '1px solid #d1d5db',
                background: activeFilter === option.key ? '#111827' : '#fff',
                color: activeFilter === option.key ? '#fff' : '#10b981',
                borderRadius: 999,
                padding: '11px 18px',
                fontWeight: 800,
                fontSize: '1rem',
                cursor: 'pointer',
              }}
            >
              {option.label} {filterCounts[option.key]}
            </button>
          ))}
        </div>

        {!isLoadingOrders && !orderError ? (
          <p className="admin-feedback success" style={{ marginBottom: 16 }}>
            선택한 상태에서 총 {totalOrders}건의 주문이 조회되었습니다.
          </p>
        ) : null}

        {isLoadingOrders ? <p className="admin-empty-message">주문 목록을 불러오는 중입니다...</p> : null}
        {orderError ? <p className="admin-error-message">{orderError}</p> : null}
        {!isLoadingOrders && !orderError && pagedOrders.length === 0 ? (
          <p className="admin-empty-message">조회된 주문이 없습니다.</p>
        ) : null}

        {!isLoadingOrders && !orderError && pagedOrders.length > 0 ? (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>주문번호</th>
                  <th>주문일시</th>
                  <th>주문자</th>
                  <th>대표 상품</th>
                  <th>수량</th>
                  <th>결제금액</th>
                  <th>결제상태</th>
                  <th>주문상태</th>
                  <th>상세</th>
                </tr>
              </thead>
              <tbody>
                {pagedOrders.map((order) => {
                  const paymentMeta = getStatusMeta(order?.paymentStatus, PAYMENT_STATUS_META, order?.paymentStatus || '-')
                  const orderMeta = getStatusMeta(order?.status, ORDER_STATUS_META, order?.status || '-')

                  return (
                    <tr key={String(order?._id || order?.orderNumber)}>
                      <td className="admin-order-id">{order?.orderNumber || '-'}</td>
                      <td>{formatDate(order?.createdAt)}</td>
                      <td>
                        <div style={{ display: 'grid', gap: 4 }}>
                          <strong>{order?.recipient?.name || '-'}</strong>
                          <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>{order?.email || '-'}</span>
                        </div>
                      </td>
                      <td>{getPrimaryProductSummary(order)}</td>
                      <td>{Number(order?.totalQuantity) || 0}개</td>
                      <td>{formatPrice(order?.finalAmount || order?.paidAmount)}</td>
                      <td>
                        <select
                          value={String(order?.status || 'paid').toLowerCase()}
                          onChange={(event) => handleStatusChange(order?._id, event.target.value)}
                          disabled={updatingOrderId === String(order?._id)}
                          style={{
                            minWidth: 126,
                            borderRadius: 10,
                            border: `1px solid ${paymentMeta.color}`,
                            background: '#fff',
                            color: paymentMeta.color,
                            padding: '8px 10px',
                            fontWeight: 700,
                            cursor: updatingOrderId === String(order?._id) ? 'not-allowed' : 'pointer',
                          }}
                        >
                          {STATUS_UPDATE_OPTIONS.map((option) => (
                            <option key={option.key} value={option.key}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <span className="admin-status-badge" style={{ color: orderMeta.color, borderColor: orderMeta.color }}>
                          {orderMeta.label}
                        </span>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="admin-row-action-button"
                          onClick={() => setSelectedOrderId(String(order?._id || ''))}
                          style={selectedOrderId === String(order?._id || '') ? {
                            background: '#0f766e',
                            borderColor: '#0f766e',
                            color: '#ffffff',
                          } : undefined}
                        >
                          상세보기
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : null}

        {!isLoadingOrders && !orderError && totalPages > 1 ? (
          <div className="admin-pagination">
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

        {selectedOrder ? (
          <section style={{ marginTop: 24, borderTop: '1px solid #e5e7eb', paddingTop: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 16 }}>
              <h3 className="admin-section-title" style={{ margin: 0 }}>주문 상세 정보</h3>
              <button
                type="button"
                className="admin-row-action-button"
                onClick={() => setSelectedOrderId('')}
              >
                닫기
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 18 }}>
              <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 16, background: '#f9fafb' }}>
                <h4 style={{ margin: '0 0 12px 0' }}>주문자 정보</h4>
                <div style={{ display: 'grid', gap: 8, color: '#374151' }}>
                  <div><strong>주문번호</strong> : {selectedOrder?.orderNumber || '-'}</div>
                  <div><strong>주문자</strong> : {selectedOrder?.recipient?.name || '-'}</div>
                  <div><strong>이메일</strong> : {selectedOrder?.email || '-'}</div>
                  <div><strong>연락처</strong> : {selectedOrder?.recipient?.phone || '-'}</div>
                  <div><strong>주문일시</strong> : {formatDate(selectedOrder?.createdAt)}</div>
                </div>
              </div>

              <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 16, background: '#f9fafb' }}>
                <h4 style={{ margin: '0 0 12px 0' }}>배송 및 결제 정보</h4>
                <div style={{ display: 'grid', gap: 8, color: '#374151' }}>
                  <div><strong>배송지</strong> : {selectedOrder?.recipient?.address || '-'}</div>
                  <div><strong>배송 요청</strong> : {selectedOrder?.recipient?.request || '-'}</div>
                  <div><strong>총 수량</strong> : {Number(selectedOrder?.totalQuantity) || 0}개</div>
                  <div><strong>총 결제금액</strong> : {formatPrice(selectedOrder?.finalAmount || selectedOrder?.paidAmount)}</div>
                  <div><strong>결제수단</strong> : {selectedOrder?.paymentMethod || '-'}</div>
                </div>
              </div>
            </div>

            <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 16 }}>
              <h4 style={{ margin: '0 0 12px 0' }}>주문 상품</h4>
              <div style={{ display: 'grid', gap: 12 }}>
                {(Array.isArray(selectedOrder?.items) ? selectedOrder.items : []).map((item, index) => (
                  <div
                    key={`${item?.name || 'item'}-${index}`}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '76px minmax(180px, 1.5fr) minmax(150px, 1fr) minmax(130px, 1fr) minmax(90px, 0.7fr) minmax(140px, 1fr)',
                      alignItems: 'center',
                      gap: 16,
                      padding: 12,
                      border: '1px solid #f3f4f6',
                      borderRadius: 12,
                      background: '#f9fafb',
                    }}
                  >
                    <div style={{ width: 76, height: 76, borderRadius: 10, overflow: 'hidden', border: '1px solid #e5e7eb', background: '#ffffff', flexShrink: 0 }}>
                      {item?.image ? (
                        <img
                          src={item.image}
                          alt={item?.name || '상품 이미지'}
                          loading="lazy"
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      ) : (
                        <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', color: '#9ca3af', fontSize: 11 }}>
                          NO IMAGE
                        </div>
                      )}
                    </div>

                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '0.76rem', color: '#6b7280', marginBottom: 4 }}>상품명</div>
                      <div style={{ fontWeight: 700, color: '#111827' }}>{item?.name || '상품'}</div>
                      <div style={{ fontSize: '0.82rem', color: '#6b7280', marginTop: 4 }}>
                        {item?.options?.size ? `사이즈: ${item.options.size} ` : ''}
                        {item?.options?.color ? `색상: ${item.options.color}` : '-'}
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: '0.76rem', color: '#6b7280', marginBottom: 4 }}>주문일자</div>
                      <div style={{ fontWeight: 600, color: '#111827' }}>{formatDate(selectedOrder?.createdAt)}</div>
                    </div>

                    <div>
                      <div style={{ fontSize: '0.76rem', color: '#6b7280', marginBottom: 4 }}>주문상태</div>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          borderRadius: 999,
                          padding: '4px 10px',
                          border: `1px solid ${selectedOrderMeta.color}`,
                          color: selectedOrderMeta.color,
                          fontWeight: 700,
                          background: '#fff',
                        }}
                      >
                        {selectedOrderMeta.label}
                      </span>
                    </div>

                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '0.76rem', color: '#6b7280', marginBottom: 4 }}>수량</div>
                      <div style={{ fontWeight: 700, color: '#111827', whiteSpace: 'nowrap' }}>
                        {Number(item?.quantity) || 0}개
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.76rem', color: '#6b7280', marginBottom: 4 }}>금액</div>
                      <div style={{ fontWeight: 700, color: '#111827', whiteSpace: 'nowrap' }}>
                        {formatPrice((Number(item?.unitPrice) || 0) * (Number(item?.quantity) || 0))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        ) : null}
      </section>
    </>
  )
}

export default OrderManagePage
