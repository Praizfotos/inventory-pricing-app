import { db } from "./firebase.js";
import { isAdmin, login, logout } from "./auth.js";
import { addToCart, clearCart } from "./cart.js";
import {
  collection, addDoc, deleteDoc, doc,
  onSnapshot, serverTimestamp, query, orderBy
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ── DOM refs ────────────────────────────────────────────────────────
const form          = document.getElementById("product-form");
const nameInput     = document.getElementById("product-name");
const priceInput    = document.getElementById("product-price");
const formError     = document.getElementById("form-error");
const productList   = document.getElementById("product-list");
const adminFormWrap = document.getElementById("admin-form-wrap");
const adminPrompt   = document.getElementById("admin-prompt");
const adminBadge    = document.getElementById("admin-badge");
const loginBtn      = document.getElementById("login-btn");
const logoutBtn     = document.getElementById("logout-btn");
const loginModal    = document.getElementById("login-modal");
const passwordInput = document.getElementById("password-input");
const loginError    = document.getElementById("login-error");
const loginSubmit   = document.getElementById("login-submit");
const loginCancel   = document.getElementById("login-cancel");
const clearCartBtn  = document.getElementById("clear-cart-btn");

const productsRef = collection(db, "products");

// ── Auth UI ─────────────────────────────────────────────────────────
function applyAuthState() {
  const admin = isAdmin();
  adminFormWrap.classList.toggle("hidden", !admin);
  adminPrompt.classList.toggle("hidden", admin);
  adminBadge.classList.toggle("hidden", !admin);
  loginBtn.classList.toggle("hidden", admin);
  logoutBtn.classList.toggle("hidden", !admin);
  // Re-render list to show/hide delete buttons
  document.querySelectorAll(".product-card").forEach(el => {
    el.querySelector(".btn-danger")?.classList.toggle("hidden", !admin);
  });
}

loginBtn.addEventListener("click", () => { loginModal.classList.remove("hidden"); passwordInput.focus(); });
loginCancel.addEventListener("click", closeModal);
loginModal.addEventListener("click", (e) => { if (e.target === loginModal) closeModal(); });
loginSubmit.addEventListener("click", () => {
  if (login(passwordInput.value)) { closeModal(); applyAuthState(); }
  else { loginError.classList.remove("hidden"); passwordInput.value = ""; passwordInput.focus(); }
});
passwordInput.addEventListener("keydown", (e) => { if (e.key === "Enter") loginSubmit.click(); });
logoutBtn.addEventListener("click", () => { logout(); applyAuthState(); });

function closeModal() {
  loginModal.classList.add("hidden");
  loginError.classList.add("hidden");
  passwordInput.value = "";
}

// ── Cart ────────────────────────────────────────────────────────────
clearCartBtn.addEventListener("click", clearCart);

// ── Real-time inventory ─────────────────────────────────────────────
onSnapshot(query(productsRef, orderBy("createdAt", "desc")), (snapshot) => {
  if (snapshot.empty) { productList.innerHTML = '<p class="empty-state">No products yet.</p>'; return; }
  productList.innerHTML = "";
  snapshot.forEach((s) => renderProduct(s.id, s.data()));
}, (err) => {
  productList.innerHTML = `<p class="empty-state" style="color:var(--error)">Failed to load: ${err.message}</p>`;
});

// ── Add product ─────────────────────────────────────────────────────
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!isAdmin()) return;
  const name = nameInput.value.trim();
  const price = parseFloat(priceInput.value);
  if (!name) return showError("Product name is required.");
  if (isNaN(price) || price < 0) return showError("Enter a valid price.");
  hideError();
  try { await addDoc(productsRef, { name, price, createdAt: serverTimestamp() }); form.reset(); }
  catch (err) { showError("Failed to add product."); console.error(err); }
});

// ── Delete product ──────────────────────────────────────────────────
async function deleteProduct(id) {
  if (!isAdmin()) return;
  try { await deleteDoc(doc(db, "products", id)); }
  catch (err) { alert("Delete failed."); console.error(err); }
}

// ── Render product card ─────────────────────────────────────────────
function renderProduct(id, data) {
  const card = document.createElement("div");
  card.className = "product-card";
  card.innerHTML = `
    <div class="product-info">
      <div class="name">${escapeHtml(data.name)}</div>
      <div class="price">₦${Number(data.price).toLocaleString("en-NG", { minimumFractionDigits: 2 })}</div>
    </div>
    <div class="product-actions">
      <button class="btn btn-accent btn-sm add-btn">+ Cart</button>
      <button class="btn btn-danger btn-sm del-btn${isAdmin() ? "" : " hidden"}">Delete</button>
    </div>
  `;
  card.querySelector(".add-btn").addEventListener("click", () => addToCart(id, data.name, data.price));
  card.querySelector(".del-btn").addEventListener("click", () => deleteProduct(id));
  productList.appendChild(card);
}

function showError(msg) { formError.textContent = msg; formError.classList.remove("hidden"); }
function hideError() { formError.classList.add("hidden"); }
function escapeHtml(str) {
  return str.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

applyAuthState();
