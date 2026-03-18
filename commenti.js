const storageKey = "falchiBlogComments";
const adminSessionKey = "falchiAdminLogged";
const adminUsernameValue = "Falchi";
const adminPasswordValue = "Campetti";

const commentsList = document.getElementById("comments-list");
const adminUsernameInput = document.getElementById("admin-username");
const adminPasswordInput = document.getElementById("admin-password");
const adminLoginButton = document.getElementById("admin-login");
const adminLogoutButton = document.getElementById("admin-logout");
const adminStatus = document.getElementById("admin-status");

let isAdminLogged = sessionStorage.getItem(adminSessionKey) === "true";

function getComments() {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveComments(comments) {
  localStorage.setItem(storageKey, JSON.stringify(comments));
}

function updateAdminUI(message) {
  if (!adminStatus || !adminUsernameInput || !adminPasswordInput) {
    return;
  }

  adminStatus.textContent =
    message ||
    (isAdminLogged
      ? "Accesso amministratore attivo."
      : "Accesso non effettuato.");
  adminUsernameInput.disabled = isAdminLogged;
  adminPasswordInput.disabled = isAdminLogged;
}

function loginAsAdmin() {
  if (!adminUsernameInput || !adminPasswordInput) {
    return;
  }

  const username = adminUsernameInput.value.trim();
  const password = adminPasswordInput.value;

  if (username === adminUsernameValue && password === adminPasswordValue) {
    isAdminLogged = true;
    sessionStorage.setItem(adminSessionKey, "true");
    adminPasswordInput.value = "";
    updateAdminUI("Accesso amministratore riuscito.");
    renderComments();
    return;
  }

  updateAdminUI("Credenziali non valide.");
}

function logoutAdmin() {
  isAdminLogged = false;
  sessionStorage.removeItem(adminSessionKey);
  if (adminUsernameInput) {
    adminUsernameInput.value = "";
    adminUsernameInput.disabled = false;
  }
  if (adminPasswordInput) {
    adminPasswordInput.value = "";
    adminPasswordInput.disabled = false;
  }
  updateAdminUI("Accesso amministratore disattivato.");
  renderComments();
}

function removeComment(index) {
  if (!isAdminLogged) {
    updateAdminUI("Solo l'amministratore puo eliminare i commenti.");
    return;
  }

  const comments = getComments();
  if (index < 0 || index >= comments.length) {
    return;
  }

  comments.splice(index, 1);
  saveComments(comments);
  renderComments();
}

function renderComments() {
  if (!commentsList) {
    return;
  }

  const comments = getComments();
  commentsList.innerHTML = "";

  if (comments.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "Nessun commento salvato.";
    commentsList.appendChild(empty);
    return;
  }

  comments.forEach((comment, index) => {
    const item = document.createElement("article");
    item.className = "comment-card";

    const text = document.createElement("p");
    text.className = "comment-text";
    text.textContent = `${index + 1}. ${comment.text}`;
    item.appendChild(text);

    if (isAdminLogged) {
      const deleteButton = document.createElement("button");
      deleteButton.className = "delete-comment";
      deleteButton.type = "button";
      deleteButton.textContent = "Elimina";
      deleteButton.addEventListener("click", () => removeComment(index));
      item.appendChild(deleteButton);
    }

    commentsList.appendChild(item);
  });
}

if (adminLoginButton) {
  adminLoginButton.addEventListener("click", loginAsAdmin);
}

if (adminLogoutButton) {
  adminLogoutButton.addEventListener("click", logoutAdmin);
}

updateAdminUI();

renderComments();
