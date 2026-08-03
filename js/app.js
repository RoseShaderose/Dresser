/* =========================================================
   ÉTAT & PERSISTANCE
   ========================================================= */
const STORAGE_KEY = "protocole_data_v1";

const SEED = {
  points: 0,
  role: "maitresse",
  categories: [
    {
      id: uid(), name: "Colliers & liens",
      items: [
        { id: uid(), name: "Collier de cuir noir", selected: false, worn: false },
        { id: uid(), name: "Ruban de soie rouge", selected: false, worn: false }
      ]
    },
    {
      id: uid(), name: "Bâillons",
      items: [
        { id: uid(), name: "Bâillon boule", selected: false, worn: false }
      ]
    },
    {
      id: uid(), name: "Menottes & entraves",
      items: [
        { id: uid(), name: "Menottes métal", selected: false, worn: false },
        { id: uid(), name: "Entraves chevilles", selected: false, worn: false }
      ]
    },
    {
      id: uid(), name: "Tenues",
      items: [
        { id: uid(), name: "Tenue noire complète", selected: false, worn: false }
      ]
    }
  ],
  tasks: [
    { id: uid(), type: "Service", description: "Masser Madame pendant 15 minutes", status: "pool" },
    { id: uid(), type: "Ménage", description: "Ranger et nettoyer la chambre", status: "pool" },
    { id: uid(), type: "Discipline", description: "Tenir la position d'attente 10 minutes", status: "pool" },
    { id: uid(), type: "Écriture", description: "Écrire une lettre de gratitude à Madame", status: "pool" }
  ],
  punishments: [
    { id: uid(), title: "Temps d'agenouillement", description: "10 minutes supplémentaires, en silence.", severity: "légère" },
    { id: uid(), title: "Lignes d'écriture", description: "Écrire 50 fois la règle enfreinte.", severity: "légère" },
    { id: uid(), title: "Retrait de privilège", description: "Suppression d'un plaisir habituel pour la journée.", severity: "moyenne" },
    { id: uid(), title: "Tâche corvée", description: "Une corvée ménagère supplémentaire, immédiate.", severity: "moyenne" }
  ],
  rewards: [
    { id: uid(), title: "Soirée film au choix du soumis", description: "", cost: 20 },
    { id: uid(), title: "Massage de 20 minutes", description: "", cost: 15 },
    { id: uid(), title: "Dessert préféré", description: "", cost: 10 },
    { id: uid(), title: "Grasse matinée", description: "", cost: 25 },
    { id: uid(), title: "Câlin prolongé au réveil", description: "", cost: 5 }
  ],
  journal: []
};

function uid(){ return Math.random().toString(36).slice(2, 10); }

function loadState(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return structuredClone(SEED);
    const parsed = JSON.parse(raw);
    return Object.assign(structuredClone(SEED), parsed);
  }catch(e){
    console.error("Lecture impossible, réinitialisation.", e);
    return structuredClone(SEED);
  }
}

let state = loadState();

function save(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  if(window.Sync && Sync.isReady()) Sync.push(state);
}

function log(text){
  state.journal.unshift({ text, time: new Date().toISOString() });
  state.journal = state.journal.slice(0, 200);
}

/* =========================================================
   UTIL
   ========================================================= */
function escapeHtml(str){
  return String(str ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
  }[c]));
}
function formatTime(iso){
  const d = new Date(iso);
  return d.toLocaleDateString("fr-FR", { day:"2-digit", month:"short" }) + " · " +
         d.toLocaleTimeString("fr-FR", { hour:"2-digit", minute:"2-digit" });
}
function showToast(msg){
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(showToast._tm);
  showToast._tm = setTimeout(() => t.classList.remove("show"), 2200);
}
function isDominante(){ return state.role === "maitresse"; }

/* =========================================================
   NAVIGATION
   ========================================================= */
document.querySelectorAll(".nav-item").forEach(btn=>{
  btn.addEventListener("click", ()=>{
    document.querySelectorAll(".nav-item").forEach(b=>b.classList.remove("active"));
    document.querySelectorAll(".view").forEach(v=>v.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById("view-"+btn.dataset.view).classList.add("active");
  });
});

document.querySelectorAll(".role-btn").forEach(btn=>{
  btn.addEventListener("click", ()=>{
    state.role = btn.dataset.role;
    save();
    document.querySelectorAll(".role-btn").forEach(b=>b.classList.remove("active"));
    btn.classList.add("active");
    renderAll();
  });
});

/* =========================================================
   MODAL HELPERS
   ========================================================= */
const overlay = document.getElementById("modalOverlay");
const modal = document.getElementById("modal");

function openModal(html, onMount){
  modal.innerHTML = html;
  overlay.classList.add("open");
  if(onMount) onMount(modal);
}
function closeModal(){
  overlay.classList.remove("open");
  modal.innerHTML = "";
}
overlay.addEventListener("click", e => { if(e.target === overlay) closeModal(); });
document.addEventListener("keydown", e => { if(e.key === "Escape") closeModal(); });

/* =========================================================
   RENDER — GARDE-ROBE
   ========================================================= */
function renderWardrobe(){
  const el = document.getElementById("categoriesList");
  if(state.categories.length === 0){
    el.innerHTML = `<p class="empty-hint">Aucune catégorie. Ajoutez-en une pour commencer l'inventaire.</p>`;
    return;
  }
  el.innerHTML = state.categories.map(cat => `
    <div class="category" data-cat="${cat.id}">
      <div class="category-head">
        <h3>${escapeHtml(cat.name)}</h3>
        <div class="category-actions">
          <button class="icon-btn" data-action="edit-cat" data-cat="${cat.id}" title="Renommer">✎</button>
          <button class="icon-btn danger" data-action="del-cat" data-cat="${cat.id}" title="Supprimer">✕</button>
        </div>
      </div>
      <div class="items-grid">
        ${cat.items.map(it => `
          <div class="item ${it.selected ? "selected" : ""} ${it.worn ? "worn" : ""}" data-action="toggle-item" data-cat="${cat.id}" data-item="${it.id}">
            <span class="item-mark">&#9829;</span>
            <span class="item-mark-worn">&#10003;</span>
            <span class="item-name">${escapeHtml(it.name)}</span>
            <button class="item-remove" data-action="del-item" data-cat="${cat.id}" data-item="${it.id}">supprimer</button>
          </div>
        `).join("")}
        <button class="add-item-btn" data-action="add-item" data-cat="${cat.id}">+ Ajouter un objet</button>
      </div>
    </div>
  `).join("");
}

document.getElementById("categoriesList").addEventListener("click", e=>{
  const t = e.target.closest("[data-action]");
  if(!t) return;
  const action = t.dataset.action;
  const cat = state.categories.find(c => c.id === t.dataset.cat);

  if(action === "toggle-item"){
    const item = cat.items.find(i => i.id === t.dataset.item);
    if(isDominante()){
      item.selected = !item.selected;
      if(item.selected) log(`Madame a choisi : ${cat.name} — ${item.name}`);
      else log(`Madame a retiré son choix : ${cat.name} — ${item.name}`);
    }else{
      item.worn = !item.worn;
      if(item.worn) log(`Le soumis porte : ${cat.name} — ${item.name}`);
      else log(`Le soumis ne porte plus : ${cat.name} — ${item.name}`);
    }
    save();
    renderWardrobe(); renderJournal();
  }
  if(action === "del-item"){
    e.stopPropagation();
    cat.items = cat.items.filter(i => i.id !== t.dataset.item);
    save(); renderWardrobe();
  }
  if(action === "add-item"){
    openModal(`
      <h3>Nouvel objet</h3>
      <div class="field"><label>Nom de l'objet</label><input id="f-name" placeholder="Ex. Collier de cuir noir" autofocus></div>
      <div class="modal-actions">
        <button class="btn-mini" id="f-cancel">Annuler</button>
        <button class="btn-mini gold" id="f-save">Ajouter</button>
      </div>
    `, m=>{
      m.querySelector("#f-cancel").onclick = closeModal;
      m.querySelector("#f-save").onclick = ()=>{
        const name = m.querySelector("#f-name").value.trim();
        if(!name) return;
        cat.items.push({ id: uid(), name, selected:false, worn:false });
        save(); renderWardrobe(); closeModal();
      };
    });
  }
  if(action === "edit-cat"){
    openModal(`
      <h3>Renommer la catégorie</h3>
      <div class="field"><label>Nom</label><input id="f-name" value="${escapeHtml(cat.name)}" autofocus></div>
      <div class="modal-actions">
        <button class="btn-mini" id="f-cancel">Annuler</button>
        <button class="btn-mini gold" id="f-save">Enregistrer</button>
      </div>
    `, m=>{
      m.querySelector("#f-cancel").onclick = closeModal;
      m.querySelector("#f-save").onclick = ()=>{
        const name = m.querySelector("#f-name").value.trim();
        if(!name) return;
        cat.name = name; save(); renderWardrobe(); closeModal();
      };
    });
  }
  if(action === "del-cat"){
    if(confirm(`Supprimer la catégorie « ${cat.name} » et tous ses objets ?`)){
      state.categories = state.categories.filter(c => c.id !== cat.id);
      save(); renderWardrobe();
    }
  }
});

document.getElementById("addCategoryBtn").addEventListener("click", ()=>{
  openModal(`
    <h3>Nouvelle catégorie</h3>
    <div class="field"><label>Nom de la catégorie</label><input id="f-name" placeholder="Ex. Accessoires" autofocus></div>
    <div class="modal-actions">
      <button class="btn-mini" id="f-cancel">Annuler</button>
      <button class="btn-mini gold" id="f-save">Créer</button>
    </div>
  `, m=>{
    m.querySelector("#f-cancel").onclick = closeModal;
    m.querySelector("#f-save").onclick = ()=>{
      const name = m.querySelector("#f-name").value.trim();
      if(!name) return;
      state.categories.push({ id: uid(), name, items: [] });
      save(); renderWardrobe(); closeModal();
    };
  });
});

/* =========================================================
   RENDER — TÂCHES
   ========================================================= */
let taskFilter = "all";
const STATUS_LABEL = { pool:"Liste", pending:"À faire", progress:"En cours", done:"Accomplie" };

function renderTasks(){
  const el = document.getElementById("tasksList");
  const list = state.tasks.filter(t => taskFilter === "all" ? true : t.status === taskFilter);
  if(list.length === 0){
    el.innerHTML = `<p class="empty-hint">Aucune tâche ici.</p>`;
    return;
  }
  el.innerHTML = list.map(t => `
    <div class="card" data-id="${t.id}">
      <div class="card-body">
        <div class="card-top">
          <span class="tag">${escapeHtml(t.type)}</span>
          <span class="tag status-${t.status}">${STATUS_LABEL[t.status]}</span>
        </div>
        <div class="card-title">${escapeHtml(t.description)}</div>
      </div>
      <div class="card-side">
        <select class="status-select" data-action="set-status" data-id="${t.id}">
          <option value="pool" ${t.status==="pool"?"selected":""}>Liste</option>
          <option value="pending" ${t.status==="pending"?"selected":""}>À faire</option>
          <option value="progress" ${t.status==="progress"?"selected":""}>En cours</option>
          <option value="done" ${t.status==="done"?"selected":""}>Accomplie</option>
        </select>
        <div class="icon-row">
          <button class="icon-btn" data-action="edit-task" data-id="${t.id}" title="Modifier">✎</button>
          <button class="icon-btn danger" data-action="del-task" data-id="${t.id}" title="Supprimer">✕</button>
        </div>
      </div>
    </div>
  `).join("");
}

document.getElementById("taskFilters").addEventListener("click", e=>{
  const chip = e.target.closest(".filter-chip");
  if(!chip) return;
  document.querySelectorAll("#taskFilters .filter-chip").forEach(c=>c.classList.remove("active"));
  chip.classList.add("active");
  taskFilter = chip.dataset.filter;
  renderTasksWithPoints();
});

function taskModal(task){
  const editing = !!task;
  openModal(`
    <h3>${editing ? "Modifier la tâche" : "Nouvelle tâche"}</h3>
    <div class="field"><label>Type</label><input id="f-type" value="${editing ? escapeHtml(task.type) : ""}" placeholder="Ex. Service, Ménage, Discipline..."></div>
    <div class="field"><label>Description</label><textarea id="f-desc" placeholder="Décrire précisément la tâche">${editing ? escapeHtml(task.description) : ""}</textarea></div>
    <div class="modal-actions">
      <button class="btn-mini" id="f-cancel">Annuler</button>
      <button class="btn-mini gold" id="f-save">${editing ? "Enregistrer" : "Assigner"}</button>
    </div>
  `, m=>{
    m.querySelector("#f-cancel").onclick = closeModal;
    m.querySelector("#f-save").onclick = ()=>{
      const type = m.querySelector("#f-type").value.trim() || "Général";
      const description = m.querySelector("#f-desc").value.trim();
      if(!description) return;
      if(editing){
        task.type = type; task.description = description;
        log(`Tâche modifiée : ${description}`);
      }else{
        state.tasks.unshift({ id: uid(), type, description, status:"pool" });
        log(`Nouvelle tâche assignée : ${description}`);
      }
      save(); renderTasksWithPoints(); renderJournal(); closeModal();
    };
  });
}

document.getElementById("addTaskBtn").addEventListener("click", ()=>taskModal(null));

document.getElementById("tasksList").addEventListener("click", e=>{
  const t = e.target.closest("[data-action]");
  if(!t) return;
  const task = state.tasks.find(x => x.id === t.dataset.id);
  if(t.dataset.action === "edit-task") taskModal(task);
  if(t.dataset.action === "del-task"){
    if(confirm("Supprimer cette tâche ?")){
      state.tasks = state.tasks.filter(x => x.id !== task.id);
      save(); renderTasksWithPoints();
    }
  }
});
document.getElementById("tasksList").addEventListener("change", e=>{
  if(e.target.dataset.action === "set-status"){
    const task = state.tasks.find(x => x.id === e.target.dataset.id);
    task.status = e.target.value;
    if(task.status === "done") log(`Tâche accomplie : ${task.description}`);
    save(); renderTasksWithPoints(); renderJournal();
  }
});

/* =========================================================
   RENDER — PUNITIONS
   ========================================================= */
function renderPunishments(){
  const el = document.getElementById("punishmentsList");
  if(state.punishments.length === 0){
    el.innerHTML = `<p class="empty-hint">Aucune punition définie.</p>`;
    return;
  }
  el.innerHTML = state.punishments.map(p => `
    <div class="card" data-id="${p.id}">
      <div class="card-body">
        <div class="card-top"><span class="tag">${escapeHtml(p.severity || "légère")}</span></div>
        <div class="card-title">${escapeHtml(p.title)}</div>
        ${p.description ? `<div class="card-desc">${escapeHtml(p.description)}</div>` : ""}
      </div>
      <div class="card-side">
        <button class="btn-mini primary" data-action="assign-pun" data-id="${p.id}">Assigner</button>
        <div class="icon-row">
          <button class="icon-btn" data-action="edit-pun" data-id="${p.id}" title="Modifier">✎</button>
          <button class="icon-btn danger" data-action="del-pun" data-id="${p.id}" title="Supprimer">✕</button>
        </div>
      </div>
    </div>
  `).join("");
}

function punishmentModal(p){
  const editing = !!p;
  openModal(`
    <h3>${editing ? "Modifier la punition" : "Nouvelle punition"}</h3>
    <div class="field"><label>Titre</label><input id="f-title" value="${editing ? escapeHtml(p.title) : ""}" placeholder="Ex. Temps d'agenouillement"></div>
    <div class="field"><label>Description</label><textarea id="f-desc" placeholder="Détails (facultatif)">${editing ? escapeHtml(p.description||"") : ""}</textarea></div>
    <div class="field"><label>Sévérité</label>
      <select id="f-sev">
        <option value="légère" ${editing && p.severity==="légère" ? "selected":""}>Légère</option>
        <option value="moyenne" ${editing && p.severity==="moyenne" ? "selected":""}>Moyenne</option>
        <option value="sévère" ${editing && p.severity==="sévère" ? "selected":""}>Sévère</option>
      </select>
    </div>
    <div class="modal-actions">
      <button class="btn-mini" id="f-cancel">Annuler</button>
      <button class="btn-mini gold" id="f-save">${editing ? "Enregistrer" : "Créer"}</button>
    </div>
  `, m=>{
    m.querySelector("#f-cancel").onclick = closeModal;
    m.querySelector("#f-save").onclick = ()=>{
      const title = m.querySelector("#f-title").value.trim();
      const description = m.querySelector("#f-desc").value.trim();
      const severity = m.querySelector("#f-sev").value;
      if(!title) return;
      if(editing){ p.title=title; p.description=description; p.severity=severity; }
      else{ state.punishments.unshift({ id: uid(), title, description, severity }); }
      save(); renderPunishments(); closeModal();
    };
  });
}

document.getElementById("addPunishmentBtn").addEventListener("click", ()=>punishmentModal(null));

document.getElementById("punishmentsList").addEventListener("click", e=>{
  const t = e.target.closest("[data-action]");
  if(!t) return;
  const p = state.punishments.find(x => x.id === t.dataset.id);
  if(t.dataset.action === "edit-pun") punishmentModal(p);
  if(t.dataset.action === "del-pun"){
    if(confirm("Supprimer cette punition ?")){
      state.punishments = state.punishments.filter(x => x.id !== p.id);
      save(); renderPunishments();
    }
  }
  if(t.dataset.action === "assign-pun"){
    log(`Punition assignée : ${p.title}`);
    save(); renderJournal();
    showToast(`Punition assignée : ${p.title}`);
  }
});

/* =========================================================
   RENDER — BOUTIQUE
   ========================================================= */
function renderShop(){
  const el = document.getElementById("shopList");
  if(state.rewards.length === 0){
    el.innerHTML = `<p class="empty-hint">Aucune récompense dans la boutique.</p>`;
    return;
  }
  el.innerHTML = state.rewards.map(r => `
    <div class="card" data-id="${r.id}">
      <div class="card-body">
        <div class="card-title">${escapeHtml(r.title)}</div>
        ${r.description ? `<div class="card-desc">${escapeHtml(r.description)}</div>` : ""}
        <div class="card-cost">${r.cost} &#9829;</div>
      </div>
      <div class="card-side">
        <button class="btn-mini gold" data-action="buy" data-id="${r.id}" ${state.points < r.cost ? "disabled style='opacity:.4;cursor:not-allowed'" : ""}>Échanger</button>
        <div class="icon-row">
          <button class="icon-btn" data-action="edit-reward" data-id="${r.id}" title="Modifier">✎</button>
          <button class="icon-btn danger" data-action="del-reward" data-id="${r.id}" title="Supprimer">✕</button>
        </div>
      </div>
    </div>
  `).join("");
}

function rewardModal(r){
  const editing = !!r;
  openModal(`
    <h3>${editing ? "Modifier la récompense" : "Nouvelle récompense"}</h3>
    <div class="field"><label>Titre</label><input id="f-title" value="${editing ? escapeHtml(r.title) : ""}" placeholder="Ex. Massage de 20 minutes"></div>
    <div class="field"><label>Description</label><textarea id="f-desc" placeholder="Détails (facultatif)">${editing ? escapeHtml(r.description||"") : ""}</textarea></div>
    <div class="field"><label>Coût en points</label><input id="f-cost" type="number" min="1" value="${editing ? r.cost : 10}"></div>
    <div class="modal-actions">
      <button class="btn-mini" id="f-cancel">Annuler</button>
      <button class="btn-mini gold" id="f-save">${editing ? "Enregistrer" : "Créer"}</button>
    </div>
  `, m=>{
    m.querySelector("#f-cancel").onclick = closeModal;
    m.querySelector("#f-save").onclick = ()=>{
      const title = m.querySelector("#f-title").value.trim();
      const description = m.querySelector("#f-desc").value.trim();
      const cost = Math.max(1, parseInt(m.querySelector("#f-cost").value) || 1);
      if(!title) return;
      if(editing){ r.title=title; r.description=description; r.cost=cost; }
      else{ state.rewards.unshift({ id: uid(), title, description, cost }); }
      save(); renderShop(); closeModal();
    };
  });
}

document.getElementById("addRewardBtn").addEventListener("click", ()=>rewardModal(null));

document.getElementById("shopList").addEventListener("click", e=>{
  const t = e.target.closest("[data-action]");
  if(!t) return;
  const r = state.rewards.find(x => x.id === t.dataset.id);
  if(t.dataset.action === "edit-reward") rewardModal(r);
  if(t.dataset.action === "del-reward"){
    if(confirm("Supprimer cette récompense ?")){
      state.rewards = state.rewards.filter(x => x.id !== r.id);
      save(); renderShop();
    }
  }
  if(t.dataset.action === "buy"){
    if(state.points < r.cost) return;
    state.points -= r.cost;
    log(`Récompense échangée : ${r.title} (-${r.cost} pts)`);
    save(); renderPoints(); renderShop(); renderJournal();
    showToast(`Récompense obtenue : ${r.title}`);
  }
});

/* =========================================================
   POINTS
   ========================================================= */
function renderPoints(){
  document.getElementById("pointsValue").textContent = state.points;
}

const POINT_STEPS = [5,10,15,50];
function buildPointBar(taskId){
  return `<div class="point-buttons">
    ${POINT_STEPS.map(s=>`<button class="point-btn" data-action="add-points" data-amount="${s}" data-task="${taskId||""}">+${s}&#9829;</button>`).join("")}
    <button class="point-btn minus" data-action="add-points" data-amount="-5" data-task="${taskId||""}">-5&#9829;</button>
  </div>`;
}

/* injecte une mini-barre de points sur chaque tâche accomplie */
function renderTasksWithPoints(){
  renderTasks();
  document.querySelectorAll("#tasksList .card").forEach(card=>{
    const id = card.dataset.id;
    const task = state.tasks.find(t=>t.id===id);
    if(task.status === "done" && isDominante()){
      const side = card.querySelector(".card-side");
      const bar = document.createElement("div");
      bar.innerHTML = buildPointBar(id);
      side.appendChild(bar.firstElementChild);
    }
  });
}

document.body.addEventListener("click", e=>{
  const t = e.target.closest('[data-action="add-points"]');
  if(!t) return;
  const amount = parseInt(t.dataset.amount);
  state.points = Math.max(0, state.points + amount);
  const task = state.tasks.find(x=>x.id===t.dataset.task);
  log(`${amount>0? "+":""}${amount} points${task ? " — " + task.description : ""}`);
  save(); renderPoints(); renderJournal(); renderShop();
  showToast(`${amount>0?"+":""}${amount} points d'obéissance`);
});

/* =========================================================
   RENDER — JOURNAL
   ========================================================= */
function renderJournal(){
  const el = document.getElementById("journalList");
  if(state.journal.length === 0){
    el.innerHTML = `<li class="journal-empty">Le journal est vide pour l'instant.</li>`;
    return;
  }
  el.innerHTML = state.journal.map(j => `
    <li><span class="j-text">${escapeHtml(j.text)}</span><span class="j-time">${formatTime(j.time)}</span></li>
  `).join("");
}

document.getElementById("clearJournalBtn").addEventListener("click", ()=>{
  if(confirm("Vider tout le journal ?")){
    state.journal = []; save(); renderJournal();
  }
});

/* =========================================================
   SYNCHRONISATION EN DIRECT + EXPORT/IMPORT DE SECOURS
   ========================================================= */
function syncStatusEl(){ return document.getElementById("syncStatus"); }

if(window.Sync){
  Sync.onStatus(text=>{
    const el = syncStatusEl();
    if(!el) return;
    el.textContent = text;
    el.classList.toggle("live", text === "Connecté" || text.startsWith("Synchronisé"));
  });

  Sync.onRemote(remoteData=>{
    if(remoteData === null){
      // rien côté serveur : on pousse l'état local pour initialiser le salon
      Sync.push(state);
      return;
    }
    state = Object.assign(structuredClone(SEED), remoteData);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    renderAll();
  });

  // reconnexion automatique si un code de salon est déjà enregistré
  const savedCode = Sync.getRoomCode();
  if(Sync.isConfigured() && savedCode){
    Sync.connect(savedCode);
  }
}

document.getElementById("syncBtn").addEventListener("click", ()=>{
  const configured = window.Sync && Sync.isConfigured();
  const currentCode = window.Sync ? Sync.getRoomCode() : "";
  const isConnected = window.Sync && Sync.isReady();

  openModal(`
    <h3>Synchronisation</h3>

    ${!configured ? `
      <p class="field" style="color:var(--ivory-dim); font-size:12.5px; line-height:1.6;">
        La synchronisation en direct n'est pas encore configurée (fichier
        <code>js/firebase-config.js</code>). Voir le README pour la mise en place
        (gratuite, ~5 minutes). En attendant, utilisez l'export/import manuel ci-dessous.
      </p>
    ` : isConnected ? `
      <p class="field" style="color:var(--brass); font-size:13px;">
        Connecté au salon « ${escapeHtml(currentCode)} ». Les deux appareils se
        synchronisent automatiquement.
      </p>
      <div class="modal-actions" style="margin-top:0; margin-bottom:18px; justify-content:flex-start;">
        <button class="btn-mini" id="f-disconnect">Se déconnecter</button>
      </div>
    ` : `
      <div class="field">
        <label>Code de salon partagé</label>
        <input id="f-room" placeholder="Ex. un mot de passe que vous inventez tous les deux" value="${escapeHtml(currentCode)}">
      </div>
      <p style="color:var(--ivory-dim); font-size:11.5px; line-height:1.5; margin-bottom:16px;">
        Entrez le <strong>même code</strong> sur les deux appareils pour qu'ils se
        synchronisent. Choisissez quelque chose de peu devinable.
      </p>
      <div class="modal-actions" style="margin-top:0; margin-bottom:18px; justify-content:flex-start;">
        <button class="btn-mini gold" id="f-connect">Se connecter</button>
      </div>
    `}

    <hr style="border:none; border-top:1px solid var(--line); margin:20px 0;">

    <div class="field">
      <label>Secours — copier les données de cet appareil</label>
      <textarea id="f-export" readonly style="min-height:100px;font-size:11px;">${escapeHtml(JSON.stringify(state))}</textarea>
    </div>
    <div class="field">
      <label>Secours — coller des données reçues (remplace tout)</label>
      <textarea id="f-import" placeholder="Coller ici le texte exporté depuis l'autre appareil"></textarea>
    </div>
    <div class="modal-actions">
      <button class="btn-mini" id="f-copy">Copier</button>
      <button class="btn-mini" id="f-cancel">Fermer</button>
      <button class="btn-mini gold" id="f-import-btn">Importer</button>
    </div>
  `, m=>{
    m.querySelector("#f-cancel").onclick = closeModal;

    const connectBtn = m.querySelector("#f-connect");
    if(connectBtn){
      connectBtn.onclick = async ()=>{
        const code = m.querySelector("#f-room").value.trim();
        if(!code) return;
        connectBtn.textContent = "Connexion…";
        const ok = await Sync.connect(code);
        if(ok){ showToast("Connecté au salon partagé"); closeModal(); }
        else showToast("Échec de connexion — vérifiez js/firebase-config.js");
      };
    }
    const disconnectBtn = m.querySelector("#f-disconnect");
    if(disconnectBtn){
      disconnectBtn.onclick = ()=>{
        Sync.disconnect();
        showToast("Synchronisation désactivée sur cet appareil");
        closeModal();
      };
    }

    m.querySelector("#f-copy").onclick = async ()=>{
      try{
        await navigator.clipboard.writeText(m.querySelector("#f-export").value);
        showToast("Copié dans le presse-papiers");
      }catch{
        m.querySelector("#f-export").select();
        showToast("Sélectionnez et copiez manuellement");
      }
    };
    m.querySelector("#f-import-btn").onclick = ()=>{
      const raw = m.querySelector("#f-import").value.trim();
      if(!raw) return;
      try{
        const parsed = JSON.parse(raw);
        state = Object.assign(structuredClone(SEED), parsed);
        save(); renderAll(); closeModal();
        showToast("Données importées");
      }catch{
        alert("Le texte collé n'est pas valide.");
      }
    };
  });
});

/* =========================================================
   INIT
   ========================================================= */
function renderAll(){
  renderWardrobe();
  renderTasksWithPoints();
  renderPunishments();
  renderShop();
  renderPoints();
  renderJournal();
  document.querySelectorAll(".role-btn").forEach(b=>{
    b.classList.toggle("active", b.dataset.role === state.role);
  });
}

renderAll();
