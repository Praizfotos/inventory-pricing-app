import { db } from "./firebase.js";
import { isAdmin, login, logout } from "./auth.js";
import { addToCart, clearCart, shareViaWhatsApp, copyInvoice } from "./cart.js";
import {
  collection, addDoc, deleteDoc, doc,
  onSnapshot, serverTimestamp, query, orderBy
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ── DOM ─────────────────────────────────────────────────────────────
const form          = document.getElementById("product-form");
const nameInput     = document.getElementById("product-name");
const priceInput    = document.getElementById("product-price");
const formError     = document.getElementById("form-error");
const submitBtn     = form.querySelector("button[type=submit]");
const productList   = document.getElementById("product-list");
const productCount  = document.getElementById("product-count");
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
const cartToggle    = document.getElementById("cart-toggle-btn");
const cartDrawer    = document.getElementById("cart-drawer");
const cartOverlay   = document.getElementById("cart-overlay");
const closeDrawer   = document.getElementById("close-drawer-btn");

const productsRef = collection(db, "products");

// ── Auth ─────────────────────────────────────────────────────────────
function applyAuthState() {
  const admin = isAdmin();
  adminFormWrap.classList.toggle("hidden", !admin);
  adminPrompt.classList.toggle("hidden", admin);
  adminBadge.classList.toggle("hidden", !admin);
  loginBtn.classList.toggle("hidden", admin);
  logoutBtn.classList.toggle("hidden", !admin);
  document.querySelectorAll(".del-btn").forEach(b => b.classList.toggle("hidden", !admin));
}

loginBtn.addEventListener("click", () => { loginModal.classList.remove("hidden"); passwordInput.focus(); });
loginCancel.addEventListener("click", closeModal);
loginModal.addEventListener("click", e => { if (e.target === loginModal) closeModal(); });
loginSubmit.addEventListener("click", () => {
  if (login(passwordInput.value)) { closeModal(); applyAuthState(); }
  else { loginError.classList.remove("hidden"); passwordInput.value = ""; passwordInput.focus(); }
});
passwordInput.addEventListener("keydown", e => { if (e.key === "Enter") loginSubmit.click(); });
logoutBtn.addEventListener("click", () => { logout(); applyAuthState(); });

function closeModal() {
  loginModal.classList.add("hidden");
  loginError.classList.add("hidden");
  passwordInput.value = "";
}

// ── Drawer (mobile) ──────────────────────────────────────────────────
function openDrawer()  { cartDrawer.classList.add("open"); cartOverlay.classList.remove("hidden"); document.body.style.overflow = "hidden"; }
function closeDrawerFn() { cartDrawer.classList.remove("open"); cartOverlay.classList.add("hidden"); document.body.style.overflow = ""; }
cartToggle?.addEventListener("click", openDrawer);
closeDrawer?.addEventListener("click", closeDrawerFn);
cartOverlay?.addEventListener("click", closeDrawerFn);

// Close drawer on resize to desktop
window.addEventListener("resize", () => {
  if (window.innerWidth > 768) closeDrawerFn();
});

// ── Cart buttons ─────────────────────────────────────────────────────
document.getElementById("clear-cart-btn")?.addEventListener("click", clearCart);
document.getElementById("clear-cart-btn-desk")?.addEventListener("click", clearCart);
document.getElementById("whatsapp-btn")?.addEventListener("click", shareViaWhatsApp);
document.getElementById("whatsapp-btn-desk")?.addEventListener("click", shareViaWhatsApp);
document.getElementById("copy-invoice-btn")?.addEventListener("click", () => copyInvoice("copy-invoice-btn"));
document.getElementById("copy-invoice-btn-desk")?.addEventListener("click", () => copyInvoice("copy-invoice-btn-desk"));

// ── Inventory ────────────────────────────────────────────────────────
onSnapshot(query(productsRef, orderBy("createdAt", "desc")), snapshot => {
  const count = snapshot.size;
  productCount.textContent = `${count} item${count !== 1 ? "s" : ""}`;
  if (snapshot.empty) { productList.innerHTML = '<p class="empty-state">No products yet.</p>'; return; }
  productList.innerHTML = "";
  snapshot.forEach(s => renderProduct(s.id, s.data()));
}, err => {
  productList.innerHTML = `<p class="empty-state" style="color:var(--error)">Failed to load: ${err.message}</p>`;
  productCount.textContent = "Error";
});

// ── Add product ──────────────────────────────────────────────────────
form.addEventListener("submit", async e => {
  e.preventDefault();
  if (!isAdmin()) return;

  const name  = nameInput.value.trim();
  const price = parseFloat(priceInput.value);

  if (!name)                      return showError("Product name is required.");
  if (isNaN(price) || price < 0)  return showError("Enter a valid price (0 or more).");

  hideError();
  setSubmitting(true);
  try {
    await addDoc(productsRef, { name, price, createdAt: serverTimestamp() });
    form.reset();
    nameInput.focus();
  } catch (err) {
    showError("Failed to add product. Check your connection.");
    console.error(err);
  } finally {
    setSubmitting(false);
  }
});

function setSubmitting(loading) {
  submitBtn.disabled = loading;
  submitBtn.textContent = loading ? "Adding…" : "Add";
}

// ── Delete product ───────────────────────────────────────────────────
async function deleteProduct(id, name, btn) {
  if (!isAdmin()) return;
  if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
  btn.disabled = true;
  try { await deleteDoc(doc(db, "products", id)); }
  catch (err) { alert("Delete failed. Try again."); btn.disabled = false; console.error(err); }
}

// ── Render product card ──────────────────────────────────────────────
function renderProduct(id, data) {
  const card = document.createElement("div");
  card.className = "product-card";
  card.innerHTML = `
    <div class="product-info">
      <div class="name">${escapeHtml(data.name)}</div>
      <div class="price">₦${Number(data.price).toLocaleString("en-NG", { minimumFractionDigits: 2 })}</div>
    </div>
    <div class="product-actions">
      <button class="btn-add">+ Cart</button>
      <button class="btn btn-danger btn-sm del-btn${isAdmin() ? "" : " hidden"}">Delete</button>
    </div>
  `;
  card.querySelector(".btn-add").addEventListener("click", () => addToCart(id, data.name, data.price));
  const delBtn = card.querySelector(".del-btn");
  delBtn.addEventListener("click", () => deleteProduct(id, data.name, delBtn));
  productList.appendChild(card);
}

// ── Helpers ──────────────────────────────────────────────────────────
function showError(msg) { formError.textContent = msg; formError.classList.remove("hidden"); }
function hideError()    { formError.classList.add("hidden"); }
function escapeHtml(str) {
  return str.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

applyAuthState();
