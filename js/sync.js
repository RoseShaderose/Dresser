/* =========================================================
   SYNCHRONISATION EN DIRECT (Firebase Firestore)
   -----------------------------------------------------------
   Fonctionne uniquement si js/firebase-config.js a été rempli
   avec de vraies clés. Sinon, toutes les fonctions ci-dessous
   sont silencieusement inactives et le site reste 100% local.
   ========================================================= */
(function(){
  const ROOM_KEY = "protocole_room_code";
  let db = null, docRef = null, unsubscribe = null, pushTimer = null;
  let ready = false;
  let applyingRemote = false;
  let onRemoteCb = null;
  let onStatusCb = null;

  function isConfigured(){
    return typeof firebaseConfig !== "undefined" &&
      firebaseConfig.apiKey && firebaseConfig.apiKey !== "REMPLACE_MOI";
  }

  function getRoomCode(){ return localStorage.getItem(ROOM_KEY) || ""; }
  function clearRoomCode(){ localStorage.removeItem(ROOM_KEY); }

  function setStatus(text){ if(onStatusCb) onStatusCb(text); }

  async function connect(code){
    if(!isConfigured()) return false;
    code = (code || "").trim();
    if(!code) return false;

    try{
      setStatus("Connexion…");
      if(!firebase.apps.length) firebase.initializeApp(firebaseConfig);
      await firebase.auth().signInAnonymously();

      db = firebase.firestore();
      docRef = db.collection("protocole").doc(code);

      // si le document n'existe pas encore côté serveur, on le crée avec l'état local
      const snap = await docRef.get();
      if(!snap.exists && onRemoteCb){
        onRemoteCb(null); // signale "aucune donnée distante" -> app.js poussera l'état local
      }

      if(unsubscribe) unsubscribe();
      unsubscribe = docRef.onSnapshot(s=>{
        if(!s.exists) return;
        const data = s.data();
        if(!data || !data.payload) return;
        applyingRemote = true;
        try{ if(onRemoteCb) onRemoteCb(JSON.parse(data.payload)); }
        finally{ applyingRemote = false; }
        setStatus("Synchronisé · " + new Date().toLocaleTimeString("fr-FR", {hour:"2-digit", minute:"2-digit"}));
      }, err=>{
        console.error("Erreur de synchronisation :", err);
        setStatus("Erreur de connexion");
      });

      localStorage.setItem(ROOM_KEY, code);
      ready = true;
      setStatus("Connecté");
      return true;
    }catch(err){
      console.error(err);
      setStatus("Échec de connexion");
      ready = false;
      return false;
    }
  }

  function disconnect(){
    if(unsubscribe) unsubscribe();
    unsubscribe = null; docRef = null; ready = false;
    clearRoomCode();
    setStatus("Déconnecté");
  }

  function push(state){
    if(!ready || applyingRemote || !docRef) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(()=>{
      docRef.set({ payload: JSON.stringify(state), updatedAt: Date.now() })
        .catch(err=>{ console.error("Échec d'envoi :", err); setStatus("Échec d'envoi"); });
    }, 350);
  }

  window.Sync = {
    isConfigured,
    getRoomCode,
    connect,
    disconnect,
    push,
    isReady: () => ready,
    onRemote: cb => { onRemoteCb = cb; },
    onStatus: cb => { onStatusCb = cb; }
  };
})();
