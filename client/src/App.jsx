import { useEffect, useState } from 'react'
import './App.css'

import MainPage from './pages/MainPage'
import RegisterPage from './pages/RegisterPage'
import LoginPage from './pages/LoginPage'
import AdminPage from './pages/admin/AdminPage'
import AllProductsPage from './pages/AllProductsPage'
import ProductDetailPage from './pages/ProductDetailPage'
import CartPage from './pages/CartPage'
import OrderPage from './pages/OrderPage'
import OrderSuccessPage from './pages/OrderSuccessPage'
import MyOrdersPage from './pages/MyOrdersPage'
import SiteFooter from './pages/SiteFooter'

// ❌ 삭제해야 함 (백엔드 코드)
// import orderRoutes from "./routes/order.js";
// app.use("/api/orders", orderRoutes);

function getPageFromPath(pathname) {
  if (pathname === '/login') return 'login'
  if (pathname === '/signup') return 'signup'
  if (pathname === '/admin') return 'admin'
  if (pathname === '/products') return 'products'
  if (pathname === '/cart') return 'cart'
  if (pathname === '/order') return 'order'
  if (pathname === '/order/success') return 'order-success'
  if (pathname === '/my-orders') return 'my-orders'
  if (/^\/products\/.+/.test(pathname)) return 'product-detail'
  return 'home'
}

function getPathFromPage(page) {
  if (page === 'login') return '/login'
  if (page === 'signup') return '/signup'
  if (page === 'admin') return '/admin'
  if (page === 'products') return '/products'
  if (page === 'cart') return '/cart'
  if (page === 'order') return '/order'
  if (page === 'order-success') return '/order/success'
  if (page === 'my-orders') return '/my-orders'
  return '/'
}

function getProductIdFromPath(pathname) {
  const match = pathname.match(/^\/products\/(.+)$/)
  return match ? match[1] : null
}

function App() {

  const [page, setPage] = useState(() => getPageFromPath(window.location.pathname))
  const [selectedProductId, setSelectedProductId] = useState(() =>
    getProductIdFromPath(window.location.pathname),
  )

  // 주문 데이터: 새로고침에도 유지
  const [orderData, setOrderData] = useState(() => {
    if (window.location.pathname === '/order') {
      const saved = sessionStorage.getItem('orderData')
      return saved ? JSON.parse(saved) : null
    }
    return null
  })

  const [completedOrder, setCompletedOrder] = useState(() => {
    if (window.location.pathname === '/order/success') {
      const saved = sessionStorage.getItem('completedOrder')
      return saved ? JSON.parse(saved) : null
    }
    return null
  })

  function navigateTo(nextPage, productId, data) {
    if (nextPage === 'product-detail' && productId) {
      const nextPath = `/products/${productId}`
      if (window.location.pathname !== nextPath) {
        window.history.pushState({}, '', nextPath)
      }
      setSelectedProductId(productId)
      setPage('product-detail')
      return
    }

    if (nextPage === 'order') {
      setOrderData(data)
      sessionStorage.setItem('orderData', JSON.stringify(data))
    }

    if (nextPage === 'order-success') {
      setCompletedOrder(data)
      sessionStorage.setItem('completedOrder', JSON.stringify(data))
    }

    const nextPath = getPathFromPage(nextPage)
    if (window.location.pathname !== nextPath) {
      window.history.pushState({}, '', nextPath)
    }

    setPage(nextPage)
  }

  useEffect(() => {
    function handlePopState() {
      const newPage = getPageFromPath(window.location.pathname)
      setPage(newPage)

      if (newPage === 'product-detail') {
        setSelectedProductId(getProductIdFromPath(window.location.pathname))
      }
      if (newPage === 'order') {
        const saved = sessionStorage.getItem('orderData')
        setOrderData(saved ? JSON.parse(saved) : null)
      }

      if (newPage === 'order-success') {
        const saved = sessionStorage.getItem('completedOrder')
        setCompletedOrder(saved ? JSON.parse(saved) : null)
      }
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  const mainClassName = [
    page === 'home' ? 'home-page-layout' : '',
    page === 'login' ? 'login-page-layout login-page-bg' : '',
    page === 'signup' ? 'signup-page-layout' : '',
    page === 'admin' ? 'admin-page-layout' : '',
    page === 'products' ? 'home-page-layout' : '',
    page === 'product-detail' ? 'home-page-layout' : '',
    page === 'cart' ? 'home-page-layout' : '',
    page === 'order' ? 'home-page-layout' : '',
    page === 'order-success' ? 'home-page-layout' : '',
    page === 'my-orders' ? 'home-page-layout' : '',
  ].filter(Boolean).join(' ')

  return (
    <main className={`app-shell ${mainClassName}`.trim()}>

      {page === 'home' && (
        <MainPage
          onGoHome={() => navigateTo('home')}
          onGoProducts={() => navigateTo('products')}
          onGoProduct={(id) => navigateTo('product-detail', id)}
          onGoRegister={() => navigateTo('signup')}
          onGoLogin={() => navigateTo('login')}
          onGoAdmin={() => navigateTo('admin')}
          onGoCart={() => navigateTo('cart')}
          onGoMyOrders={() => navigateTo('my-orders')}
        />
      )}

      {page === 'products' && (
        <AllProductsPage
          onGoHome={() => navigateTo('home')}
          onGoProduct={(id) => navigateTo('product-detail', id)}
          onGoLogin={() => navigateTo('login')}
          onGoRegister={() => navigateTo('signup')}
          onGoAdmin={() => navigateTo('admin')}
          onGoCart={() => navigateTo('cart')}
          onGoMyOrders={() => navigateTo('my-orders')}
        />
      )}

      {page === 'product-detail' && (
        <ProductDetailPage
          productId={selectedProductId}
          onGoBack={() => window.history.back()}
          onGoHome={() => navigateTo('home')}
          onGoLogin={() => navigateTo('login')}
          onGoRegister={() => navigateTo('signup')}
          onGoAdmin={() => navigateTo('admin')}
          onGoCart={() => navigateTo('cart')}
          onGoOrder={(orderDraft) => navigateTo('order', null, orderDraft)}
          onGoMyOrders={() => navigateTo('my-orders')}
        />
      )}


      {page === 'cart' && (
        <CartPage
          onGoHome={() => navigateTo('home')}
          onGoLogin={() => navigateTo('login')}
          onGoRegister={() => navigateTo('signup')}
          onGoAdmin={() => navigateTo('admin')}
          onGoCart={() => navigateTo('cart')}
          onGoOrder={(cart, user) => navigateTo('order', null, { ...cart, user })}
          onGoMyOrders={() => navigateTo('my-orders')}
        />
      )}

      {page === 'order' && (
        <OrderPage
          orderData={orderData}
          user={orderData?.user}
          onGoHome={() => navigateTo('home')}
          onGoLogin={() => navigateTo('login')}
          onGoRegister={() => navigateTo('signup')}
          onGoAdmin={() => navigateTo('admin')}
          onGoCart={() => navigateTo('cart')}
          onGoOrderSuccess={(savedOrder) => navigateTo('order-success', null, savedOrder)}
          onGoMyOrders={() => navigateTo('my-orders')}
          onLogout={() => navigateTo('home')}
        />
      )}

      {page === 'order-success' && (
        <OrderSuccessPage
          orderInfo={completedOrder}
          onGoHome={() => navigateTo('home')}
          onGoLogin={() => navigateTo('login')}
          onGoRegister={() => navigateTo('signup')}
          onGoAdmin={() => navigateTo('admin')}
          onGoCart={() => navigateTo('cart')}
          onGoProducts={() => navigateTo('products')}
          onGoMyOrders={() => navigateTo('my-orders')}
          onLogout={() => navigateTo('home')}
        />
      )}

      {page === 'my-orders' && (
        <MyOrdersPage
          onGoHome={() => navigateTo('home')}
          onGoLogin={() => navigateTo('login')}
          onGoRegister={() => navigateTo('signup')}
          onGoAdmin={() => navigateTo('admin')}
          onGoCart={() => navigateTo('cart')}
          onGoProducts={() => navigateTo('products')}
          onGoMyOrders={() => navigateTo('my-orders')}
          onLogout={() => navigateTo('home')}
        />
      )}

      {page === 'signup' && (
        <RegisterPage
          onGoHome={() => navigateTo('home')}
          onGoLogin={() => navigateTo('login')}
          onGoCart={() => navigateTo('cart')}
        />
      )}

      {page === 'login' && (
        <LoginPage
          onGoHome={() => navigateTo('home')}
          onGoRegister={() => navigateTo('signup')}
          onGoCart={() => navigateTo('cart')}
        />
      )}

      {page === 'admin' && (
        <AdminPage
          onGoHome={() => navigateTo('home')}
          onGoLogin={() => navigateTo('login')}
          onGoRegister={() => navigateTo('signup')}
          onGoAdmin={() => navigateTo('admin')}
          onGoCart={() => navigateTo('cart')}
          onLogout={() => navigateTo('home')}
        />
      )}

      <SiteFooter />
    </main>
  )
}

export default App
