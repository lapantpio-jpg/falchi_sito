const SITE_ADMIN_USER = "Falchi";
const SITE_ADMIN_PASSWORD = "Campetti";
const SITE_ADMIN_SESSION_KEY = "falchiSiteAdminSession";
const SITE_ADMIN_PANEL_OPEN_KEY = "falchiSiteAdminPanelOpen";
const SITE_ADMIN_DRAFT_PREFIX = "falchiSiteDraft:";

let siteAdminEnabled =
  sessionStorage.getItem(SITE_ADMIN_SESSION_KEY) === "true";
let selectedElement = null;
let draggedElement = null;
let autoSaveTimer = null;
let saveInFlight = false;
let queuedAutoSave = false;
let autoSaveFallbackNotified = false;

function buildSiteAdminPanel() {
  if (document.querySelector(".site-admin-footer")) {
    return;
  }

  const footer = document.createElement("footer");
  footer.className = "site-admin-footer";
  footer.innerHTML = `
    <div class="site-admin-header">
      <span class="site-admin-title">Admin sito</span>
      <button type="button" id="site-admin-toggle">Mostra/Nascondi</button>
    </div>
    <div class="site-admin-body" id="site-admin-body" hidden>
      <div>
        <div class="site-admin-login">
          <input id="site-admin-user" type="text" placeholder="Nome utente" autocomplete="username" />
          <input id="site-admin-pass" type="password" placeholder="Password" autocomplete="current-password" />
          <button type="button" id="site-admin-login">Accedi</button>
          <button type="button" id="site-admin-logout">Esci</button>
        </div>
        <p class="site-admin-status" id="site-admin-status">Admin non attivo.</p>
      </div>
      <div>
        <div class="site-admin-style">
          <label>Colore box <input id="site-admin-bg" type="color" value="#808080" /></label>
          <label>Colore testo <input id="site-admin-color" type="color" value="#ffffff" /></label>
          <label>Larghezza <input id="site-admin-width" type="number" min="80" step="10" placeholder="px" /></label>
          <label>Altezza <input id="site-admin-height" type="number" min="50" step="10" placeholder="px" /></label>
          <label>Font <input id="site-admin-font" type="number" min="8" step="1" placeholder="px" /></label>
        </div>
        <div class="site-admin-actions">
          <button type="button" id="site-admin-insert-image">Inserisci immagine</button>
          <button type="button" id="site-admin-reset-style">Ripristina stile</button>
          <button type="button" id="site-admin-restore-local">Ripristina bozza locale</button>
          <button type="button" id="site-admin-save">Salva nel file</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(footer);
}

function isPanelOpen() {
  return sessionStorage.getItem(SITE_ADMIN_PANEL_OPEN_KEY) === "true";
}

function setPanelVisibility(isOpen) {
  const panelBody = document.getElementById("site-admin-body");
  const toggleButton = document.getElementById("site-admin-toggle");

  if (panelBody) {
    panelBody.hidden = !isOpen;
  }

  if (toggleButton) {
    toggleButton.textContent = isOpen ? "Nascondi" : "Mostra";
    toggleButton.setAttribute("aria-expanded", isOpen ? "true" : "false");
  }

  sessionStorage.setItem(SITE_ADMIN_PANEL_OPEN_KEY, isOpen ? "true" : "false");
}

function updateStatus(message) {
  const status = document.getElementById("site-admin-status");
  if (status) {
    status.textContent = message;
  }
}

function getEditableTargets() {
  return Array.from(
    document.querySelectorAll(
      ".box, .box-text, h1, h2, h3, h4, h5, h6, p, li, a, span, strong, em",
    ),
  ).filter((node) => !node.closest(".site-admin-footer"));
}

function setAdminMode(enabled) {
  siteAdminEnabled = enabled;

  if (enabled) {
    sessionStorage.setItem(SITE_ADMIN_SESSION_KEY, "true");
    document.body.classList.add("admin-edit-mode");
    updateStatus(
      "Admin attivo: clicca un elemento per modificarlo, trascina i box e salva nel file.",
    );
  } else {
    sessionStorage.removeItem(SITE_ADMIN_SESSION_KEY);
    document.body.classList.remove("admin-edit-mode");
    updateStatus("Admin non attivo.");
    clearSelection();
  }

  getEditableTargets().forEach((node) => {
    const isTextContainer = node.matches(
      "h1, h2, h3, h4, h5, h6, p, li, a, span, strong, em, .box-text",
    );
    node.classList.add("admin-edit-target");
    node.setAttribute(
      "contenteditable",
      enabled && isTextContainer ? "true" : "false",
    );

    if (node.classList.contains("box")) {
      node.setAttribute("draggable", enabled ? "true" : "false");
    }
  });
}

function clearSelection() {
  if (selectedElement) {
    selectedElement.classList.remove("admin-selected");
  }
  selectedElement = null;
}

function setSelection(node) {
  clearSelection();
  selectedElement = node;
  selectedElement.classList.add("admin-selected");
  syncStyleInputs();
}

function syncStyleInputs() {
  if (!selectedElement) {
    return;
  }

  const computed = getComputedStyle(selectedElement);
  const bgInput = document.getElementById("site-admin-bg");
  const colorInput = document.getElementById("site-admin-color");
  const widthInput = document.getElementById("site-admin-width");
  const heightInput = document.getElementById("site-admin-height");
  const fontInput = document.getElementById("site-admin-font");

  if (bgInput) {
    bgInput.value = rgbToHex(computed.backgroundColor);
  }
  if (colorInput) {
    colorInput.value = rgbToHex(computed.color);
  }
  if (widthInput) {
    widthInput.value = parseInt(computed.width, 10) || "";
  }
  if (heightInput) {
    heightInput.value = parseInt(computed.height, 10) || "";
  }
  if (fontInput) {
    fontInput.value = parseInt(computed.fontSize, 10) || "";
  }
}

function rgbToHex(rgb) {
  if (!rgb || rgb === "transparent" || rgb === "rgba(0, 0, 0, 0)") {
    return "#000000";
  }

  const match = rgb.match(/\d+/g);
  if (!match || match.length < 3) {
    return "#000000";
  }
  const [r, g, b] = match.map(Number);
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

function applyStyleChange(styleField) {
  if (!siteAdminEnabled || !selectedElement) {
    return;
  }

  const bgInput = document.getElementById("site-admin-bg");
  const colorInput = document.getElementById("site-admin-color");
  const widthInput = document.getElementById("site-admin-width");
  const heightInput = document.getElementById("site-admin-height");
  const fontInput = document.getElementById("site-admin-font");

  if (styleField === "backgroundColor" && bgInput && bgInput.value) {
    selectedElement.style.backgroundColor = bgInput.value;
  }
  if (styleField === "color" && colorInput && colorInput.value) {
    selectedElement.style.color = colorInput.value;
  }
  if (styleField === "width" && widthInput && widthInput.value) {
    selectedElement.style.width = `${widthInput.value}px`;
  }
  if (styleField === "height" && heightInput && heightInput.value) {
    selectedElement.style.height = `${heightInput.value}px`;
  }
  if (styleField === "fontSize" && fontInput && fontInput.value) {
    selectedElement.style.fontSize = `${fontInput.value}px`;
  }

  scheduleAutoSave();
}

function resetSelectedStyle() {
  if (!siteAdminEnabled) {
    updateStatus("Accedi come admin prima di modificare lo stile.");
    return;
  }

  if (!selectedElement) {
    updateStatus("Seleziona prima un elemento da ripristinare.");
    return;
  }

  selectedElement.style.removeProperty("background-color");
  selectedElement.style.removeProperty("color");
  selectedElement.style.removeProperty("width");
  selectedElement.style.removeProperty("height");
  selectedElement.style.removeProperty("font-size");

  syncStyleInputs();
  updateStatus("Stile ripristinato per l'elemento selezionato.");
  scheduleAutoSave();
}

function currentPagePath() {
  const pathname = window.location.pathname.replace(/\\/g, "/");
  const marker = pathname.lastIndexOf("/html/");
  if (marker !== -1) {
    return pathname.slice(marker + 1);
  }
  const fileName = pathname.split("/").pop();
  return fileName ? `html/${fileName}` : "html/index.html";
}

function draftStorageKey() {
  return `${SITE_ADMIN_DRAFT_PREFIX}${currentPagePath()}`;
}

function saveLocalDraft(html) {
  if (!html || !html.trim()) {
    return;
  }

  const payload = {
    updatedAt: new Date().toISOString(),
    html,
  };

  localStorage.setItem(draftStorageKey(), JSON.stringify(payload));
}

function loadLocalDraft() {
  try {
    const raw = localStorage.getItem(draftStorageKey());
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.html !== "string") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function restoreLocalDraft() {
  if (!siteAdminEnabled) {
    updateStatus("Accedi come admin per ripristinare una bozza locale.");
    return;
  }

  const draft = loadLocalDraft();
  if (!draft) {
    updateStatus("Nessuna bozza locale trovata per questa pagina.");
    return;
  }

  const confirmRestore = window.confirm(
    "Ripristinare la bozza locale salvata nel browser?",
  );
  if (!confirmRestore) {
    return;
  }

  document.open();
  document.write(draft.html);
  document.close();
}

function notifyAutoSaveFallbackOnce() {
  if (autoSaveFallbackNotified) {
    return;
  }
  autoSaveFallbackNotified = true;
  updateStatus(
    "Server non persistente: modifiche salvate in bozza locale nel browser.",
  );
}

async function sendSaveRequest(showSuccessMessage, fromAutoSave = false) {
  if (!siteAdminEnabled) {
    updateStatus("Accedi come admin prima di salvare.");
    return;
  }

  if (window.location.protocol === "file:") {
    updateStatus("Apri il sito con il server locale per salvare sui file.");
    return;
  }

  const html = buildSavableHtml();
  saveLocalDraft(html);

  if (saveInFlight) {
    queuedAutoSave = true;
    return;
  }

  saveInFlight = true;

  try {
    const response = await fetch("/api/save-page", {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({
        pagePath: currentPagePath(),
        html,
      }),
    });

    const result = await response.json();
    if (!response.ok) {
      if (fromAutoSave) {
        notifyAutoSaveFallbackOnce();
      } else {
        updateStatus(
          `${result.error || "Errore durante il salvataggio file."} Bozza locale salvata.`,
        );
      }
      return;
    }

    autoSaveFallbackNotified = false;
    if (showSuccessMessage) {
      updateStatus(
        `Salvato nel file: ${result.savedPath} (bozza locale aggiornata).`,
      );
    }
  } catch {
    if (fromAutoSave) {
      notifyAutoSaveFallbackOnce();
    } else {
      updateStatus(
        "Impossibile contattare il server di salvataggio. Bozza locale salvata.",
      );
    }
  } finally {
    saveInFlight = false;
    if (queuedAutoSave) {
      queuedAutoSave = false;
      scheduleAutoSave(0);
    }
  }
}

function buildSavableHtml() {
  const clone = document.documentElement.cloneNode(true);

  clone.querySelectorAll(".site-admin-footer").forEach((node) => node.remove());
  clone
    .querySelectorAll("script[src^='chrome-extension://']")
    .forEach((node) => node.remove());
  clone
    .querySelectorAll("[data-merge-styles]")
    .forEach((node) => node.remove());
  clone
    .querySelectorAll(".admin-selected")
    .forEach((node) => node.classList.remove("admin-selected"));
  clone
    .querySelectorAll(".admin-drag-over")
    .forEach((node) => node.classList.remove("admin-drag-over"));
  clone
    .querySelectorAll(".admin-edit-target")
    .forEach((node) => node.classList.remove("admin-edit-target"));
  clone
    .querySelectorAll("[contenteditable]")
    .forEach((node) => node.removeAttribute("contenteditable"));
  clone
    .querySelectorAll("[draggable]")
    .forEach((node) => node.removeAttribute("draggable"));

  const body = clone.querySelector("body");
  if (body) {
    body.classList.remove("admin-edit-mode");
  }

  return `<!doctype html>\n${clone.outerHTML}`;
}

function savePageToFile() {
  return sendSaveRequest(true, false);
}

function scheduleAutoSave(delayMs = 900) {
  if (!siteAdminEnabled || window.location.protocol === "file:") {
    return;
  }

  if (autoSaveTimer) {
    clearTimeout(autoSaveTimer);
  }

  autoSaveTimer = setTimeout(() => {
    autoSaveTimer = null;
    sendSaveRequest(false, true);
  }, delayMs);
}

function insertImage() {
  if (!siteAdminEnabled) {
    updateStatus("Accedi come admin per inserire immagini.");
    return;
  }

  const src = window.prompt(
    "Inserisci il percorso immagine (es. ../immagini/foto.jpg):",
  );
  if (!src) {
    return;
  }

  if (selectedElement && selectedElement.tagName === "IMG") {
    selectedElement.src = src;
    scheduleAutoSave();
    return;
  }

  const img = document.createElement("img");
  img.src = src;
  img.alt = "Immagine inserita da admin";
  img.style.maxWidth = "100%";
  img.style.height = "auto";

  const container = selectedElement || document.body;
  container.appendChild(img);
  scheduleAutoSave();
}

function bindAdminEvents() {
  const toggle = document.getElementById("site-admin-toggle");
  const body = document.getElementById("site-admin-body");
  const userInput = document.getElementById("site-admin-user");
  const passInput = document.getElementById("site-admin-pass");
  const loginButton = document.getElementById("site-admin-login");
  const logoutButton = document.getElementById("site-admin-logout");
  const saveButton = document.getElementById("site-admin-save");
  const resetStyleButton = document.getElementById("site-admin-reset-style");
  const imageButton = document.getElementById("site-admin-insert-image");
  const restoreLocalButton = document.getElementById(
    "site-admin-restore-local",
  );
  const styleInputs = [
    {
      element: document.getElementById("site-admin-bg"),
      styleField: "backgroundColor",
    },
    {
      element: document.getElementById("site-admin-color"),
      styleField: "color",
    },
    {
      element: document.getElementById("site-admin-width"),
      styleField: "width",
    },
    {
      element: document.getElementById("site-admin-height"),
      styleField: "height",
    },
    {
      element: document.getElementById("site-admin-font"),
      styleField: "fontSize",
    },
  ];

  if (toggle && body) {
    setPanelVisibility(isPanelOpen());

    toggle.addEventListener("click", () => {
      setPanelVisibility(body.hidden);
    });
  }

  if (loginButton && userInput && passInput) {
    loginButton.addEventListener("click", () => {
      const username = userInput.value.trim();
      const password = passInput.value;
      if (username === SITE_ADMIN_USER && password === SITE_ADMIN_PASSWORD) {
        setAdminMode(true);
        passInput.value = "";
      } else {
        updateStatus("Credenziali non valide.");
      }
    });
  }

  if (logoutButton) {
    logoutButton.addEventListener("click", () => {
      setAdminMode(false);
      if (userInput) {
        userInput.value = "";
      }
      if (passInput) {
        passInput.value = "";
      }
    });
  }

  if (saveButton) {
    saveButton.addEventListener("click", savePageToFile);
  }

  if (resetStyleButton) {
    resetStyleButton.addEventListener("click", resetSelectedStyle);
  }

  if (imageButton) {
    imageButton.addEventListener("click", insertImage);
  }

  if (restoreLocalButton) {
    restoreLocalButton.addEventListener("click", restoreLocalDraft);
  }

  styleInputs.forEach(({ element, styleField }) => {
    if (element) {
      element.addEventListener("input", () => {
        applyStyleChange(styleField);
      });
    }
  });

  document.addEventListener(
    "click",
    (event) => {
      if (!siteAdminEnabled) {
        return;
      }

      const panel = document.querySelector(".site-admin-footer");
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }

      if (panel && panel.contains(target)) {
        return;
      }

      if (target.matches("a")) {
        event.preventDefault();
      }

      const selectable = target.closest(
        ".box, .box-text, h1, h2, h3, h4, h5, h6, p, li, a, span, strong, em, img",
      );
      if (selectable && !selectable.closest(".site-admin-footer")) {
        setSelection(selectable);
      }
    },
    true,
  );

  document.addEventListener("keydown", (event) => {
    if (!siteAdminEnabled) {
      return;
    }

    const key = String(event.key || "").toLowerCase();
    const isSaveShortcut = (event.ctrlKey || event.metaKey) && key === "s";
    if (!isSaveShortcut) {
      return;
    }

    event.preventDefault();
    savePageToFile();
  });

  document.addEventListener(
    "input",
    (event) => {
      if (!siteAdminEnabled) {
        return;
      }

      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }

      if (target.closest(".site-admin-footer")) {
        return;
      }

      if (
        target.isContentEditable ||
        target.matches("input, textarea, select")
      ) {
        scheduleAutoSave();
      }
    },
    true,
  );

  const boxes = document.querySelectorAll(".box");
  boxes.forEach((box) => {
    box.addEventListener("dragstart", (event) => {
      if (!siteAdminEnabled) {
        event.preventDefault();
        return;
      }
      draggedElement = box;
      event.dataTransfer.effectAllowed = "move";
    });

    box.addEventListener("dragover", (event) => {
      if (!siteAdminEnabled) {
        return;
      }
      event.preventDefault();
      box.classList.add("admin-drag-over");
    });

    box.addEventListener("dragleave", () => {
      box.classList.remove("admin-drag-over");
    });

    box.addEventListener("drop", (event) => {
      if (!siteAdminEnabled) {
        return;
      }
      event.preventDefault();
      box.classList.remove("admin-drag-over");

      if (!draggedElement || draggedElement === box) {
        return;
      }

      const parent = box.parentNode;
      if (!parent) {
        return;
      }

      const rect = box.getBoundingClientRect();
      const insertAfter = event.clientY > rect.top + rect.height / 2;
      if (insertAfter) {
        parent.insertBefore(draggedElement, box.nextSibling);
      } else {
        parent.insertBefore(draggedElement, box);
      }

      scheduleAutoSave();
    });

    box.addEventListener("dragend", () => {
      draggedElement = null;
      document
        .querySelectorAll(".box.admin-drag-over")
        .forEach((item) => item.classList.remove("admin-drag-over"));
    });
  });

  if (siteAdminEnabled) {
    setAdminMode(true);
  } else {
    updateStatus("Admin non attivo.");
  }
}

if (document.body) {
  buildSiteAdminPanel();
  bindAdminEvents();
}
