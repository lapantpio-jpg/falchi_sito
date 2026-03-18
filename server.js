const http = require("http");
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const PORT = process.env.PORT || 43123;
const HTML_PAGES = new Set([
  "index.html",
  "chi-siamo.html",
  "commenti.html",
  "nodi.html",
  "legature.html",
  "costruzioni.html",
]);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

function sendJson(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function isAllowedHtmlTarget(pagePath) {
  const normalized = pagePath.replace(/\\\\/g, "/");
  const allowed = new Set([
    "html/index.html",
    "html/chi-siamo.html",
    "html/commenti.html",
    "html/nodi.html",
    "html/legature.html",
    "html/costruzioni.html",
  ]);
  return allowed.has(normalized);
}

async function handleSavePage(req, res) {
  let raw = "";
  req.on("data", (chunk) => {
    raw += chunk;
    if (raw.length > 5 * 1024 * 1024) {
      req.destroy();
    }
  });

  req.on("end", async () => {
    try {
      const body = JSON.parse(raw || "{}");
      const pagePath = String(body.pagePath || "");
      const html = String(body.html || "");

      if (!isAllowedHtmlTarget(pagePath)) {
        sendJson(res, 400, {
          error: "File non consentito per il salvataggio.",
        });
        return;
      }

      if (!html.trim().toLowerCase().startsWith("<!doctype html>")) {
        sendJson(res, 400, { error: "Contenuto HTML non valido." });
        return;
      }

      const fullPath = path.join(ROOT, pagePath);
      await fsp.writeFile(fullPath, `${html.trim()}\n`, "utf8");
      sendJson(res, 200, { ok: true, savedPath: pagePath });
    } catch (error) {
      sendJson(res, 500, {
        error: `Errore durante il salvataggio: ${error.message}`,
      });
    }
  });
}

function resolveFilePath(urlPath) {
  if (urlPath === "/") {
    return path.join(ROOT, "html", "index.html");
  }

  const decodedPath = decodeURIComponent(urlPath).replace(/\\/g, "/");
  const pageName = decodedPath.split("/").pop();
  const relativePath =
    pageName && HTML_PAGES.has(pageName) && !decodedPath.startsWith("/html/")
      ? `html/${pageName}`
      : decodedPath.replace(/^\/+/, "");
  const safePath = path.normalize(relativePath).replace(/^\\+/, "");
  const filePath = path.join(ROOT, safePath);
  if (!filePath.startsWith(ROOT)) {
    return null;
  }
  return filePath;
}

const server = http.createServer(async (req, res) => {
  const requestUrl = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === "POST" && requestUrl.pathname === "/api/save-page") {
    await handleSavePage(req, res);
    return;
  }

  if (req.method !== "GET") {
    sendJson(res, 405, { error: "Metodo non supportato." });
    return;
  }

  const filePath = resolveFilePath(requestUrl.pathname);
  if (!filePath) {
    sendJson(res, 400, { error: "Percorso non valido." });
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      sendJson(res, 404, { error: "Risorsa non trovata." });
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const mime = MIME[ext] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": mime });
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, () => {
  console.log(`Falchi sito attivo su http://localhost:${PORT}`);
});
