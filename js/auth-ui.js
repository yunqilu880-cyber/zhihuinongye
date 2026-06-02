/**
 * 智慧农业 - 统一登录状态管理
 */
(function () {
  function getToken() {
    return localStorage.getItem('chase_shop_token');
  }
  function getUser() {
    try { return JSON.parse(localStorage.getItem('chase_shop_user') || 'null'); }
    catch (e) { return null; }
  }
  function isLoggedIn() {
    return !!getToken();
  }

  window.logout = function () {
    localStorage.removeItem('chase_shop_token');
    localStorage.removeItem('chase_shop_user');
    window.location.href = 'index.html';
  };

  function updateNavigation() {
    const nav = document.getElementById('navigation');
    if (!nav) return;

    const user = getUser();
    const currentPage = window.location.pathname.split('/').pop();
    const protectedPages = ['user-center.html', 'orders.html'];

    // 如果未登录且访问受保护页面，跳转登录
    if (!isLoggedIn() && protectedPages.includes(currentPage)) {
      window.location.href = 'login.html?redirect=' + encodeURIComponent(currentPage);
      return;
    }

    // 查找导航中现有的登录按钮（class="nav-cta"）
    const existingCta = nav.querySelector('.nav-cta');
    
    if (isLoggedIn() && user) {
      // 已登录：把登录按钮替换成 用户名 + 退出
      const displayName = user.name || user.username || '用户';
      if (existingCta) {
        // 替换 nav-cta 为用户名链接
        existingCta.outerHTML = `<li><a href="user-center.html">👤 ${displayName}</a></li>`;
        // 在用户名后面加退出按钮
        const userLi = nav.querySelector('a[href="user-center.html"]').parentElement;
        userLi.insertAdjacentHTML('afterend', '<li><a class="nav-cta" href="javascript:logout()">退出</a></li>');
      } else {
        // 没有 nav-cta 则追加
        nav.insertAdjacentHTML('beforeend', `<li><a href="user-center.html">👤 ${displayName}</a></li>`);
        nav.insertAdjacentHTML('beforeend', '<li><a class="nav-cta" href="javascript:logout()">退出</a></li>');
      }
    } else if (!isLoggedIn() && existingCta) {
      // 未登录，确保按钮指向登录页
      const loginHref = 'login.html?redirect=' + encodeURIComponent(currentPage);
      existingCta.href = loginHref;
      existingCta.textContent = '登录/注册';
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', updateNavigation);
  } else {
    updateNavigation();
  }

  window.ChaseAuth = { getToken, getUser, isLoggedIn, logout: window.logout, updateNavigation };
})();
