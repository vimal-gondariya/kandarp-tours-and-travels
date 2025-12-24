function login() {
  const data = getData();
  if (user.value === data.auth.username && pass.value === data.auth.password) {
    sessionStorage.setItem("isLoggedIn", "true");
    location.href = "backoffice/index.html";
  } else {
    alert("Invalid credentials");
  }
}