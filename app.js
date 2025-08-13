const FRIENDS_ORDER_ROUND_1 = [
  "Dario",
  "Roberto",
  "Giovanni",
  "Peppe",
  "Francesco",
  "Luigi",
  "Pasquale",
  "Antonio",
  "Luca",
  "Carmine"
];

const FRIENDS_ORDER_ROUND_2 = [
  "Carmine",
  "Luca",
  "Antonio",
  "Pasquale",
  "Luigi",
  "Francesco",
  "Peppe",
  "Giovanni",
  "Roberto",
  "Dario"
];

const STORAGE_KEY = "fantadraft_state_v1";
const ROOM_ID = "lega-2024"; // stesso id per tutti i 10 amici

/**
 * Shape: {
 *   round: 1 | 2,
 *   pickIndex: number, // 0..9
 *   takenPlayers: Array<{ name: string, role: string, team: string, by: string }>
 * }
 */
function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { round: 1, pickIndex: 0, takenPlayers: [] };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") throw new Error("bad state");
    return parsed;
  } catch {
    return { round: 1, pickIndex: 0, takenPlayers: [] };
  }
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function getCurrentOrder(round) {
  return round === 1 ? FRIENDS_ORDER_ROUND_1 : FRIENDS_ORDER_ROUND_2;
}

async function fetchPlayers() {
  const response = await fetch("./Listone_Fantapazz.json", { cache: "no-store" });
  if (!response.ok) throw new Error("Impossibile caricare Listone_Fantapazz.json");
  /** @type {{Ruolo:string, Calciatore:string, Squadra:string, Quotazione:number}[]} */
  const data = await response.json();
  const normalized = data
    .filter(p => p && p.Calciatore)
    .map(p => ({
      name: String(p.Calciatore).trim(),
      role: String(p.Ruolo || "").trim(),
      team: String(p.Squadra || "").trim(),
      price: Number(p.Quotazione ?? 0)
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "it"));
  return normalized;
}

function buildBoards(rootEl, state) {
  const allFriends = FRIENDS_ORDER_ROUND_1; // names list base
  const order = getCurrentOrder(state.round);
  const currentUser = isDraftCompleted(state) ? null : order[state.pickIndex];
  
  rootEl.innerHTML = "";
  allFriends.forEach(friend => {
    const picks = state.takenPlayers.filter(tp => tp.by === friend);
    const card = document.createElement("div");
    card.className = "board-card";
    
    // Aggiungi classe current-turn se è il turno di questa persona
    if (friend === currentUser) {
      card.classList.add("current-turn");
    }
    
    card.innerHTML = `
      <div class="board-header">
        <div class="board-title">${friend}</div>
        <div class="pill">${picks.length} scelte</div>
      </div>
      <div class="picks-list">${picks
        .map(
          (p, idx) => `
            <div class="pick-item">
              <span class="badge role-${p.role.toLowerCase()}">${p.role}</span>
              <span class="player-name">${p.name}</span>
              <span class="player-meta">${p.team || ""}</span>
            </div>
          `
        )
        .join("")}
      </div>
    `;
    rootEl.appendChild(card);
  });
}

function isDraftCompleted(state) {
  const totalSlots = FRIENDS_ORDER_ROUND_1.length * 2;
  return state.takenPlayers.length >= totalSlots;
}

function computeAvailablePlayers(allPlayers, state) {
  const takenNames = new Set(state.takenPlayers.map(tp => tp.name));
  return allPlayers.filter(p => !takenNames.has(p.name));
}

function populateSelectors(players) {
  const datalist = document.getElementById("playersDatalist");
  const select = document.getElementById("playerSelect");
  datalist.innerHTML = "";
  select.innerHTML = "";

  const defaultOption = document.createElement("option");
  defaultOption.value = "";
  defaultOption.textContent = "— Seleziona —";
  select.appendChild(defaultOption);

  players.forEach(p => {
    const option = document.createElement("option");
    option.value = p.name;
    option.textContent = `${p.name} (${p.role}${p.team ? " · " + p.team : ""})`;
    select.appendChild(option);

    const option2 = document.createElement("option");
    option2.value = p.name;
    option2.label = `${p.name} (${p.role}${p.team ? " · " + p.team : ""})`;
    datalist.appendChild(option2);
  });
}

function updateStatus(state) {
  const order = getCurrentOrder(state.round);
  const userEl = document.getElementById("currentUser");
  const roundEl = document.getElementById("currentRound");
  const pickEl = document.getElementById("currentPick");
  const confirmBtn = document.getElementById("confirmBtn");

  if (isDraftCompleted(state)) {
    userEl.textContent = "Completato";
    roundEl.textContent = "2";
    pickEl.textContent = `${order.length}/${order.length}`;
    confirmBtn.disabled = true;
    confirmBtn.textContent = "Draft completato";
  } else {
    userEl.textContent = order[state.pickIndex] || "–";
    roundEl.textContent = String(state.round);
    pickEl.textContent = `${state.pickIndex + 1}/${order.length}`;
    confirmBtn.disabled = false;
    confirmBtn.textContent = "Conferma scelta";
  }
}

function getSelectedPlayerName() {
  const search = document.getElementById("playerSearch");
  const select = document.getElementById("playerSelect");
  const typed = search.value.trim();
  if (typed) return typed;
  const selected = select.value.trim();
  return selected || "";
}

function clearInputs() {
  document.getElementById("playerSearch").value = "";
  document.getElementById("playerSelect").value = "";
}

function nextTurn(state) {
  const order = getCurrentOrder(state.round);
  const isEndOfRound = state.pickIndex >= order.length - 1;
  if (isEndOfRound) {
    if (state.round === 1) {
      state.round = 2;
      state.pickIndex = 0;
    } else {
      // Completed both rounds; lock further picks
      state.pickIndex = order.length - 1;
    }
  } else {
    state.pickIndex += 1;
  }
}

function prevTurn(state) {
  const order = getCurrentOrder(state.round);
  
  // Se siamo al round 2 e al primo pick, torna all'ultimo del round 1
  if (state.round === 2 && state.pickIndex === 0) {
    state.round = 1;
    state.pickIndex = getCurrentOrder(1).length - 1;
    return;
  }
  
  // Se siamo al round 2 e non al primo pick, diminuisci pickIndex
  if (state.round === 2 && state.pickIndex > 0) {
    state.pickIndex -= 1;
    return;
  }
  
  // Se siamo al round 1 e non al primo pick, diminuisci pickIndex
  if (state.round === 1 && state.pickIndex > 0) {
    state.pickIndex -= 1;
    return;
  }
  
  // Se siamo al round 1 e al primo pick, non fare nulla (non possiamo andare indietro)
}

function init() {
  const state = loadState();
  const boardsRoot = document.getElementById("boards");
  const confirmBtn = document.getElementById("confirmBtn");
  const undoBtn = document.getElementById("undoBtn");
  const resetBtn = document.getElementById("resetBtn");
  const meSelect = document.getElementById("meSelect");
  const meStatus = document.getElementById("meStatus");

  let allPlayers = [];
  let me = localStorage.getItem("fantadraft_me") || "";

  // --- Helper functions ---
  function sheetsAvailable() {
    return Boolean(window.sheetsScriptUrl);
  }

  // --- Core action functions (defined first) ---
  function applyPick({ player, by }) {
    console.log("applyPick chiamata con:", { player, by });
    state.takenPlayers.push({ name: player.name, role: player.role, team: player.team, by });
    nextTurn(state);
    saveState(state);
    clearInputs();
    populateSelectors(computeAvailablePlayers(allPlayers, state));
    updateStatus(state);
    buildBoards(boardsRoot, state);
  }

  function applyUndo() {
    console.log("applyUndo chiamata");
    state.takenPlayers.pop();
    prevTurn(state);
    saveState(state);
    populateSelectors(computeAvailablePlayers(allPlayers, state));
    updateStatus(state);
    buildBoards(boardsRoot, state);
  }

  function applyReset() {
    console.log("applyReset chiamata");
    state.round = 1;
    state.pickIndex = 0;
    state.takenPlayers = [];
    saveState(state);
    populateSelectors(computeAvailablePlayers(allPlayers, state));
    updateStatus(state);
    buildBoards(boardsRoot, state);
  }

  // --- Google Sheets / Apps Script backend ---
  function initSheetsSync() {
    const selectedMe = meSelect.value;
    meStatus.textContent = selectedMe ? `Online (Sheets): ${selectedMe}` : `Online (Sheets)`;
    const baseUrl = window.sheetsScriptUrl;

    // Polling per stati remoti ogni 2s
    const poll = async () => {
      try {
        const res = await fetch(`${baseUrl}?room=${encodeURIComponent(ROOM_ID)}&action=get`, { cache: 'no-store' });
        if (!res.ok) throw new Error('resp');
        const data = await res.json();
        if (!data || !data.state) return;
        const remote = data.state;
        const remoteLen = Array.isArray(remote.takenPlayers) ? remote.takenPlayers.length : 0;
        const localLen = state.takenPlayers.length;
        if (remoteLen !== localLen || remote.round !== state.round || remote.pickIndex !== state.pickIndex) {
          state.round = remote.round ?? 1;
          state.pickIndex = remote.pickIndex ?? 0;
          state.takenPlayers = Array.isArray(remote.takenPlayers) ? remote.takenPlayers : [];
          saveState(state);
          populateSelectors(computeAvailablePlayers(allPlayers, state));
          updateStatus(state);
          buildBoards(boardsRoot, state);
        }
      } catch {}
    };
    const pollId = setInterval(poll, 2000);
    poll();

    async function pushToRemote(newState) {
      try {
        // Use GET with query params to avoid CORS preflight
        const params = new URLSearchParams({
          room: ROOM_ID,
          action: 'set',
          state: JSON.stringify(newState)
        });
        await fetch(`${baseUrl}?${params.toString()}`, { 
          method: 'GET',
          cache: 'no-store'
        });
      } catch (err) {
        console.warn("Errore sincronizzazione Google Sheets:", err);
      }
    }

    // Override actions to write to Google Sheets
    const originalApplyPick = applyPick;
    const originalApplyUndo = applyUndo;
    const originalApplyReset = applyReset;

    applyPick = ({ player, by }) => {
      originalApplyPick({ player, by });
      pushToRemote(state);
    };
    applyUndo = () => {
      originalApplyUndo();
      pushToRemote(state);
    };
    applyReset = () => {
      originalApplyReset();
      pushToRemote(state);
    };
  }





  // --- Initialize sync layer ---
  if (sheetsAvailable()) {
    initSheetsSync();
  } else {
    const selectedMe = meSelect.value;
    meStatus.textContent = selectedMe ? `Solo locale: ${selectedMe}` : `Solo locale`;
  }

  // --- Event listeners ---
  fetchPlayers().then(players => {
    allPlayers = players;
    const available = computeAvailablePlayers(allPlayers, state);
    populateSelectors(available);
    updateStatus(state);
    buildBoards(boardsRoot, state);
  }).catch(err => {
    alert("Errore nel caricamento dei giocatori: " + err.message);
  });

  // populate me select
  meSelect.innerHTML = FRIENDS_ORDER_ROUND_1.map(name => `<option value="${name}">${name}</option>`).join("");
  if (me) meSelect.value = me;

  // Update status when me select changes
  meSelect.addEventListener("change", () => {
    me = meSelect.value;
    localStorage.setItem("fantadraft_me", me);
    if (sheetsAvailable()) {
      meStatus.textContent = `Online (Sheets): ${me}`;
    } else {
      meStatus.textContent = `Solo locale: ${me}`;
    }
  });

  confirmBtn.addEventListener("click", () => {
    console.log("Conferma cliccata");
    if (isDraftCompleted(state)) return;
    const order = getCurrentOrder(state.round);
    const currentUser = order[state.pickIndex];
    if (!currentUser) {
      alert("Draft completato o stato non valido");
      return;
    }

    const selectedName = getSelectedPlayerName();
    if (!selectedName) {
      alert("Seleziona un giocatore");
      return;
    }

    const available = computeAvailablePlayers(allPlayers, state);
    const player = available.find(p => p.name.toLowerCase() === selectedName.toLowerCase());
    if (!player) {
      alert("Giocatore non disponibile (forse già scelto)");
      return;
    }

    // Enforce turno: puoi scegliere solo se sei il currentUser
    const selectedMe = meSelect.value;
    if (selectedMe && selectedMe !== currentUser) {
      alert(`Tocca a ${currentUser}. Tu sei ${selectedMe}.`);
      return;
    }

    console.log("Chiamando applyPick con:", { player, by: currentUser });
    applyPick({ player, by: currentUser });
  });

  undoBtn.addEventListener("click", () => {
    if (state.takenPlayers.length === 0) return;
    const last = state.takenPlayers[state.takenPlayers.length - 1];
    // Only allow undo if sei tu l'ultimo aver scelto (quando me è settato)
    const selectedMe = meSelect.value;
    if (selectedMe && last.by !== selectedMe) {
      alert(`L'ultima scelta è di ${last.by}. Solo lui può annullare.`);
      return;
    }
    applyUndo();
  });

  resetBtn.addEventListener("click", () => {
    const password = prompt("Inserisci la password per resettare il draft:");
    if (password !== "fantapazz") {
      alert("Password errata. Reset annullato.");
      return;
    }
    if (!confirm("Sei sicuro di voler resettare il draft? Questa azione non può essere annullata.")) return;
    applyReset();
  });
}

document.addEventListener("DOMContentLoaded", init);


