/* ==========================================================
   Maison Noir — Admin
   Local Storage auth + Menu CRUD (overrides written to LS,
   read by index.html so updates appear instantly).
   ========================================================== */

const ADMIN = {USER: "admin", PASS: "admin123"};
const LS_AUTH = "mn_admin_auth";
const LS_MENU = "mn_menu_override";

const $ = (id) => document.getElementById(id);
let menu = [];
let editingId = null;

/* ---------- AUTH ---------- */
function isLoggedIn(){return localStorage.getItem(LS_AUTH) === "1";}
function adminLogin(u, p){
  if (u === ADMIN.USER && p === ADMIN.PASS){
    localStorage.setItem(LS_AUTH, "1");
    return true;
  }
  return false;
}
function adminLogout(){
  localStorage.removeItem(LS_AUTH);
  location.reload();
}

/* ---------- DATA ---------- */
async function loadMenu(){
  const override = localStorage.getItem(LS_MENU);
  if (override){
    try {menu = JSON.parse(override); return;} catch(e){}
  }
  // Try to load from same source as the public site (demo fallback)
  try {
    const mod = await fetch("script.js").then(r => r.text());
    // Quick demo extraction: eval DEMO_MENU safely via Function
    const match = mod.match(/const DEMO_MENU\s*=\s*(\[[\s\S]*?\]);/);
    if (match){
      menu = new Function(`return ${match[1]}`)();
      saveMenu();
      return;
    }
  } catch(e){}
  menu = [];
}
function saveMenu(){localStorage.setItem(LS_MENU, JSON.stringify(menu));}

/* ---------- STATS ---------- */
function renderStats(){
  $("statTotal").textContent = menu.length;
  $("statAvail").textContent = menu.filter(i => String(i.Availability).toLowerCase() === "yes").length;
  $("statUnavail").textContent = menu.filter(i => String(i.Availability).toLowerCase() !== "yes").length;
  $("statPopular").textContent = menu.filter(i => String(i.Popular).toLowerCase() === "yes").length;
}

/* ---------- TABLE ---------- */
function renderTable(){
  const q = $("adminSearch").value.trim().toLowerCase();
  const list = !q ? menu : menu.filter(i =>
    (i.FoodID||"").toLowerCase().includes(q) ||
    (i.FoodName||"").toLowerCase().includes(q) ||
    (i.Category||"").toLowerCase().includes(q)
  );

  $("adminTbody").innerHTML = list.length ? list.map(i => {
    const avail = String(i.Availability).toLowerCase() === "yes";
    const pop = String(i.Popular).toLowerCase() === "yes";
    return `
      <tr>
        <td>${i.FoodID}</td>
        <td>${i.FoodName}</td>
        <td>${i.Category}</td>
        <td>$${Number(i.Price).toFixed(2)}</td>
        <td><span class="tag ${avail ? 'ok':'no'}">${avail?'Available':'Sold Out'}</span></td>
        <td>${pop ? '<span class="tag pop">Popular</span>' : '—'}</td>
        <td>
          <div class="actions">
            <button class="icon-btn" data-act="toggle" data-id="${i.FoodID}" title="Toggle availability"><i class="fa-solid fa-power-off"></i></button>
            <button class="icon-btn" data-act="edit" data-id="${i.FoodID}" title="Edit"><i class="fa-solid fa-pen"></i></button>
            <button class="icon-btn danger" data-act="del" data-id="${i.FoodID}" title="Delete"><i class="fa-solid fa-trash"></i></button>
          </div>
        </td>
      </tr>`;
  }).join("") : `<tr><td colspan="7" style="text-align:center;color:var(--muted);padding:30px">No items.</td></tr>`;

  $("adminTbody").querySelectorAll("button[data-act]").forEach(b =>
    b.addEventListener("click", () => handleAction(b.dataset.act, b.dataset.id))
  );
  renderStats();
}

function handleAction(act, id){
  const idx = menu.findIndex(i => i.FoodID === id);
  if (idx < 0) return;
  if (act === "del"){
    if (confirm(`Delete ${menu[idx].FoodName}?`)){
      menu.splice(idx,1); saveMenu(); renderTable();
    }
  } else if (act === "toggle"){
    menu[idx].Availability = String(menu[idx].Availability).toLowerCase() === "yes" ? "No" : "Yes";
    saveMenu(); renderTable();
  } else if (act === "edit"){
    startEdit(menu[idx]);
  }
}

/* ---------- FORM ---------- */
function startEdit(item){
  editingId = item.FoodID;
  $("formTitle").textContent = `Edit ${item.FoodName}`;
  $("submitBtn").textContent = "Save Changes";
  $("cancelEdit").classList.remove("hidden");
  $("f_id").value = item.FoodID;
  $("f_id").disabled = true;
  $("f_cat").value = item.Category;
  $("f_name").value = item.FoodName;
  $("f_desc").value = item.Description || "";
  $("f_price").value = item.Price;
  $("f_disc").value = item.Discount || 0;
  $("f_vat").value = item.VAT || 0;
  $("f_img").value = item.ImageURL || "";
  $("f_avail").checked = String(item.Availability).toLowerCase() === "yes";
  $("f_pop").checked = String(item.Popular).toLowerCase() === "yes";
  window.scrollTo({top:0,behavior:"smooth"});
}
function resetForm(){
  editingId = null;
  $("itemForm").reset();
  $("f_id").disabled = false;
  $("formTitle").textContent = "Add New Item";
  $("submitBtn").textContent = "Add Item";
  $("cancelEdit").classList.add("hidden");
  $("f_vat").value = 10;
}
function submitForm(e){
  e.preventDefault();
  const data = {
    FoodID: $("f_id").value.trim(),
    Category: $("f_cat").value,
    FoodName: $("f_name").value.trim(),
    Description: $("f_desc").value.trim(),
    Price: Number($("f_price").value),
    Discount: Number($("f_disc").value) || 0,
    VAT: Number($("f_vat").value) || 0,
    ImageURL: $("f_img").value.trim(),
    Availability: $("f_avail").checked ? "Yes" : "No",
    Popular: $("f_pop").checked ? "Yes" : "No",
  };
  if (editingId){
    const idx = menu.findIndex(i => i.FoodID === editingId);
    menu[idx] = data;
  } else {
    if (menu.some(i => i.FoodID === data.FoodID)){
      alert("An item with this Food ID already exists.");
      return;
    }
    menu.unshift(data);
  }
  saveMenu(); renderTable(); resetForm();
}

/* ---------- INIT ---------- */
document.addEventListener("DOMContentLoaded", async () => {
  if (isLoggedIn()){
    $("loginWrap").classList.add("hidden");
    $("dashboard").classList.remove("hidden");
    await loadMenu();
    renderTable();
  }

  $("loginForm").addEventListener("submit", e => {
    e.preventDefault();
    const ok = adminLogin($("username").value, $("password").value);
    if (ok) location.reload();
    else $("loginError").textContent = "Invalid credentials. Try admin / admin123.";
  });
  $("logoutBtn")?.addEventListener("click", adminLogout);
  $("itemForm")?.addEventListener("submit", submitForm);
  $("cancelEdit")?.addEventListener("click", resetForm);
  $("adminSearch")?.addEventListener("input", renderTable);
  $("clearOverrides")?.addEventListener("click", () => {
    if (confirm("Clear local overrides and reload Google Sheet data on the public site?")){
      localStorage.removeItem(LS_MENU);
      alert("Cleared. Refresh the public site to see Google Sheet data.");
    }
  });
});
