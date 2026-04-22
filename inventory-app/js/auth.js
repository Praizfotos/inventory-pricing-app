// 🔧 Change this password before deploying
const ADMIN_PASSWORD = "admin123";
const SESSION_KEY = "sf_admin";

export const isAdmin = () => sessionStorage.getItem(SESSION_KEY) === "1";

export function login(password) {
  if (password === ADMIN_PASSWORD) {
    sessionStorage.setItem(SESSION_KEY, "1");
    return true;
  }
  return false;
}

export function logout() {
  sessionStorage.removeItem(SESSION_KEY);
}
