/* =========================================================
   ÉTAT & PERSISTANCE
   ========================================================= */
const STORAGE_KEY = "protocole_data_v1";

const SEED = {
  points: 0,
  role: "soumis",
  madamePasswordHash: null, // null = pas encore défini
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
   MOT DE PASSE MADAME (hash simple, côté client)
   ========================================================= */
async function hashPassword(pwd){
  const enc = new TextEncoder().encode(pwd + "protocole_salt_v1");
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,"0")).join("");
}

async function verifyPassword(pwd){
  if(!state.madamePasswordHash) return true; // pas encore défini
  const h = await hashPassword(pwd);
  return h === state.madamePasswordHash;
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
function isSoumis(){ return state.role === "soumis"; }

function applyRoleClass(){
  document.body.classList.toggle("role-soumis", isSoumis());
  document.body.classList.toggle("role-maitresse", isDominante());
}

/* =========================================================
   NAVIGATION
   ========================================================= */
document.querySelectorAll(".nav-item").forEach(btn=>{
  btn.addEventListener("click", ()=>{
    document.querySelectorAll(".nav-item").forEach(b=>b.classList.remove("active"));
    document.querySelectorAll(".view").forEach(v=>v.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById("view-"+btn.dataset.view).classList.add("active");
    // close mobile menu
    document.getElementById("sidebar").classList.remove("open");
    document.getElementById("sidebarOverlay").classList.remove("open");
  });
});

/* Mobile menu */
const menuToggle = document.getElementById("menuToggle");
const sidebar = document.getElementById("sidebar");
const sidebarOverlay = document.getElementById("sidebarOverlay");
if(menuToggle){
  menuToggle.addEventListener("click", ()=>{
    sidebar.classList.toggle("open");
    sidebarOverlay.classList.toggle("open");
  });
}
if(sidebarOverlay){
  sidebarOverlay.addEventListener("click", ()=>{
    sidebar.classList.remove("open");
    sidebarOverlay.classList.remove("open");
  });
}

/* Role switch with password protection */
document.querySelectorAll(".role-btn").forEach(btn=>{
  btn.addEventListener("click", async ()=>{
    const targetRole = btn.dataset.role;
    if(targetRole === state.role) return;

    if(targetRole === "maitresse"){
      // besoin du mot de passe
      if(!state.madamePasswordHash){
        // première fois : définir le mot de passe
        openModal(`
          <h3>Définir le mot de passe Madame</h3>
          <p style="color:var(--ivory-dim);font-size:13px;margin-bottom:14px;line-height:1.5;">
            Choisissez un mot de passe que seul Madame connaîtra. Le soumis ne pourra pas accéder à ce mode.
          </p>
          <div class="field"><label>Nouveau mot de passe</label><input id="f-pwd" type="password" autofocus></div>
          <div class="field"><label>Confirmer</label><input id="f-pwd2" type="password"></div>
          <div class="modal-actions">
            <button class="btn-mini" id="f-cancel">Annuler</button>
            <button class="btn-mini gold" id="f-save">Définir</button>
          </div>
        `, m=>{
          m.querySelector("#f-cancel").onclick = closeModal;
          m.querySelector("#f-save").onclick = async ()=>{
            const p1 = m.querySelector("#f-pwd").value;
            const p2 = m.querySelector("#f-pwd2").value;
            if(!p1 || p1.length < 4){ showToast("Minimum 4 caractères"); return; }
            if(p1 !== p2){ showToast("Les mots de passe ne correspondent pas"); return; }
            state.madamePasswordHash = await hashPassword(p1);
            state.role = "maitresse";
            save();
            document.querySelectorAll(".role-btn").forEach(b=>b.classList.remove("active"));
            btn.classList.add("active");
            applyRoleClass();
            renderAll();
            closeModal();
            showToast("Mot de passe Madame défini");
          };
        });
        return;
      }

      // demander le mot de passe
      openModal(`
        <h3>Accès Madame</h3>
        <p style="color:var(--ivory-dim);font-size:13px;margin-bottom:14px;">Entrez le mot de passe de Madame.</p>
        <div class="field"><label>Mot de passe</label><input id="f-pwd" type="password" autofocus></div>
        <div class="modal-actions">
          <button class="btn-mini" id="f-cancel">Annuler</button>
          <button class="btn-mini gold" id="f-ok">Entrer</button>
        </div>
      `, m=>{
        m.querySelector("#f-cancel").onclick = closeModal;
        const tryEnter = async ()=>{
          const ok = await verifyPassword(m.querySelector("#f-pwd").value);
          if(!ok){ showToast("Mot de passe incorrect"); return; }
          state.role = "maitresse";
          save();
          document.querySelectorAll(".role-btn").forEach(b=>b.classList.remove("active"));
          btn.classList.add("active");
          applyRoleClass();
          renderAll();
          closeModal();
        };
        m.querySelector("#f-ok").onclick = tryEnter;
        m.querySelector("#f-pwd").addEventListener("keydown", e=>{ if(e.key==="Enter") tryEnter(); });
      });
      return;
    }

    // passage en soumis : libre
    state.role = "soumis";
    save();
    document.querySelectorAll(".role-btn").forEach(b=>b.classList.remove("active"));
    btn.classList.add("active");
    applyRoleClass();
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
        <div class="category-actions madame-only">
          <button class="icon-btn edit-only" data-action="edit-cat" data-cat="${cat.id}" title="Renommer">✎</button>
          <button class="icon-btn danger delete-only" data-action="del-cat" data-cat="${cat.id}" title="Supprimer">✕</button>
        </div>
      </div>
      <div class="items-grid">
        ${cat.items.map(it => `
          <div class="item ${it.selected ? "selected" : ""} ${it.worn ? "worn" : ""}" data-action="toggle-item" data-cat="${cat.id}" data-item="${it.id}">
            <span class="item-mark">&#9829;</span>
            <span class="item-mark-worn">&#10003;</span>
            <span class="item-name">${escapeHtml(it.name)}</span>
            <button class="item-remove delete-only madame-only" data-action="del-item" data-cat="${cat.id}" data-item="${it.id}">supprimer</button>
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
  if(!cat) return;

  if(action === "toggle-item"){
    const item = cat.items.find(i => i.id === t.dataset.item);
    if(!item) return;
    if(isDominante()){
      item.selected = !item.selected;
      if(item.selected) log(`Madame a choisi : ${cat.name} — ${item.name}`);
      else log(`Madame a retiré son choix : ${cat.name} — ${item.name}`);
    }else{
      // soumis : uniquement le statut "porté"
      item.worn = !item.worn;
      if(item.worn) log(`Le soumis porte : ${cat.name} — ${item.name}`);
      else log(`Le soumis ne porte plus : ${cat.name} — ${item.name}`);
    }
    save();
    renderWardrobe(); renderJournal();
  }
  if(action === "del-item"){
    if(!isDominante()) return;
    e.stopPropagation();
    cat.items = cat.items.filter(i => i.id !== t.dataset.item);
    save(); renderWardrobe();
  }
  if(action === "add-item"){
    // Soumis ET Madame peuvent ajouter
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
        log(`Objet ajouté : ${cat.name} — ${name}`);
        save(); renderWardrobe(); renderJournal(); closeModal();
      };
    });
  }
  if(action === "edit-cat"){
    if(!isDominante()) return;
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
    if(!isDominante()) return;
    if(confirm(`Supprimer la catégorie « ${cat.name} » et tous ses objets ?`)){
      state.categories = state.categories.filter(c => c.id !== cat.id);
      save(); renderWardrobe();
    }
  }
});

document.getElementById("addCategoryBtn").addEventListener("click", ()=>{
  // visible seulement pour Madame via CSS, mais on autorise aussi le soumis si le bouton est forcé
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
      log(`Catégorie ajoutée : ${name}`);
      save(); renderWardrobe(); renderJournal(); closeModal();
    };
  });
});

/* =========================================================
   RENDER — TÂCHES
   ========================================================= */
let taskFilter = "all";
const STATUS_LABEL = {
  pool:"Liste",
  pending:"À faire",
  progress:"En cours",
  done:"Accomplie",
  failed:"Échec"
};

function renderTasks(){
  const el = document.getElementById("tasksList");
  const list = state.tasks.filter(t => taskFilter === "all" ? true : t.status === taskFilter);
  if(list.length === 0){
    el.innerHTML = `<p class="empty-hint">Aucune tâche ici.</p>`;
    return;
  }
  el.innerHTML = list.map(t => {
    // Options de statut selon le rôle
    let options = "";
    if(isDominante()){
      options = `
        <option value="pool" ${t.status==="pool"?"selected":""}>Liste</option>
        <option value="pending" ${t.status==="pending"?"selected":""}>À faire</option>
        <option value="progress" ${t.status==="progress"?"selected":""}>En cours</option>
        <option value="done" ${t.status==="done"?"selected":""}>Accomplie</option>
        <option value="failed" ${t.status==="failed"?"selected":""}>Échec</option>
      `;
    } else {
      // Soumis : uniquement transitions autorisées
      // Depuis pending → progress ou failed
      // Depuis progress → done ou failed
      // Autres statuts : lecture seule
      if(t.status === "pending"){
        options = `
          <option value="pending" selected>À faire</option>
          <option value="progress">En cours</option>
          <option value="failed">Échec</option>
        `;
      } else if(t.status === "progress"){
        options = `
          <option value="progress" selected>En cours</option>
          <option value="done">Accomplie</option>
          <option value="failed">Échec</option>
        `;
      } else {
        // pool, done, failed : afficher seulement le statut actuel (pas de changement)
        options = `<option value="${t.status}" selected>${STATUS_LABEL[t.status]}</option>`;
      }
    }

    return `
    <div class="card" data-id="${t.id}">
      <div class="card-body">
        <div class="card-top">
          <span class="tag">${escapeHtml(t.type)}</span>
          <span class="tag status-${t.status}">${STATUS_LABEL[t.status]}</span>
        </div>
        <div class="card-title">${escapeHtml(t.description)}</div>
      </div>
      <div class="card-side">
        <select class="status-select" data-action="set-status" data-id="${t.id}" ${(!isDominante() && (t.status==="pool"||t.status==="done"||t.status==="failed")) ? "disabled" : ""}>
          ${options}
        </select>
        <div class="icon-row madame-only">
          <button class="icon-btn edit-only" data-action="edit-task" data-id="${t.id}" title="Modifier">✎</button>
          <button class="icon-btn danger delete-only" data-action="del-task" data-id="${t.id}" title="Supprimer">✕</button>
        </div>
      </div>
    </div>
  `;
  }).join("");
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
  if(editing && !isDominante()) return; // soumis ne modifie pas
  openModal(`
    <h3>${editing ? "Modifier la tâche" : "Nouvelle tâche"}</h3>
    <div class="field"><label>Type</label><input id="f-type" value="${editing ? escapeHtml(task.type) : ""}" placeholder="Ex. Service, Ménage, Discipline..."></div>
    <div class="field"><label>Description</label><textarea id="f-desc" placeholder="Décrire précisément la tâche">${editing ? escapeHtml(task.description) : ""}</textarea></div>
    <div class="modal-actions">
      <button class="btn-mini" id="f-cancel">Annuler</button>
      <button class="btn-mini gold" id="f-save">${editing ? "Enregistrer" : "Ajouter"}</button>
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
        log(`Nouvelle tâche ajoutée : ${description}`);
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
  if(!task) return;
  if(t.dataset.action === "edit-task"){
    if(!isDominante()) return;
    taskModal(task);
  }
  if(t.dataset.action === "del-task"){
    if(!isDominante()) return;
    if(confirm("Supprimer cette tâche ?")){
      state.tasks = state.tasks.filter(x => x.id !== task.id);
      save(); renderTasksWithPoints();
    }
  }
});
document.getElementById("tasksList").addEventListener("change", e=>{
  if(e.target.dataset.action === "set-status"){
    const task = state.tasks.find(x => x.id === e.target.dataset.id);
    if(!task) return;
    const newStatus = e.target.value;

    // Contrôle des transitions pour le soumis
    if(isSoumis()){
      const allowed = {
        pending: ["progress", "failed"],
        progress: ["done", "failed"]
      };
      if(!allowed[task.status] || !allowed[task.status].includes(newStatus)){
        showToast("Action non autorisée");
        renderTasksWithPoints();
        return;
      }
    }

    task.status = newStatus;
    if(task.status === "done") log(`Tâche accomplie : ${task.description}`);
    if(task.status === "failed") log(`Tâche en échec : ${task.description}`);
    if(task.status === "progress") log(`Tâche en cours : ${task.description}`);
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
        <button class="btn-mini primary madame-only" data-action="assign-pun" data-id="${p.id}">Assigner</button>
        <div class="icon-row madame-only">
          <button class="icon-btn edit-only" data-action="edit-pun" data-id="${p.id}" title="Modifier">✎</button>
          <button class="icon-btn danger delete-only" data-action="del-pun" data-id="${p.id}" title="Supprimer">✕</button>
        </div>
      </div>
    </div>
  `).join("");
}

function punishmentModal(p){
  const editing = !!p;
  if(editing && !isDominante()) return;
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
      else{
        state.punishments.unshift({ id: uid(), title, description, severity });
        log(`Nouvelle punition ajoutée : ${title}`);
      }
      save(); renderPunishments(); renderJournal(); closeModal();
    };
  });
}

document.getElementById("addPunishmentBtn").addEventListener("click", ()=>punishmentModal(null));

document.getElementById("punishmentsList").addEventListener("click", e=>{
  const t = e.target.closest("[data-action]");
  if(!t) return;
  const p = state.punishments.find(x => x.id === t.dataset.id);
  if(!p) return;
  if(t.dataset.action === "edit-pun"){
    if(!isDominante()) return;
    punishmentModal(p);
  }
  if(t.dataset.action === "del-pun"){
    if(!isDominante()) return;
    if(confirm("Supprimer cette punition ?")){
      state.punishments = state.punishments.filter(x => x.id !== p.id);
      save(); renderPunishments();
    }
  }
  if(t.dataset.action === "assign-pun"){
    if(!isDominante()) return;
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
        <div class="icon-row madame-only">
          <button class="icon-btn edit-only" data-action="edit-reward" data-id="${r.id}" title="Modifier">✎</button>
          <button class="icon-btn danger delete-only" data-action="del-reward" data-id="${r.id}" title="Supprimer">✕</button>
        </div>
      </div>
    </div>
  `).join("");
}

function rewardModal(r){
  const editing = !!r;
  if(editing && !isDominante()) return;
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
      else{
        state.rewards.unshift({ id: uid(), title, description, cost });
        log(`Nouvelle récompense ajoutée : ${title}`);
      }
      save(); renderShop(); renderJournal(); closeModal();
    };
  });
}

document.getElementById("addRewardBtn").addEventListener("click", ()=>rewardModal(null));

document.getElementById("shopList").addEventListener("click", e=>{
  const t = e.target.closest("[data-action]");
  if(!t) return;
  const r = state.rewards.find(x => x.id === t.dataset.id);
  if(!r) return;
  if(t.dataset.action === "edit-reward"){
    if(!isDominante()) return;
    rewardModal(r);
  }
  if(t.dataset.action === "del-reward"){
    if(!isDominante()) return;
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
  return `<div class="point-buttons madame-only">
    ${POINT_STEPS.map(s=>`<button class="point-btn" data-action="add-points" data-amount="${s}" data-task="${taskId||""}">+${s}&#9829;</button>`).join("")}
    <button class="point-btn minus" data-action="add-points" data-amount="-5" data-task="${taskId||""}">-5&#9829;</button>
  </div>`;
}

function renderTasksWithPoints(){
  renderTasks();
  document.querySelectorAll("#tasksList .card").forEach(card=>{
    const id = card.dataset.id;
    const task = state.tasks.find(t=>t.id===id);
    if(task && task.status === "done" && isDominante()){
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
  if(!isDominante()) return;
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
  if(!isDominante()) return;
  if(confirm("Vider tout le journal ?")){
    state.journal = []; save(); renderJournal();
  }
});

/* =========================================================
   CHANGEMENT MOT DE PASSE MADAME (uniquement en mode Madame)
   ========================================================= */
function openChangePasswordModal(){
  if(!isDominante()) return;
  openModal(`
    <h3>Changer le mot de passe Madame</h3>
    <div class="field"><label>Mot de passe actuel</label><input id="f-old" type="password" autofocus></div>
    <div class="field"><label>Nouveau mot de passe</label><input id="f-new" type="password"></div>
    <div class="field"><label>Confirmer</label><input id="f-new2" type="password"></div>
    <div class="modal-actions">
      <button class="btn-mini" id="f-cancel">Annuler</button>
      <button class="btn-mini gold" id="f-save">Changer</button>
    </div>
  `, m=>{
    m.querySelector("#f-cancel").onclick = closeModal;
    m.querySelector("#f-save").onclick = async ()=>{
      const old = m.querySelector("#f-old").value;
      const n1 = m.querySelector("#f-new").value;
      const n2 = m.querySelector("#f-new2").value;
      if(!(await verifyPassword(old))){ showToast("Mot de passe actuel incorrect"); return; }
      if(!n1 || n1.length < 4){ showToast("Minimum 4 caractères"); return; }
      if(n1 !== n2){ showToast("Les nouveaux mots de passe ne correspondent pas"); return; }
      state.madamePasswordHash = await hashPassword(n1);
      save();
      closeModal();
      showToast("Mot de passe Madame mis à jour");
    };
  });
}

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
      Sync.push(state);
      return;
    }
    // conserver le rôle local (chaque appareil a son propre rôle)
    const localRole = state.role;
    state = Object.assign(structuredClone(SEED), remoteData);
    state.role = localRole; // le rôle reste local
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    renderAll();
  });

  const savedCode = Sync.getRoomCode();
  if(Sync.isConfigured() && savedCode){
    Sync.connect(savedCode);
  }
}

function openSyncModal(){
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

    ${isDominante() ? `
      <hr style="border:none; border-top:1px solid var(--line); margin:20px 0;">
      <button class="btn-mini" id="f-change-pwd" style="width:100%;margin-bottom:12px;">Changer le mot de passe Madame</button>
    ` : ""}

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

    const changePwdBtn = m.querySelector("#f-change-pwd");
    if(changePwdBtn){
      changePwdBtn.onclick = ()=>{ closeModal(); openChangePasswordModal(); };
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
        const localRole = state.role;
        state = Object.assign(structuredClone(SEED), parsed);
        state.role = localRole;
        save(); renderAll(); closeModal();
        showToast("Données importées");
      }catch{
        alert("Le texte collé n'est pas valide.");
      }
    };
  });
}

document.getElementById("syncBtn").addEventListener("click", openSyncModal);
const syncBtnMobile = document.getElementById("syncBtnMobile");
if(syncBtnMobile) syncBtnMobile.addEventListener("click", openSyncModal);

/* =========================================================
   INIT
   ========================================================= */
function renderAll(){
  applyRoleClass();
  renderWardrobe();
  renderTasksWithPoints();
  renderPunishments();
  renderShop();
  renderPoints();
  renderJournal();
  document.querySelectorAll(".role-btn").forEach(b=>{
    b.classList.toggle("active", b.dataset.role === state.role);
  });
  // Afficher les boutons d'ajout aussi pour le soumis
  // (les boutons + sont visibles pour les deux rôles, sauf ceux explicitement madame-only)
  // On retire la classe madame-only des boutons d'ajout pour qu'ils soient disponibles au soumis
}

// Rendre les boutons d'ajout visibles pour le soumis aussi
["addCategoryBtn","addTaskBtn","addPunishmentBtn","addRewardBtn"].forEach(id=>{
  const btn = document.getElementById(id);
  if(btn) btn.classList.remove("madame-only");
});

renderAll();
