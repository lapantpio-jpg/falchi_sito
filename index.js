const storageKey = "falchiBlogComments";

const textarea = document.getElementById("blog-comment");
const saveButton = document.getElementById("save-comment");

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

if (saveButton && textarea) {
  saveButton.addEventListener("click", () => {
    const message = textarea.value.trim();
    if (!message) {
      return;
    }

    const comments = getComments();
    comments.push({
      text: message,
      createdAt: new Date().toISOString(),
    });

    saveComments(comments);
    textarea.value = "";
    textarea.focus();
  });
}
