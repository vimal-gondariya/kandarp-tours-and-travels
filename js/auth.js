function login() {
  const data = getData();
  const userEl = document.getElementById('user');
  const passEl = document.getElementById('pass');
  const remember = (document.getElementById('rememberMe')||{}).checked;
  const msg = document.getElementById('loginMessage');
  if (!userEl || !passEl) return alert('Login form not found');
  const username = userEl.value.trim();
  const password = passEl.value;
  if (!username || !password) {
    if (msg) { msg.style.display='block'; msg.textContent = 'Enter email and password'; }
    return;
  }
  if (username === data.auth.username && password === data.auth.password) {
    // store session in sessionStorage only (no persistent localStorage)
    sessionStorage.setItem('isLoggedIn', 'true');
    // clear any message and redirect
    if (msg) { msg.style.display='none'; msg.textContent=''; }
    location.href = 'backoffice/index.html';
  } else {
    if (msg) { msg.style.display='block'; msg.textContent = 'Invalid credentials'; }
  }
}