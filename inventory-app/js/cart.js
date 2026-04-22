const cart = []; // { id, name, price, qty }

export function addToCart(id, name, price) {
  const existing = cart.find(i => i.id === id);
  if (existing) { existing.qty++; }
  else { cart.push({ id, name, price, qty: 1 }); }
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

export function getCart() { return cart; }

export function getTotal() {
  return cart.reduce((sum, i) => sum + i.price * i.qty, 0);
}

function fmt(n) { return n.toLocaleString("en-NG", { minimumFractionDigits: 2 }); }

function renderCart() {
  const section = document.getElementById("cart-section");
  const list    = document.getElementById("cart-list");
  const total   = document.getElementById("cart-total");

  if (cart.length === 0) {
    list.innerHTML = '<p class="empty-state">Cart is empty.</p>';
    total.textContent = "";
    section.classList.add("cart-empty");
    return;
  }

  section.classList.remove("cart-empty");
  list.innerHTML = "";
  cart.forEach(item => {
    const row = document.createElement("div");
    row.className = "cart-item";
    row.innerHTML = `
      <div class="cart-item-info">
        <span class="cart-name">${item.name}</span>
        <span class="cart-qty">× ${item.qty}</span>
      </div>
      <div class="cart-item-right">
        <span class="cart-price">₦${fmt(item.price * item.qty)}</span>
        <button class="btn btn-icon" data-id="${item.id}" title="Remove">✕</button>
      </div>
    `;
    row.querySelector("button").addEventListener("click", () => removeFromCart(item.id));
    list.appendChild(row);
  });

  total.textContent = `Total: ₦${fmt(getTotal())}`;
}
