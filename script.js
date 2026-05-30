/* ==========================================================
   Maison Noir — Frontend logic
   - Loads menu from Google Sheets (published as CSV)
   - Search, filter, cart, animations
   ========================================================== */

/* ---------- CONFIG ----------
   1) Publish your Google Sheet:
      File → Share → Publish to the web → Entire document → CSV
   2) Copy the published URL and paste it below.
   3) Alternatively, paste your sheet ID and the script will build the URL.
--------------------------------*/
const CONFIG = {
  // Option A: Full published CSV URL (recommended)
  SHEET_CSV_URL: "",

  // Option B: Sheet ID + GID (used only if SHEET_CSV_URL is empty)
  SHEET_ID: "",
  SHEET_GID: "0",

  // Local admin overrides take precedence (so admin edits are visible immediately)
  USE_ADMIN_OVERRIDES: true,
};

/* ---------- DEMO FALLBACK ----------
   Used if no Sheet is configured yet, so the site still looks great.
-------------------------------------*/
const DEMO_MENU = [
  {FoodID:"F001",Category:"Starters",FoodName:"Truffle Garlic Bread",Description:"Toasted sourdough, black truffle butter, parmesan.",Price:9.5,Discount:0,VAT:10,ImageURL:"https://images.unsplash.com/photo-1573821663912-6df460f9c684?auto=format&fit=crop&w=600&q=80",Availability:"Yes",Popular:"Yes"},
  {FoodID:"F002",Category:"Starters",FoodName:"Burrata & Heirloom",Description:"Creamy burrata, heirloom tomatoes, basil oil.",Price:14,Discount:0,VAT:10,ImageURL:"https://images.unsplash.com/photo-1626200419199-391ae4be7a41?auto=format&fit=crop&w=600&q=80",Availability:"Yes",Popular:"No"},
  {FoodID:"F003",Category:"Main Course",FoodName:"Wagyu Ribeye",Description:"A5 wagyu, smoked sea salt, bone marrow jus.",Price:62,Discount:0,VAT:10,ImageURL:"https://images.unsplash.com/photo-1558030006-450675393462?auto=format&fit=crop&w=600&q=80",Availability:"Yes",Popular:"Yes"},
  {FoodID:"F004",Category:"Main Course",FoodName:"Duck à l'Orange",Description:"Slow-cooked duck breast, orange gastrique.",Price:38,Discount:10,VAT:10,ImageURL:"https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=600&q=80",Availability:"Yes",Popular:"No"},
  {FoodID:"F005",Category:"Seafood",FoodName:"Seared Scallops",Description:"Pan-seared scallops, cauliflower purée, caviar.",Price:34,Discount:0,VAT:10,ImageURL:"https://images.unsplash.com/photo-1599084993091-1cb5c0721cc6?auto=format&fit=crop&w=600&q=80",Availability:"Yes",Popular:"Yes"},
  {FoodID:"F006",Category:"Seafood",FoodName:"Lobster Thermidor",Description:"Maine lobster, gruyère, dijon cream.",Price:54,Discount:0,VAT:10,ImageURL:"https://images.unsplash.com/photo-1625943553852-781c6dd46faa?auto=format&fit=crop&w=600&q=80",Availability:"No",Popular:"No"},
  {FoodID:"F007",Category:"Vegetarian",FoodName:"Wild Mushroom Risotto",Description:"Carnaroli rice, porcini, aged parmesan.",Price:24,Discount:5,VAT:10,ImageURL:"https://images.unsplash.com/photo-1476124369491-e7addf5db371?auto=format&fit=crop&w=600&q=80",Availability:"Yes",Popular:"Yes"},
  {FoodID:"F008",Category:"Vegetarian",FoodName:"Roasted Cauliflower",Description:"Whole roasted cauliflower, tahini, pomegranate.",Price:19,Discount:0,VAT:10,ImageURL:"https://images.unsplash.com/photo-1606237687523-89e44f4e2c84?auto=format&fit=crop&w=600&q=80",Availability:"Yes",Popular:"No"},
  {FoodID:"F009",Category:"Desserts",FoodName:"Dark Chocolate Soufflé",Description:"Warm Valrhona soufflé, vanilla bean ice cream.",Price:14,Discount:0,VAT:10,ImageURL:"https://images.unsplash.com/photo-1551024601-bec78aea704b?auto=format&fit=crop&w=600&q=80",Availability:"Yes",Popular:"Yes"},
  {FoodID:"F010",Category:"Desserts",FoodName:"Crème Brûlée",Description:"Vanilla custard, caramelized sugar crust.",Price:11,Discount:0,VAT:10,ImageURL:"https://images.unsplash.com/photo-1470124182917-cc6e71b22ecc?auto=format&fit=crop&w=600&q=80",Availability:"Yes",Popular:"No"},
  {FoodID:"F011",Category:"Drinks",FoodName:"Vintage Bordeaux",Description:"Château Margaux 2015, by the glass.",Price:28,Discount:0,VAT:20,ImageURL:"https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?auto=format&fit=crop&w=600&q=80",Availability:"Yes",Popular:"No"},
  {FoodID:"F012",Category:"Drinks",FoodName:"Smoked Old Fashioned",Description:"Bourbon, smoked maple, orange essence.",Price:18,Discount:0,VAT:20,ImageURL:"https://images.unsplash.com/photo-1551538827-9c037cb4f32a?auto=format&fit=crop&w=600&q=80",Availability:"Yes",Popular:"Yes"},
];

/* ---------- STATE ---------- */
let MENU = [];
let activeCategory = "All";
let searchQuery = "";
const cart = JSON.parse(localStorage.getItem("mn_cart") || "[]");

/* ---------- HELPERS ---------- */
const $ = (id) => document.getElementById(id);
const money = (n) => `$${(Number(n) || 0).toFixed(2)}`;

function calculateDiscount(price, discount){return (price * (discount || 0)) / 100;}
function calculateVAT(price, vat){return (price * (vat || 0)) / 100;}
function finalPrice(item){
  const p = Number(item.Price) || 0;
  const afterDisc = p - calculateDiscount(p, Number(item.Discount));
  return afterDisc + calculateVAT(afterDisc, Number(item.VAT));
}

/* ---------- CSV PARSER (RFC 4180-ish) ---------- */
function parseCSV(text){
  const rows = [];
  let row = [], field = "", inQuotes = false;
  for (let i = 0; i < text.length; i++){
    const c = text[i];
    if (inQuotes){
      if (c === '"' && text[i+1] === '"'){field += '"'; i++;}
      else if (c === '"') inQuotes = false;
      else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ','){row.push(field); field = "";}
      else if (c === '\n'){row.push(field); rows.push(row); row = []; field = "";}
      else if (c === '\r'){/* skip */}
      else field += c;
    }
  }
  if (field.length || row.length) {row.push(field); rows.push(row);}
  if (!rows.length) return [];
  const headers = rows.shift().map(h => h.trim());
  return rows
    .filter(r => r.some(v => v && v.trim() !== ""))
    .map(r => Object.fromEntries(headers.map((h,i)=>[h,(r[i]||"").trim()])));
}

/* ---------- DATA FETCH ---------- */
async function fetchMenuData(){
  // Admin overrides
  if (CONFIG.USE_ADMIN_OVERRIDES){
    const local = localStorage.getItem("mn_menu_override");
    if (local){
      try {return JSON.parse(local);} catch(e){}
    }
  }

  let url = CONFIG.SHEET_CSV_URL;
  if (!url && CONFIG.SHEET_ID){
    url = `https://docs.google.com/spreadsheets/d/e/2PACX-1vRbJLhV0BpmS4XQXwTqSaGc7xZgBXNeKIAVYlyYUPRmDu6cfNWAWOJzAKuOSoY4utVLskq7Vf3VqEoJ/pub?output=csv}`;
  }

  if (!url){
    console.info("[Maison Noir] No Google Sheet configured — using demo data. See README_SETUP.md.");
    return DEMO_MENU;
  }

  try {
    const res = await fetch(url, {cache: "no-store"});
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    const data = parseCSV(text);
    return data.length ? data : DEMO_MENU;
  } catch(err){
    console.warn("[Maison Noir] Could not load sheet, using demo data.", err);
    return DEMO_MENU;
  }
}

/* ---------- RENDER ---------- */
function menuCard(item){
  const price = Number(item.Price) || 0;
  const discount = Number(item.Discount) || 0;
  const final = finalPrice(item);
  const available = String(item.Availability).toLowerCase() === "yes";
  const popular = String(item.Popular).toLowerCase() === "yes";

  return `
    <article class="menu-card" data-id="${item.FoodID}">
      <div class="img-wrap">
        <img src="${item.ImageURL || 'https://via.placeholder.com/600x450?text=Maison+Noir'}" alt="${item.FoodName}" loading="lazy">
        ${popular ? '<span class="badge badge-popular">Popular</span>' : ''}
        <span class="badge badge-status ${available ? '' : 'unavailable'}">${available ? 'Available' : 'Sold Out'}</span>
      </div>
      <div class="card-body">
        <div class="card-meta">
          <span class="cat">${item.Category}</span>
          <span>${item.FoodID}</span>
        </div>
        <h3>${item.FoodName}</h3>
        <p class="desc">${item.Description || ""}</p>
        <div class="price-row">
          <div>
            ${discount > 0 ? `<span class="price-old">${money(price)}</span>` : ''}
            <span class="price-final">${money(final)}</span>
          </div>
          <button class="add-btn" ${available ? '' : 'disabled'} aria-label="Add to cart"><i class="fa-solid fa-plus"></i></button>
        </div>
      </div>
    </article>
  `;
}

function renderMenu(){
  const grid = $("menuGrid");
  let items = MENU;

  if (activeCategory !== "All"){
    items = items.filter(i => (i.Category || "").toLowerCase() === activeCategory.toLowerCase());
  }
  if (searchQuery){
    const q = searchQuery.toLowerCase();
    items = items.filter(i =>
      (i.FoodName || "").toLowerCase().includes(q) ||
      (i.FoodID || "").toLowerCase().includes(q) ||
      (i.Category || "").toLowerCase().includes(q)
    );
  }

  grid.innerHTML = items.length
    ? items.map(menuCard).join("")
    : `<div class="empty">No dishes match your search.</div>`;

  // Featured
  const featured = MENU.filter(i => String(i.Popular).toLowerCase() === "yes").slice(0, 6);
  $("featuredGrid").innerHTML = featured.length
    ? featured.map(menuCard).join("")
    : `<div class="empty">No featured items yet.</div>`;

  bindCardEvents();
}

function bindCardEvents(){
  document.querySelectorAll(".menu-card .add-btn").forEach(btn => {
    btn.addEventListener("click", e => {
      const id = e.currentTarget.closest(".menu-card").dataset.id;
      addToCart(id);
    });
  });
}

/* ---------- SEARCH / FILTER ---------- */
function searchMenu(q){searchQuery = q.trim(); renderMenu();}
function filterCategory(cat){
  activeCategory = cat;
  document.querySelectorAll(".filter-btn").forEach(b => b.classList.toggle("active", b.dataset.cat === cat));
  renderMenu();
}

/* ---------- CART ---------- */
function saveCart(){localStorage.setItem("mn_cart", JSON.stringify(cart));}
function addToCart(id){
  const item = MENU.find(i => i.FoodID === id);
  if (!item) return;
  const existing = cart.find(c => c.FoodID === id);
  if (existing) existing.qty += 1;
  else cart.push({...item, qty: 1});
  saveCart(); updateCart(); openCart();
}
function removeFromCart(id){
  const i = cart.findIndex(c => c.FoodID === id);
  if (i > -1) cart.splice(i,1);
  saveCart(); updateCart();
}
function changeQty(id, delta){
  const c = cart.find(c => c.FoodID === id);
  if (!c) return;
  c.qty += delta;
  if (c.qty <= 0) removeFromCart(id);
  else {saveCart(); updateCart();}
}
function updateCart(){
  $("cartCount").textContent = cart.reduce((s,c)=>s+c.qty,0);

  if (!cart.length){
    $("cartItems").innerHTML = `<div class="cart-empty"><i class="fa-solid fa-bag-shopping" style="font-size:2rem;color:var(--gold);margin-bottom:12px"></i><p>Your cart is empty.</p></div>`;
    $("cartSummary").innerHTML = "";
    return;
  }

  $("cartItems").innerHTML = cart.map(c => `
    <div class="cart-item">
      <img src="${c.ImageURL}" alt="${c.FoodName}">
      <div class="info">
        <h5>${c.FoodName}</h5>
        <div class="ci-price">${money(finalPrice(c))}</div>
        <div class="qty">
          <button data-act="dec" data-id="${c.FoodID}">−</button>
          <span>${c.qty}</span>
          <button data-act="inc" data-id="${c.FoodID}">+</button>
        </div>
      </div>
      <button class="remove-btn" data-act="rm" data-id="${c.FoodID}"><i class="fa-solid fa-trash"></i></button>
    </div>
  `).join("");

  // Totals
  let subtotal = 0, discountTotal = 0, vatTotal = 0;
  cart.forEach(c => {
    const p = Number(c.Price) || 0;
    const d = calculateDiscount(p, Number(c.Discount));
    const v = calculateVAT(p - d, Number(c.VAT));
    subtotal += p * c.qty;
    discountTotal += d * c.qty;
    vatTotal += v * c.qty;
  });
  const grand = subtotal - discountTotal + vatTotal;

  $("cartSummary").innerHTML = `
    <div class="sum-row"><span>Subtotal</span><span>${money(subtotal)}</span></div>
    <div class="sum-row"><span>Discount</span><span>− ${money(discountTotal)}</span></div>
    <div class="sum-row"><span>VAT</span><span>${money(vatTotal)}</span></div>
    <div class="sum-row total"><span>Total</span><span>${money(grand)}</span></div>
    <button class="btn btn-gold">Checkout</button>
  `;

  // Bind item events
  $("cartItems").querySelectorAll("button[data-act]").forEach(b => {
    b.addEventListener("click", () => {
      const {act, id} = b.dataset;
      if (act === "inc") changeQty(id, 1);
      if (act === "dec") changeQty(id, -1);
      if (act === "rm") removeFromCart(id);
    });
  });
}

function openCart(){$("cartDrawer").classList.add("open"); $("cartBackdrop").classList.add("show");}
function closeCart(){$("cartDrawer").classList.remove("open"); $("cartBackdrop").classList.remove("show");}

/* ---------- INIT ---------- */
document.addEventListener("DOMContentLoaded", async () => {
  $("year").textContent = new Date().getFullYear();

  // Navbar scroll
  window.addEventListener("scroll", () => {
    $("navbar").classList.toggle("scrolled", window.scrollY > 30);
  });

  // Mobile menu
  $("hamburger").addEventListener("click", () => $("navLinks").classList.toggle("open"));
  document.querySelectorAll(".nav-links a").forEach(a =>
    a.addEventListener("click", () => $("navLinks").classList.remove("open"))
  );

  // Cart
  $("cartBtn").addEventListener("click", openCart);
  $("closeCart").addEventListener("click", closeCart);
  $("cartBackdrop").addEventListener("click", closeCart);

  // Search & filters
  $("searchInput").addEventListener("input", e => searchMenu(e.target.value));
  document.querySelectorAll(".filter-btn").forEach(b =>
    b.addEventListener("click", () => filterCategory(b.dataset.cat))
  );

  // Load data
  MENU = await fetchMenuData();
  renderMenu();
  updateCart();
});
