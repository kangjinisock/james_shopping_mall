import { useEffect, useMemo, useState } from 'react'
import Navbar from '../Navbar'
import ProductCreatePage from './ProductCreatePage'
import ProductManagePage from './ProductManagePage'
import OrderManagePage from './OrderManagePage'
import MemberManagePage from './MemberManagePage'

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL
  || (import.meta.env.DEV ? '/api' : 'http://localhost:5000')
).replace(/\/+$/, '')

const AUTH_STORAGE_KEYS = ['accessToken', 'tokenType', 'currentUser', 'tokenExpiresIn', 'loginAt']

const STATUS_META = {
  ordered: { label: '주문접수', color: '#1d4ed8' },
  paid: { label: '결제완료', color: '#166534' },
  shipped: { label: '배송중', color: '#0f766e' },
  delivered: { label: '배송완료', color: '#374151' },
  cancelled: { label: '취소', color: '#b91c1c' },
}

const MENU_ITEMS = ['대시보드', '회원 관리', '상품 관리', '주문 관리', '통계', '설정']

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
    return '0'
  }

  return amount.toLocaleString('ko-KR')
}

function formatGraphValue(value, unit) {
  const amount = Number(value) || 0

  if (unit === '원') {
    if (amount >= 100000000) {
      return `${Math.round(amount / 100000000)}억`
    }

    if (amount >= 10000) {
      return `${Math.round(amount / 10000)}만`
    }
  }

  return amount.toLocaleString('ko-KR')
}

function getOrderAmount(order) {
  const amount = Number(order?.finalAmount ?? order?.totalAmount ?? 0)
  return Number.isFinite(amount) ? amount : 0
}

function isSameCalendarDay(left, right) {
  return left.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth()
    && left.getDate() === right.getDate()
}

function getRecentDays(count) {
  const days = []
  const today = new Date()

  for (let offset = count - 1; offset >= 0; offset -= 1) {
    const date = new Date(today)
    date.setHours(0, 0, 0, 0)
    date.setDate(today.getDate() - offset)
    days.push(date)
  }

  return days
}

function formatDayLabel(value) {
  return `${value.getMonth() + 1}/${value.getDate()}`
}

function getPrimaryProductSummary(order) {
  const items = Array.isArray(order?.items) ? order.items : []
  if (items.length === 0) {
    return '-'
  }

  const firstItem = items[0]
  return items.length > 1 ? `${firstItem?.name || '상품'} 외 ${items.length - 1}건` : firstItem?.name || '상품'
}

async function parseResponseData(response) {
  const contentType = response.headers.get('content-type') || ''
  const rawText = await response.text()
  return contentType.includes('application/json') && rawText ? JSON.parse(rawText) : null
}

function DashboardChartCard({ title, subtitle, accent, items, unit = '' }) {
  const maxValue = Math.max(...items.map((item) => Number(item.value) || 0), 1)

  return (
    <section className="admin-chart-card">
      <div className="admin-chart-head">
        <div>
          <h3 className="admin-section-title admin-chart-title">{title}</h3>
          <p className="admin-subtitle">{subtitle}</p>
        </div>
      </div>

      <div className="admin-chart-bars">
        {items.map((item) => {
          const barHeight = Math.max(10, Math.round(((Number(item.value) || 0) / maxValue) * 100))

          return (
            <div key={`${title}-${item.label}`} className="admin-chart-bar-item">
              <span className="admin-chart-bar-value">{formatGraphValue(item.value, unit)}</span>
              <div className="admin-chart-bar-track">
                <div
                  className="admin-chart-bar-fill"
                  style={{ height: `${barHeight}%`, background: accent }}
                />
              </div>
              <span className="admin-chart-bar-label">{item.label}</span>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function AdminPage({ userName, onGoHome, onGoLogin, onGoRegister, onGoCart, onLogout }) {
  const [activeView, setActiveView] = useState('dashboard')
  const [editingProduct, setEditingProduct] = useState(null)
  const [users, setUsers] = useState([])
  const [orders, setOrders] = useState([])
  const [isLoadingDashboard, setIsLoadingDashboard] = useState(false)
  const [dashboardError, setDashboardError] = useState('')

  useEffect(() => {
    if (activeView !== 'dashboard') {
      return undefined
    }

    let isMounted = true

    async function fetchDashboardData() {
      try {
        setIsLoadingDashboard(true)
        setDashboardError('')

        const session = getValidStoredSession()
        const usersPromise = fetch(`${API_BASE_URL}/users`)
        const ordersPromise = session
          ? fetch(`${API_BASE_URL}/orders`, {
              headers: {
                Authorization: `${session.tokenType} ${session.accessToken}`,
              },
            })
          : Promise.resolve(null)

        const [usersResponse, ordersResponse] = await Promise.all([usersPromise, ordersPromise])
        const usersData = await parseResponseData(usersResponse)

        if (!usersResponse.ok) {
          throw new Error(usersData?.message || '회원 정보를 불러오지 못했습니다.')
        }

        let orderItems = []

        if (ordersResponse) {
          const orderData = await parseResponseData(ordersResponse)

          if (!ordersResponse.ok) {
            if (ordersResponse.status === 401) {
              clearAuthStorage()
              onGoLogin && onGoLogin()
              throw new Error('로그인이 만료되었습니다. 다시 로그인해 주세요.')
            }

            throw new Error(orderData?.message || '주문 정보를 불러오지 못했습니다.')
          }

          orderItems = Array.isArray(orderData) ? orderData : []
        }

        if (isMounted) {
          setUsers(Array.isArray(usersData) ? usersData : [])
          setOrders(orderItems)
        }
      } catch (error) {
        if (isMounted) {
          setDashboardError(error.message || '대시보드 데이터 조회 중 오류가 발생했습니다.')
        }
      } finally {
        if (isMounted) {
          setIsLoadingDashboard(false)
        }
      }
    }

    fetchDashboardData()

    return () => {
      isMounted = false
    }
  }, [activeView, onGoLogin])

  const dashboardStats = useMemo(() => {
    const now = new Date()

    const todayOrders = orders.filter((order) => {
      const createdAt = new Date(order?.createdAt)
      return !Number.isNaN(createdAt.getTime()) && isSameCalendarDay(createdAt, now)
    }).length

    const monthlyRevenue = orders
      .filter((order) => {
        const createdAt = new Date(order?.createdAt)
        const paymentStatus = String(order?.paymentStatus || '').toLowerCase()
        const status = String(order?.status || '').toLowerCase()

        return !Number.isNaN(createdAt.getTime())
          && createdAt.getFullYear() === now.getFullYear()
          && createdAt.getMonth() === now.getMonth()
          && paymentStatus !== 'failed'
          && paymentStatus !== 'cancelled'
          && status !== 'cancelled'
      })
      .reduce((sum, order) => sum + getOrderAmount(order), 0)

    const pendingOrders = orders.filter((order) => {
      const paymentStatus = String(order?.paymentStatus || '').toLowerCase()
      const status = String(order?.status || '').toLowerCase()
      return paymentStatus === 'pending' || status === 'ordered' || status === 'paid'
    }).length

    return [
      { label: '총 회원 수', value: users.length, unit: '명', accent: '#166534' },
      { label: '오늘 주문', value: todayOrders, unit: '건', accent: '#0f766e' },
      { label: '이번 달 매출', value: monthlyRevenue, unit: '원', accent: '#b45309' },
      { label: '처리 대기', value: pendingOrders, unit: '건', accent: '#b91c1c' },
    ]
  }, [users, orders])

  const recentOrders = useMemo(() => orders
    .slice()
    .sort((left, right) => new Date(right?.createdAt) - new Date(left?.createdAt))
    .slice(0, 5)
    .map((order) => {
      const statusKey = String(order?.status || order?.paymentStatus || '').toLowerCase()
      const statusMeta = STATUS_META[statusKey] || { label: '확인중', color: '#6b7280' }

      return {
        id: order?.orderNumber || `#${String(order?._id || '').slice(-6)}`,
        user: order?.recipient?.name || order?.email || '회원',
        product: getPrimaryProductSummary(order),
        amount: `${formatPrice(getOrderAmount(order))}원`,
        status: statusMeta.label,
        color: statusMeta.color,
      }
    }), [orders])

  const dashboardCharts = useMemo(() => {
    const recentDays = getRecentDays(7)

    const signupTrend = recentDays.map((date) => ({
      label: formatDayLabel(date),
      value: users.filter((user) => {
        const createdAt = new Date(user?.createdAt)
        return !Number.isNaN(createdAt.getTime()) && isSameCalendarDay(createdAt, date)
      }).length,
    }))

    const orderTrend = recentDays.map((date) => ({
      label: formatDayLabel(date),
      value: orders.filter((order) => {
        const createdAt = new Date(order?.createdAt)
        return !Number.isNaN(createdAt.getTime()) && isSameCalendarDay(createdAt, date)
      }).length,
    }))

    const salesTrend = recentDays.map((date) => ({
      label: formatDayLabel(date),
      value: orders
        .filter((order) => {
          const createdAt = new Date(order?.createdAt)
          const status = String(order?.status || '').toLowerCase()
          const paymentStatus = String(order?.paymentStatus || '').toLowerCase()

          return !Number.isNaN(createdAt.getTime())
            && isSameCalendarDay(createdAt, date)
            && status !== 'cancelled'
            && paymentStatus !== 'failed'
            && paymentStatus !== 'cancelled'
        })
        .reduce((sum, order) => sum + getOrderAmount(order), 0),
    }))

    const statusChart = ['ordered', 'paid', 'shipped', 'delivered', 'cancelled'].map((statusKey) => ({
      label: STATUS_META[statusKey].label,
      value: orders.filter((order) => String(order?.status || '').toLowerCase() === statusKey).length,
    }))

    return [
      {
        title: '최근 7일 신규 회원',
        subtitle: '회원 가입 추이',
        accent: '#166534',
        items: signupTrend,
        unit: '명',
      },
      {
        title: '최근 7일 주문',
        subtitle: '일별 주문 건수',
        accent: '#0f766e',
        items: orderTrend,
        unit: '건',
      },
      {
        title: '최근 7일 매출',
        subtitle: '일별 결제 합계',
        accent: '#b45309',
        items: salesTrend,
        unit: '원',
      },
      {
        title: '주문 상태 현황',
        subtitle: '현재 상태별 분포',
        accent: '#b91c1c',
        items: statusChart,
        unit: '건',
      },
    ]
  }, [users, orders])

  function handleMenuClick(item) {
    setEditingProduct(null)

    if (item === '회원 관리') {
      setActiveView('members')
      return
    }

    if (item === '상품 관리') {
      setActiveView('products')
      return
    }

    if (item === '주문 관리') {
      setActiveView('orders')
      return
    }

    setActiveView('dashboard')
  }

  function handleProductCreated() {
    setEditingProduct(null)
    setActiveView('products')
  }

  function handleProductUpdated() {
    setEditingProduct(null)
    setActiveView('products')
  }

  function renderDashboard() {
    return (
      <>
        <div className="admin-header-row">
          <div>
            <h2 className="admin-title">대시보드</h2>
            <p className="admin-subtitle">쇼핑몰 현황을 한눈에 확인하세요.</p>
          </div>
        </div>

        <div className="admin-stats-grid">
          {dashboardStats.map((stat) => (
            <div key={stat.label} className="admin-stat-card">
              <p className="admin-stat-label">{stat.label}</p>
              <p className="admin-stat-value" style={{ color: stat.accent }}>
                {formatPrice(stat.value)}
                <span className="admin-stat-unit">{stat.unit}</span>
              </p>
            </div>
          ))}
        </div>

        {isLoadingDashboard ? <p className="admin-empty-message">대시보드 데이터를 불러오는 중입니다...</p> : null}
        {dashboardError ? <p className="admin-error-message">{dashboardError}</p> : null}

        <div className="admin-charts-grid">
          {dashboardCharts.map((chart) => (
            <DashboardChartCard
              key={chart.title}
              title={chart.title}
              subtitle={chart.subtitle}
              accent={chart.accent}
              items={chart.items}
              unit={chart.unit}
            />
          ))}
        </div>

        <section className="admin-section">
          <div className="admin-section-topbar">
            <h3 className="admin-section-title">최근 주문</h3>
            <p className="admin-subtitle">최신 5건</p>
          </div>

          {recentOrders.length === 0 ? (
            <p className="admin-empty-message">최근 주문 데이터가 없습니다.</p>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>주문번호</th>
                    <th>회원</th>
                    <th>상품</th>
                    <th>금액</th>
                    <th>상태</th>
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.map((order) => (
                    <tr key={order.id}>
                      <td className="admin-order-id">{order.id}</td>
                      <td>{order.user}</td>
                      <td>{order.product}</td>
                      <td>{order.amount}</td>
                      <td>
                        <span
                          className="admin-status-badge"
                          style={{ color: order.color, borderColor: order.color }}
                        >
                          {order.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </>
    )
  }

  return (
    <div className="admin-shell">
      <Navbar
        onGoHome={onGoHome}
        onGoCart={onGoCart}
        greeting="관리자님 반갑습니다"
      />

      <div className="admin-layout">
        <aside className="admin-sidebar">
          <p className="admin-sidebar-title">관리자 메뉴</p>
          <nav>
            {MENU_ITEMS.map((item) => {
              const isActive = item === '회원 관리'
                ? activeView === 'members'
                : item === '상품 관리'
                  ? activeView === 'products' || activeView === 'create-product' || activeView === 'edit-product'
                  : item === '주문 관리'
                    ? activeView === 'orders'
                    : item === '대시보드' && activeView === 'dashboard'

              return (
                <button
                  key={item}
                  type="button"
                  className={`admin-sidebar-item${isActive ? ' active' : ''}`}
                  onClick={() => handleMenuClick(item)}
                >
                  {item}
                </button>
              )
            })}
          </nav>
        </aside>

        <main className="admin-main">
          {activeView === 'dashboard' ? renderDashboard() : null}
          {activeView === 'members' ? <MemberManagePage /> : null}
          {activeView === 'products' ? (
            <ProductManagePage
              onGoCreateProduct={() => {
                setEditingProduct(null)
                setActiveView('create-product')
              }}
              onGoEditProduct={(product) => {
                setEditingProduct(product)
                setActiveView('edit-product')
              }}
            />
          ) : null}
          {activeView === 'orders' ? <OrderManagePage onRequireLogin={onGoLogin} /> : null}
          {activeView === 'create-product' ? (
            <ProductCreatePage
              onBackToProducts={() => setActiveView('products')}
              onCreated={handleProductCreated}
            />
          ) : null}
          {activeView === 'edit-product' ? (
            <ProductCreatePage
              initialProduct={editingProduct}
              onBackToProducts={() => setActiveView('products')}
              onUpdated={handleProductUpdated}
            />
          ) : null}
        </main>
      </div>
    </div>
  )
}

export default AdminPage
