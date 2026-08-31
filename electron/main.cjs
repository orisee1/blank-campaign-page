const { app, BrowserWindow, shell, session } = require("electron");
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

let server;
const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon", ".webmanifest": "application/manifest+json" };

function startLocalServer() {
  const root = path.join(__dirname, "..", "dist");
  server = http.createServer((request, response) => {
    const clean = decodeURIComponent((request.url || "/").split("?")[0]).replace(/^\/blank-campaign-page\/?/, "/");
    const requested = clean === "/" ? "index.html" : clean.replace(/^\//, "");
    const resolved = path.resolve(root, requested);
    if (!resolved.startsWith(path.resolve(root))) { response.writeHead(403); response.end("Forbidden"); return; }
    const file = fs.existsSync(resolved) && fs.statSync(resolved).isFile() ? resolved : path.join(root, "index.html");
    response.writeHead(200, { "content-type": mime[path.extname(file)] || "application/octet-stream", "cache-control": file.endsWith("index.html") ? "no-cache" : "public, max-age=31536000, immutable" });
    fs.createReadStream(file).pipe(response);
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server.address().port)));
}

async function createWindow() {
  const port = await startLocalServer();
  const window = new BrowserWindow({
    width: 1440, height: 920, minWidth: 390, minHeight: 650, show: false,
    backgroundColor: "#f4f2ec", title: "Central de Campanha",
    webPreferences: { preload: path.join(__dirname, "preload.cjs"), contextIsolation: true, sandbox: true, nodeIntegration: false },
  });
  window.once("ready-to-show", () => window.show());
  window.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:\/\//.test(url)) shell.openExternal(url); return { action: "deny" }; });
  await window.loadURL(`http://127.0.0.1:${port}/blank-campaign-page/`);
}

app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((_contents, permission, callback) => callback(["notifications", "clipboard-sanitized-write"].includes(permission)));
  createWindow();
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
app.on("before-quit", () => server?.close());
