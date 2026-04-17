function SiteFooter() {
  return (
    <footer className="mall-footer" aria-label="회사 정보">
      <div className="mall-footer-topline">
        <p className="mall-footer-cs">
          <strong>(유료)1111-1111</strong>
          <span>평일 09:00~18:00</span>
        </p>
        <nav className="mall-footer-quick-links" aria-label="고객센터 안내">
          <button type="button">고객센터</button>
          <button type="button">공지사항</button>
          <button type="button">채팅상담</button>
          <button type="button">ARS</button>
        </nav>
      </div>

      <div className="mall-footer-main">
        <div className="mall-footer-left">
          <p className="mall-footer-menu">
            <span>ABOUT</span>
            <span>회사소개</span>
            <span>매장안내</span>
            <span>입점상담</span>
            <span className="highlight">개인정보처리방침</span>
            <span>이용약관</span>
          </p>

          <p className="mall-footer-info">
            주소: 서울특별시 강남구 강남대로 599 (남산동)
            <span className="divider">|</span>
            대표이사: 강진석
            <span className="divider">|</span>
            사업자등록번호: 000-00-11111
            <span className="divider">|</span>
            통신판매업 신고번호: 강남-11111
          </p>

          <p className="mall-footer-info">
            개인정보보호책임자: 강진석
            <span className="divider">|</span>
            호스팅사업자: (주)미니비아이앤씨
            <span className="divider">|</span>
            고객센터(유료): 1111-1111
            <span className="divider">|</span>
            이메일: si_cs@gmail.com
          </p>

          <p className="mall-footer-note">
            일부 상품의 경우 (주)미니비터내셔날은 통신판매의 당사자가 아닌 통신판매중개자로서, 입점 판매자가 등록한 상품 정보 및 거래에 대해
            책임을 지지 않습니다.
          </p>

          <p className="mall-footer-copy">©2022 MINIBEE INTERNATIONAL ALL RIGHTS RESERVED</p>
        </div>

        <div className="mall-footer-right" aria-label="MINIBEE 앱 다운로드">
          <p className="mall-footer-app-title">MINIBEE MOBILE</p>
          <p className="mall-footer-app-sub">앱 다운로드</p>
          <button type="button" className="mall-footer-app-badge">
            <span>MINI</span><br></br>
            <span>BEE</span>
          </button>
        </div>
      </div>
    </footer>
  )
}

export default SiteFooter
