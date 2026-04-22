const cart = [];

export function addToCart(id, name, price) {
  const existing = cart.find(i => i.id === id);
  if (existing) existing.qty++;
  else cart.push({ id, name, price, qty: 1 });
  renderCart();
}

export function removeFromCart(id) {
  const idx = cart.findIndex(i => i.id === id);
  if (idx !== -1) cart.splice(idx, 1);
  renderCart();
}

export function clearCart() {
  cart.length = 0;
  renderCart();
}

export function getCart()  { return cart; }
export function getTotal() { return cart.reduce((s, i) => s + i.price * i.qty, 0); }

// ── Invoice ─────────────────────────────────────────────────────────
export function generateInvoice() {
  if (!cart.length) return null;
  const date  = new Date().toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" });
  const lines = cart.map(i => `• ${i.name} × ${i.qty}  —  ₦${fmt(i.price * i.qty)}`);
  return [
    `🧾 *INVOICE — StockFlow*`,
    `📅 ${date}`,
    `─────────────────────`,
    ...lines,
    `─────────────────────`,
    `💰 *Total: ₦${fmt(getTotal())}*`,
    ``,
    `_Powered by StockFlow_`
  ].join("\n");
}

export function shareViaWhatsApp() {
  const text = generateInvoice();
  if (text) window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
}

export async function copyInvoice(btnId) {
  const text = generateInvoice();
  if (!text) return;
  const btn = document.getElementById(btnId);
  const orig = btn?.textContent;

  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // Fallback for non-HTTPS or blocked clipboard
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.cssText = "position:fixed;opacity:0";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
  }

  if (btn) {
    btn.textContent = "Copied!";
    setTimeout(() => btn.textContent = orig, 2000);
  }
}

// ── Render ──────────────────────────────────────────────────────────
function fmt(n) { return n.toLocaleString("en-NG", { minimumFractionDigits: 2 }); }

function esc(str) {
  return String(str).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

function renderInto(listId, totalId, actionsId) {
  const list    = document.getElementById(listId);
  const total   = document.getElementById(totalId);
  const actions = document.getElementById(actionsId);
  if (!list) return;

  if (!cart.length) {
    list.innerHTML = '<p class="empty-state">Cart is empty.</p>';
    if (total)   total.textContent = "";
    if (actions) actions.classList.add("hidden");
    return;
  }

  if (actions) actions.classList.remove("hidden");
  list.innerHTML = "";

  cart.forEach(item => {
    const row = document.createElement("div");
    row.className = "cart-item";
    row.innerHTML = `
      <div class="cart-item-info">
        <span class="cart-name">${esc(item.name)}</span>
        <span class="cart-qty">× ${item.qty}</span>
      </div>
      <div class="cart-item-right">
        <span class="cart-price">₦${fmt(item.price * item.qty)}</span>
        <button class="btn-icon" title="Remove">✕</button>
      </div>
    `;
    row.querySelector("button").addEventListener("click", () => removeFromCart(item.id));
    list.appendChild(row);
  });

  if (total) total.textContent = `Total: ₦${fmt(getTotal())}`;
}

export function renderCart() {
  renderInto("cart-list",      "cart-total",      "cart-actions");
  renderInto("cart-list-desk", "cart-total-desk", "cart-actions-desk");

  const badge = document.getElementById("cart-badge");
  if (badge) {
    const count = cart.reduce((s, i) => s + i.qty, 0);
    badge.textContent = count;
    badge.classList.toggle("hidden", count === 0);
  }
}
