import { useEffect, useState } from 'react'

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL
  || (import.meta.env.DEV ? '/api' : 'http://localhost:5000')
).replace(/\/+$/, '')

const USER_TYPE_LABEL = {
  customer: '일반회원',
  seller: '판매자',
  admin: '관리자',
}

const GENDER_LABEL = {
  male: '남성',
  female: '여성',
  other: '기타',
}

function formatContact(value) {
  return value ? String(value) : '-'
}

function formatJoinDate(value) {
  if (!value) {
    return '-'
  }

  const parsedDate = new Date(value)
  if (Number.isNaN(parsedDate.getTime())) {
    return '-'
  }

  return parsedDate.toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function MemberManagePage() {
  const [users, setUsers] = useState([])
  const [currentPage, setCurrentPage] = useState(1)
  const [isLoadingUsers, setIsLoadingUsers] = useState(false)
  const [userError, setUserError] = useState('')

  const pageSize = 30
  const totalPages = Math.max(1, Math.ceil(users.length / pageSize))
  const paginatedUsers = users.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const pageNumbers = Array.from({ length: totalPages }, (_, index) => index + 1)

  useEffect(() => {
    let isMounted = true

    async function fetchUsers() {
      try {
        setIsLoadingUsers(true)
        setUserError('')

        const response = await fetch(`${API_BASE_URL}/users`)
        const contentType = response.headers.get('content-type') || ''
        const rawText = await response.text()
        const data = contentType.includes('application/json') && rawText ? JSON.parse(rawText) : null

        if (!response.ok) {
          throw new Error(data?.message || '회원 목록을 불러오지 못했습니다.')
        }

        const sortedUsers = Array.isArray(data)
          ? [...data].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
          : []

        if (isMounted) {
          setUsers(sortedUsers)
          setCurrentPage(1)
        }
      } catch (error) {
        if (isMounted) {
          setUserError(error.message || '회원 목록 조회 중 오류가 발생했습니다.')
        }
      } finally {
        if (isMounted) {
          setIsLoadingUsers(false)
        }
      }
    }

    fetchUsers()

    return () => {
      isMounted = false
    }
  }, [])

  return (
    <>
      <div className="admin-header-row">
        <div>
          <h2 className="admin-title">회원 관리</h2>
          <p className="admin-subtitle">가입일 최신순으로 전체 회원을 확인하세요.</p>
        </div>
      </div>

      <section className="admin-section">
        <div className="admin-section-topbar">
          <h3 className="admin-section-title">전체 회원 목록</h3>
          <p className="admin-subtitle">총 {users.length}명 · 페이지당 30명</p>
        </div>

        {isLoadingUsers ? <p className="admin-empty-message">회원 목록을 불러오는 중입니다...</p> : null}
        {userError ? <p className="admin-error-message">{userError}</p> : null}
        {!isLoadingUsers && !userError && users.length === 0 ? (
          <p className="admin-empty-message">가입된 회원이 없습니다.</p>
        ) : null}

        {!isLoadingUsers && !userError && users.length > 0 ? (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>이름</th>
                  <th>이메일</th>
                  <th>성별</th>
                  <th>연락처</th>
                  <th>유형</th>
                  <th>주소</th>
                  <th>가입일</th>
                </tr>
              </thead>
              <tbody>
                {paginatedUsers.map((user) => (
                  <tr key={user._id || user.email}>
                    <td>{user.name || '-'}</td>
                    <td>{user.email || '-'}</td>
                    <td>{GENDER_LABEL[user.gender] || user.gender || '-'}</td>
                    <td>{formatContact(user.phone || user.contact || user.phoneNumber)}</td>
                    <td>{USER_TYPE_LABEL[user.user_type] || user.user_type || '-'}</td>
                    <td>{user.address || '-'}</td>
                    <td>{formatJoinDate(user.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {!isLoadingUsers && !userError && users.length > pageSize ? (
          <div className="admin-pagination">
            <button
              type="button"
              className="admin-pagination-button"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
            >
              이전
            </button>

            <div className="admin-pagination-pages">
              {pageNumbers.map((pageNumber) => (
                <button
                  key={pageNumber}
                  type="button"
                  className={`admin-pagination-button${pageNumber === currentPage ? ' active' : ''}`}
                  onClick={() => setCurrentPage(pageNumber)}
                >
                  {pageNumber}
                </button>
              ))}
            </div>

            <button
              type="button"
              className="admin-pagination-button"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
            >
              다음
            </button>
          </div>
        ) : null}
      </section>
    </>
  )
}

export default MemberManagePage
