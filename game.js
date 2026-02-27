const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d", { alpha: false });

const inventoryList = document.getElementById("inventory-list");
const messageLog = document.getElementById("message-log");
const roomNameEl = document.getElementById("room-name");
const clockEl = document.getElementById("clock");
const wizardStatusEl = document.getElementById("wizard-status");
const dangerMeterEl = document.getElementById("danger-meter");
const objectiveEl = document.getElementById("objective");

const VIEW_W = 960;
const VIEW_H = 540;
canvas.width = VIEW_W;
canvas.height = VIEW_H;

const GAME_MINUTES_PER_SECOND = 3;
const DANGER_LIMIT = 100;

// VGA-ish palette (inspired by classic Sierra era tones).
const PAL = {
  sky1: "#6a7ea8",
  sky2: "#8ea0bf",
  grass1: "#4d7a42",
  grass2: "#6f964c",
  path1: "#8f7a4c",
  path2: "#b29762",
  dirt: "#5f4b2f",
  wood1: "#6c4a2a",
  wood2: "#8a6234",
  stone1: "#6c6c69",
  stone2: "#8f8f88",
  water1: "#204d79",
  water2: "#3a78a8",
  candle: "#ffcb6e",
  shadow: "#242118",
  uiText: "#f4e9cf",
};

const state = {
  roomId: "yard",
  player: { x: 145, y: 388, w: 24, h: 40, speed: 2.3, facing: "down", step: 0 },
  inventory: new Set(),
  flags: { readNote: false, gateUnlocked: false, won: false },
  day: 1,
  minutes: 7 * 60 + 30,
  wizardDanger: 0,
  scheduleNotice: { leftDay: 0, returnDay: 0 },
  messages: [],
  lastBlockedExit: "",
  lastTimeBucket: -1,
};

const input = { up: false, down: false, left: false, right: false };

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function addMessage(text) {
  state.messages.unshift(text);
  state.messages = state.messages.slice(0, 14);
  messageLog.innerHTML = "";
  for (const line of state.messages) {
    const p = document.createElement("p");
    p.textContent = line;
    messageLog.appendChild(p);
  }
}

function addItem(itemId, label) {
  if (state.inventory.has(itemId)) {
    addMessage(`You already have ${label}.`);
    return false;
  }
  state.inventory.add(itemId);
  addMessage(`Picked up: ${label}.`);
  renderInventory();
  refreshObjective();
  return true;
}

function renderInventory() {
  inventoryList.innerHTML = "";
  const labels = {
    island_note: "Island Note",
    brass_key: "Brass Key",
    storm_wood: "Storm Wood",
    moon_herb: "Moon Herb",
    silver_sigil: "Silver Sigil",
    spellbook: "Old Spellbook",
  };
  if (state.inventory.size === 0) {
    const li = document.createElement("li");
    li.textContent = "Empty";
    inventoryList.appendChild(li);
    return;
  }
  for (const item of state.inventory) {
    const li = document.createElement("li");
    li.textContent = labels[item] || item;
    inventoryList.appendChild(li);
  }
}

function refreshObjective() {
  let objective = "Find a way into the tower.";
  if (state.flags.won) {
    objective = "You escaped with the spellbook. Prototype complete.";
  } else if (!state.inventory.has("island_note")) {
    objective = "Search the cottage for clues.";
  } else if (!state.inventory.has("brass_key")) {
    objective = "Find where the sea kisses stone.";
  } else if (!state.flags.gateUnlocked) {
    objective = "Unlock the manor gate with the Brass Key.";
  } else if (!state.inventory.has("moon_herb") || !state.inventory.has("silver_sigil")) {
    objective = "Find the Moon Herb and Silver Sigil to break the tower ward.";
  } else if (!state.inventory.has("spellbook")) {
    objective = "Enter the tower during the wizard's absence and recover the spellbook.";
  }
  objectiveEl.textContent = `Objective: ${objective}`;
}

function getMinuteOfDay() {
  return Math.floor(state.minutes) % (24 * 60);
}

function formatClock(minuteOfDay) {
  const h = String(Math.floor(minuteOfDay / 60)).padStart(2, "0");
  const m = String(minuteOfDay % 60).padStart(2, "0");
  return `${h}:${m}`;
}

function isWizardAway() {
  const m = getMinuteOfDay();
  return m >= 9 * 60 && m < 15 * 60;
}

function isHighRiskRoom() {
  return state.roomId === "manor_gate" || state.roomId === "tower";
}

function refreshStatusUI() {
  clockEl.textContent = `Time: Day ${state.day}, ${formatClock(getMinuteOfDay())}`;
  wizardStatusEl.textContent = `Wizard: ${isWizardAway() ? "Away (safe window)" : "Nearby (danger at manor/tower)"}`;
  dangerMeterEl.textContent = state.wizardDanger <= 0 ? "Suspicion: Safe" : `Suspicion: ${Math.round(state.wizardDanger)}%`;
}

function updateClockAndSchedule(deltaMs) {
  state.minutes += (deltaMs / 1000) * GAME_MINUTES_PER_SECOND;
  while (state.minutes >= 24 * 60) {
    state.minutes -= 24 * 60;
    state.day += 1;
    state.scheduleNotice.leftDay = 0;
    state.scheduleNotice.returnDay = 0;
  }
  const m = getMinuteOfDay();
  const bucket = Math.floor(m / 15);
  if (bucket !== state.lastTimeBucket) {
    state.lastTimeBucket = bucket;
    refreshStatusUI();
  }
  if (m >= 9 * 60 && state.scheduleNotice.leftDay !== state.day) {
    state.scheduleNotice.leftDay = state.day;
    addMessage("Ninth bell rings. Manannan rides out from the manor.");
  }
  if (m >= 15 * 60 && state.scheduleNotice.returnDay !== state.day) {
    state.scheduleNotice.returnDay = state.day;
    addMessage("Dusk bells toll. Manannan has returned to the manor grounds.");
  }
}

function triggerCaught() {
  state.wizardDanger = 0;
  state.flags.gateUnlocked = false;
  state.day += 1;
  state.minutes = 6 * 60 + 30;
  state.roomId = "cottage";
  state.player.x = rooms.cottage.spawn.x;
  state.player.y = rooms.cottage.spawn.y;
  updateRoomUI();
  refreshStatusUI();
  addMessage("Manannan catches you near the tower and drags you back to the cottage.");
}

function updateWizardDanger(deltaMs) {
  if (state.flags.won) {
    state.wizardDanger = 0;
    refreshStatusUI();
    return;
  }
  const dangerRate = 14;
  const calmRate = 20;
  if (!isWizardAway() && isHighRiskRoom()) {
    state.wizardDanger += (deltaMs / 1000) * dangerRate;
    if (state.wizardDanger >= DANGER_LIMIT) {
      triggerCaught();
      return;
    }
  } else {
    state.wizardDanger -= (deltaMs / 1000) * calmRate;
  }
  state.wizardDanger = Math.max(0, Math.min(DANGER_LIMIT, state.wizardDanger));
  refreshStatusUI();
}

function pxRect(x, y, w, h, c) {
  ctx.fillStyle = c;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

function ditherRect(x, y, w, h, cA, cB, step = 4) {
  for (let yy = y; yy < y + h; yy += step) {
    for (let xx = x; xx < x + w; xx += step) {
      pxRect(xx, yy, step, step, ((xx + yy) / step) % 2 ? cA : cB);
    }
  }
}

function drawSkyGround(baseSky1, baseSky2, ground1, ground2) {
  const grad = ctx.createLinearGradient(0, 0, 0, VIEW_H * 0.5);
  grad.addColorStop(0, baseSky1);
  grad.addColorStop(1, baseSky2);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H * 0.52);
  ditherRect(0, VIEW_H * 0.5, VIEW_W, VIEW_H * 0.5, ground1, ground2, 6);
}

function drawYardScene() {
  drawSkyGround(PAL.sky1, PAL.sky2, PAL.grass1, PAL.grass2);
  ditherRect(260, 190, 430, 320, PAL.path1, PAL.path2, 8);
  pxRect(0, 390, 240, 150, PAL.water1);
  ditherRect(8, 400, 220, 130, PAL.water1, PAL.water2, 8);

  // Cottage
  pxRect(40, 92, 250, 160, PAL.stone2);
  pxRect(24, 62, 284, 56, PAL.wood2);
  pxRect(126, 152, 58, 92, PAL.wood1);

  // Well
  pxRect(390, 255, 130, 74, PAL.stone2);
  pxRect(420, 218, 70, 46, PAL.wood2);

  // Gate (top-right)
  pxRect(760, 68, 140, 88, PAL.stone1);
  pxRect(790, 92, 80, 56, PAL.wood1);

  // Garden and clutter
  pxRect(590, 246, 230, 142, PAL.dirt);
  pxRect(730, 370, 145, 68, PAL.wood2);
  pxRect(910, 450, 125, 65, PAL.wood1);
}

function drawCottageScene() {
  drawSkyGround("#3e2e21", "#5b4029", "#6f4b2f", "#8b6138");
  ditherRect(80, 90, 800, 390, "#9a7443", "#6e4e30", 8);
  pxRect(60, 70, 260, 90, PAL.wood1);
  pxRect(620, 75, 260, 90, PAL.wood1);
  pxRect(640, 206, 95, 74, PAL.shadow);
  pxRect(220, 204, 44, 30, "#dbc59d");
}

function drawForestScene() {
  drawSkyGround("#4f6a6f", "#6a8b7d", "#3f6634", "#547c41");
  ditherRect(260, 0, 420, 540, PAL.path1, PAL.path2, 8);
  pxRect(430, 12, 100, 60, PAL.stone2);
  pxRect(118, 60, 126, 150, "#30522f");
  pxRect(426, 58, 146, 170, "#315733");
  pxRect(708, 86, 146, 168, "#355f35");
}

function drawBeachScene() {
  drawSkyGround("#6888a9", "#8fb6d1", "#c0a573", "#d7bf88");
  ditherRect(0, 38, VIEW_W, 205, PAL.water1, PAL.water2, 8);
  pxRect(610, 368, 122, 92, PAL.stone1);
  pxRect(220, 398, 94, 30, PAL.wood1);
}

function drawCliffScene() {
  drawSkyGround("#6f7d91", "#94a2b1", "#8a7c65", "#a3947a");
  pxRect(0, 340, 220, 200, PAL.water1);
  pxRect(260, 80, 220, 160, PAL.stone1);
  pxRect(580, 300, 280, 180, PAL.stone1);
  pxRect(760, 258, 38, 48, "#8fae64");
}

function drawRuinsScene() {
  drawSkyGround("#62736f", "#7f8d84", "#687457", "#7d8a66");
  pxRect(110, 80, 220, 140, PAL.stone1);
  pxRect(630, 90, 220, 140, PAL.stone1);
  pxRect(380, 120, 190, 90, PAL.stone2);
  pxRect(445, 278, 66, 50, PAL.dirt);
}

function drawManorScene() {
  drawSkyGround("#5f7285", "#7f95a8", "#738252", "#86965d");
  pxRect(660, 80, 250, 360, PAL.stone1);
  pxRect(690, 120, 160, 120, state.flags.gateUnlocked ? "#657a66" : PAL.shadow);
  pxRect(740, 166, 12, 22, PAL.stone2);
}

function drawTowerScene() {
  drawSkyGround("#50495f", "#6b6078", "#5b5263", "#70657c");
  pxRect(120, 120, 220, 120, "#47414d");
  pxRect(620, 130, 220, 120, "#4f4655");
  pxRect(458, 184, 68, 48, PAL.wood1);
  if (!state.inventory.has("spellbook")) {
    pxRect(470, 190, 45, 34, "#d0b06d");
  }
}

const rooms = {
  yard: {
    name: "Cottage Yard",
    spawn: { x: 145, y: 388 },
    solids: [
      { x: 40, y: 92, w: 250, h: 160 },
      { x: 0, y: 390, w: 240, h: 150 },
      { x: 330, y: 245, w: 190, h: 145 },
      { x: 590, y: 246, w: 230, h: 142 },
      { x: 730, y: 370, w: 145, h: 68 },
      { x: 910, y: 450, w: 125, h: 65 },
      { x: 0, y: 0, w: VIEW_W, h: 16 },
      { x: 0, y: VIEW_H - 16, w: VIEW_W, h: 16 },
      { x: 0, y: 0, w: 14, h: VIEW_H },
      { x: VIEW_W - 14, y: 0, w: 14, h: VIEW_H },
    ],
    exits: [
      { x: 760, y: 58, w: 150, h: 46, target: "manor_gate", spawn: { x: 70, y: 360 }, note: "You pass through the stone gate toward the manor road." },
      { x: 920, y: 190, w: 40, h: 180, target: "forest", spawn: { x: 892, y: 298 }, note: "You follow a narrow path into the forest." },
      { x: 124, y: 198, w: 72, h: 42, target: "cottage", spawn: { x: 474, y: 438 }, note: "You enter the cottage." },
    ],
    interactables: [
      { id: "hen", label: "Hen", x: 158, y: 314, w: 32, h: 26, interact() { addMessage("Hen: cluck cluck. (It pecks near the eastern road.)"); } },
    ],
    draw: drawYardScene,
  },
  cottage: {
    name: "Inside Cottage",
    spawn: { x: 474, y: 438 },
    solids: [
      { x: 0, y: 0, w: VIEW_W, h: 18 }, { x: 0, y: 0, w: 18, h: VIEW_H }, { x: VIEW_W - 18, y: 0, w: 18, h: VIEW_H },
      { x: 0, y: VIEW_H - 18, w: 388, h: 18 }, { x: 572, y: VIEW_H - 18, w: 388, h: 18 },
      { x: 160, y: 90, w: 220, h: 90 }, { x: 590, y: 90, w: 220, h: 90 },
    ],
    exits: [
      { x: 388, y: VIEW_H - 18, w: 184, h: 18, target: "yard", spawn: { x: 138, y: 220 }, note: "You step back into the yard." },
    ],
    interactables: [
      { id: "note", label: "Island Note", x: 220, y: 204, w: 44, h: 30, interact() {
        if (addItem("island_note", "Island Note")) {
          state.flags.readNote = true;
          addMessage('The note reads: "The brass key sleeps where sea kisses stone."');
          addMessage('A second line says: "At ninth bell the wizard rides out. At dusk he returns."');
        }
      }},
      { id: "cauldron", label: "Cauldron", x: 640, y: 206, w: 95, h: 74, interact() { addMessage("An old cauldron. A proper spell will need ingredients and courage."); } },
      { id: "mirror", label: "Cracked Mirror", x: 760, y: 312, w: 68, h: 92, interact() { addMessage("Move toward the manor only while the wizard is away."); } },
    ],
    draw: drawCottageScene,
  },
  forest: {
    name: "Forest Path",
    spawn: { x: 892, y: 298 },
    solids: [
      { x: 0, y: 0, w: VIEW_W, h: 16 }, { x: 0, y: VIEW_H - 16, w: VIEW_W, h: 16 },
      { x: 0, y: 0, w: 16, h: VIEW_H }, { x: VIEW_W - 16, y: 0, w: 16, h: VIEW_H },
      { x: 118, y: 60, w: 126, h: 150 }, { x: 426, y: 58, w: 146, h: 170 }, { x: 708, y: 86, w: 146, h: 168 },
    ],
    exits: [
      { x: 910, y: 238, w: 32, h: 180, target: "yard", spawn: { x: 900, y: 292 }, note: "You return to your cottage yard." },
      { x: 436, y: VIEW_H - 36, w: 90, h: 36, target: "beach", spawn: { x: 470, y: 74 }, note: "The trees thin as you descend toward the coast." },
      { x: 430, y: 0, w: 100, h: 24, target: "ruins", spawn: { x: 470, y: 466 }, note: "You push north into a forgotten ruin trail." },
    ],
    interactables: [
      { id: "sign", label: "Carved Sign", x: 500, y: 355, w: 64, h: 42, interact() { addMessage("The sign reads: SOUTH - BLACK COVE"); } },
    ],
    draw: drawForestScene,
  },
  beach: {
    name: "Black Cove",
    spawn: { x: 470, y: 74 },
    solids: [
      { x: 0, y: 0, w: VIEW_W, h: 16 }, { x: 0, y: 0, w: 16, h: VIEW_H }, { x: VIEW_W - 16, y: 0, w: 16, h: VIEW_H },
      { x: 0, y: VIEW_H - 16, w: 430, h: 16 }, { x: 530, y: VIEW_H - 16, w: 430, h: 16 },
    ],
    exits: [
      { x: 430, y: 0, w: 100, h: 24, target: "forest", spawn: { x: 480, y: 472 }, note: "You climb back into the forest." },
      { x: VIEW_W - 24, y: 250, w: 24, h: 170, target: "cliff_pass", spawn: { x: 60, y: 328 }, note: "You follow the shoreline toward a narrow cliff pass." },
    ],
    interactables: [
      { id: "stonepool", label: "Tide Stone", x: 620, y: 380, w: 100, h: 70, interact() {
        if (!state.inventory.has("island_note")) { addMessage("Just wet stones and dark water. Maybe you should search home first."); return; }
        addItem("brass_key", "Brass Key");
      }},
      { id: "wood", label: "Driftwood", x: 220, y: 398, w: 90, h: 30, interact() { addItem("storm_wood", "Storm Wood"); } },
    ],
    draw: drawBeachScene,
  },
  cliff_pass: {
    name: "Cliff Pass",
    spawn: { x: 60, y: 328 },
    solids: [
      { x: 0, y: 0, w: VIEW_W, h: 16 }, { x: 0, y: VIEW_H - 16, w: VIEW_W, h: 16 }, { x: 0, y: 0, w: 16, h: VIEW_H }, { x: VIEW_W - 16, y: 0, w: 16, h: VIEW_H },
      { x: 260, y: 80, w: 220, h: 160 }, { x: 580, y: 300, w: 280, h: 180 },
    ],
    exits: [
      { x: 0, y: 260, w: 24, h: 180, target: "beach", spawn: { x: 892, y: 330 }, note: "You return to Black Cove." },
    ],
    interactables: [
      { id: "herb", label: "Moon Herb", x: 760, y: 258, w: 36, h: 46, interact() { addItem("moon_herb", "Moon Herb"); } },
      { id: "altar", label: "Weathered Altar", x: 318, y: 252, w: 110, h: 62, interact() { addMessage("A broken altar shows a symbol matching old wizard seals."); } },
    ],
    draw: drawCliffScene,
  },
  ruins: {
    name: "Old Ruins",
    spawn: { x: 470, y: 466 },
    solids: [
      { x: 0, y: 0, w: VIEW_W, h: 16 }, { x: 0, y: VIEW_H - 16, w: VIEW_W, h: 16 }, { x: 0, y: 0, w: 16, h: VIEW_H }, { x: VIEW_W - 16, y: 0, w: 16, h: VIEW_H },
      { x: 110, y: 80, w: 220, h: 140 }, { x: 630, y: 90, w: 220, h: 140 }, { x: 380, y: 120, w: 190, h: 90 },
    ],
    exits: [
      { x: 430, y: VIEW_H - 16, w: 100, h: 16, target: "forest", spawn: { x: 480, y: 44 }, note: "You head back down to the forest trail." },
    ],
    interactables: [
      { id: "sigil", label: "Sigil Plinth", x: 445, y: 278, w: 66, h: 50, interact() {
        if (!state.inventory.has("storm_wood")) { addMessage("A recess in the plinth is packed with ash. Something rigid could pry it free."); return; }
        if (addItem("silver_sigil", "Silver Sigil")) { addMessage("Using Storm Wood, you pry loose a Silver Sigil."); }
      }},
      { id: "mural", label: "Ancient Mural", x: 160, y: 250, w: 130, h: 70, interact() { addMessage("The mural shows a tower ward broken by herb and sigil."); } },
    ],
    draw: drawRuinsScene,
  },
  manor_gate: {
    name: "Manor Road",
    spawn: { x: 70, y: 360 },
    solids: [
      { x: 0, y: 0, w: VIEW_W, h: 16 }, { x: 0, y: VIEW_H - 16, w: VIEW_W, h: 16 }, { x: 0, y: 0, w: 16, h: VIEW_H }, { x: VIEW_W - 16, y: 0, w: 16, h: VIEW_H },
      { x: 660, y: 80, w: 250, h: 360 }, { x: 620, y: 220, w: 40, h: 220 },
    ],
    exits: [
      { x: 0, y: 300, w: 24, h: 170, target: "yard", spawn: { x: 860, y: 88 }, note: "You head back to the cottage road." },
      { x: 720, y: 70, w: 100, h: 26, target: "tower", spawn: { x: 460, y: 450 }, locked: true, note: "The iron gate blocks your path." },
    ],
    interactables: [
      { id: "gate", label: "Iron Gate", x: 690, y: 120, w: 160, h: 120, interact() {
        if (state.flags.gateUnlocked) { addMessage("The gate stands open. The tower path awaits."); return; }
        if (state.inventory.has("brass_key")) {
          state.flags.gateUnlocked = true;
          addMessage("The Brass Key turns. The gate unlocks with a grinding groan.");
          refreshObjective();
        } else { addMessage("Locked tight. You need a key."); }
      }},
    ],
    draw: drawManorScene,
  },
  tower: {
    name: "Tower Chamber",
    spawn: { x: 460, y: 450 },
    solids: [
      { x: 0, y: 0, w: VIEW_W, h: 16 }, { x: 0, y: 0, w: 16, h: VIEW_H }, { x: VIEW_W - 16, y: 0, w: 16, h: VIEW_H },
      { x: 0, y: VIEW_H - 16, w: 390, h: 16 }, { x: 575, y: VIEW_H - 16, w: 385, h: 16 },
      { x: 120, y: 120, w: 220, h: 120 }, { x: 620, y: 130, w: 220, h: 120 },
    ],
    exits: [
      { x: 390, y: VIEW_H - 16, w: 185, h: 16, target: "manor_gate", spawn: { x: 742, y: 125 }, note: "You leave the tower and return to the gate." },
    ],
    interactables: [
      { id: "book", label: "Old Spellbook", x: 470, y: 190, w: 45, h: 34, interact() {
        if (!state.inventory.has("moon_herb") || !state.inventory.has("silver_sigil")) { addMessage("A ward flares over the book. You need the Moon Herb and Silver Sigil."); return; }
        if (!isWizardAway()) { addMessage("Footsteps echo below. Too dangerous while he is nearby."); return; }
        if (addItem("spellbook", "Old Spellbook")) {
          state.flags.won = true;
          refreshObjective();
          addMessage("You found the spellbook. Prototype complete.");
        }
      }},
    ],
    draw: drawTowerScene,
  },
};

function getRoom() {
  return rooms[state.roomId];
}

function updateRoomUI() {
  roomNameEl.textContent = `Room: ${getRoom().name}`;
}

function inBounds(rect) {
  return rect.x >= 0 && rect.y >= 0 && rect.x + rect.w <= VIEW_W && rect.y + rect.h <= VIEW_H;
}

function canMoveTo(nextRect) {
  if (!inBounds(nextRect)) return false;
  for (const solid of getRoom().solids) {
    if (rectsOverlap(nextRect, solid)) return false;
  }
  return true;
}

function tryRoomTransition() {
  const room = getRoom();
  let blockedOverlap = false;
  for (const exit of room.exits) {
    if (rectsOverlap(state.player, exit)) {
      if (exit.locked && !state.flags.gateUnlocked) {
        blockedOverlap = true;
        const exitId = `${state.roomId}:${exit.target}`;
        if (state.lastBlockedExit !== exitId) {
          addMessage(exit.note);
          state.lastBlockedExit = exitId;
        }
        return;
      }
      state.lastBlockedExit = "";
      state.roomId = exit.target;
      state.player.x = exit.spawn.x;
      state.player.y = exit.spawn.y;
      updateRoomUI();
      addMessage(exit.note);
      return;
    }
  }
  if (!blockedOverlap) state.lastBlockedExit = "";
}

function nearbyInteractable() {
  const p = state.player;
  const probe = { x: p.x - 14, y: p.y - 14, w: p.w + 28, h: p.h + 28 };
  return getRoom().interactables.find((it) => rectsOverlap(probe, it)) || null;
}

function doInteract() {
  const obj = nearbyInteractable();
  if (!obj) { addMessage("Nothing useful nearby."); return; }
  obj.interact();
}

function inspectArea() {
  const roomLines = {
    yard: "Wind rustles grass and old wood creaks around the cottage yard.",
    cottage: "Smoke, old ink, and sour herbs linger in the room.",
    forest: "Dense trees sway while crows watch from above.",
    beach: "Waves strike black stones under a steel sky.",
    cliff_pass: "Salt wind screams through narrow cliffs.",
    ruins: "Collapsed masonry hints this place predates the manor.",
    manor_gate: "An exposed road climbs toward iron and stone.",
    tower: "Dust hangs in stale tower air.",
  };
  addMessage(roomLines[state.roomId] || "You sense old magic nearby.");
}

function onKeyDown(e) {
  const k = e.key.toLowerCase();
  if (k === "w" || k === "arrowup") input.up = true;
  if (k === "s" || k === "arrowdown") input.down = true;
  if (k === "a" || k === "arrowleft") input.left = true;
  if (k === "d" || k === "arrowright") input.right = true;
  if (k === "e") doInteract();
  if (k === "i") addMessage(`Inventory: ${[...state.inventory].join(", ") || "nothing"}.`);
  if (k === " ") { e.preventDefault(); inspectArea(); }
}

function onKeyUp(e) {
  const k = e.key.toLowerCase();
  if (k === "w" || k === "arrowup") input.up = false;
  if (k === "s" || k === "arrowdown") input.down = false;
  if (k === "a" || k === "arrowleft") input.left = false;
  if (k === "d" || k === "arrowright") input.right = false;
}

function updatePlayer() {
  let dx = 0;
  let dy = 0;
  if (input.up) dy -= 1;
  if (input.down) dy += 1;
  if (input.left) dx -= 1;
  if (input.right) dx += 1;

  const moving = dx !== 0 || dy !== 0;
  if (moving && dx !== 0 && dy !== 0) {
    const n = Math.sqrt(2);
    dx /= n; dy /= n;
  }

  if (dx < 0) state.player.facing = "left";
  if (dx > 0) state.player.facing = "right";
  if (dy < 0) state.player.facing = "up";
  if (dy > 0) state.player.facing = "down";
  if (moving) state.player.step += 0.16;

  const nx = { ...state.player, x: state.player.x + dx * state.player.speed };
  if (canMoveTo(nx)) state.player.x = nx.x;
  const ny = { ...state.player, y: state.player.y + dy * state.player.speed };
  if (canMoveTo(ny)) state.player.y = ny.y;

  tryRoomTransition();
}

function drawInteractionHint() {
  const obj = nearbyInteractable();
  if (!obj) return;
  pxRect(18, 18, 350, 34, "rgba(12,10,8,0.75)");
  ctx.fillStyle = PAL.uiText;
  ctx.font = "18px Trebuchet MS";
  ctx.fillText(`Press E: ${obj.label}`, 28, 40);
}

function drawPlayer() {
  const p = state.player;
  const t = Math.floor(state.player.step) % 2;
  const yRatio = Math.max(0, Math.min(1, p.y / VIEW_H));
  const scale = 0.76 + yRatio * 0.45;
  const w = Math.round(24 * scale);
  const h = Math.round(40 * scale);
  const x = Math.round(p.x + p.w / 2 - w / 2);
  const y = Math.round(p.y + p.h - h + 2);

  // Shadow
  pxRect(x + 5, y + h - 4, w - 10, 4, "rgba(0,0,0,0.35)");

  // VGA character silhouette with tiny pose changes.
  pxRect(x + 6, y + 4, w - 12, 10, "#e6c69c");
  pxRect(x + 4, y + 14, w - 8, h - 16, "#6c4a2a");
  pxRect(x + 3 + t, y + h - 8, 7, 8, "#3d2a19");
  pxRect(x + w - 10 - t, y + h - 8, 7, 8, "#3d2a19");

  if (p.facing === "left") {
    pxRect(x - 2, y + 20, 6, 8, "#8f5e37");
  } else if (p.facing === "right") {
    pxRect(x + w - 4, y + 20, 6, 8, "#8f5e37");
  } else if (p.facing === "up") {
    pxRect(x + 8, y + 2, w - 16, 3, "#5b3f27");
  } else {
    pxRect(x + 8, y + h - 2, w - 16, 3, "#5b3f27");
  }
}

function drawTimeMoodOverlay() {
  const m = getMinuteOfDay();
  const isNight = m >= 19 * 60 || m < 6 * 60;
  const isLate = m >= 16 * 60 && m < 19 * 60;

  if (isLate) {
    ctx.fillStyle = "rgba(238, 142, 86, 0.09)";
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }
  if (isNight) {
    ctx.fillStyle = "rgba(24, 31, 58, 0.25)";
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }
}

function draw() {
  getRoom().draw();
  drawTimeMoodOverlay();
  drawPlayer();
  drawInteractionHint();

  if (state.flags.won) {
    pxRect(210, 220, 540, 110, "rgba(0,0,0,0.45)");
    ctx.fillStyle = PAL.uiText;
    ctx.font = "32px Trebuchet MS";
    ctx.fillText("Prototype Complete", 340, 270);
    ctx.font = "20px Trebuchet MS";
    ctx.fillText("Next: expand quests, verbs, and dialogue trees.", 255, 302);
  }
}

let lastFrameMs = performance.now();
function tick(nowMs) {
  const deltaMs = Math.min(120, Math.max(0, nowMs - lastFrameMs));
  lastFrameMs = nowMs;
  updateClockAndSchedule(deltaMs);
  updatePlayer();
  updateWizardDanger(deltaMs);
  draw();
  requestAnimationFrame(tick);
}

window.addEventListener("keydown", onKeyDown);
window.addEventListener("keyup", onKeyUp);

function init() {
  updateRoomUI();
  renderInventory();
  refreshObjective();
  refreshStatusUI();
  addMessage("Night falls over Llewdor. You must reach the wizard's tower.");
  addMessage("VGA mode active: all scenes and sprites are now code-rendered.");
  addMessage("Manannan leaves at ninth bell and returns at dusk.");
  requestAnimationFrame(tick);
}

init();
