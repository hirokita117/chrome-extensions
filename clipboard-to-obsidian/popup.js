const SETTING_KEYS = ["vault", "folder", "tags"];

async function loadSettings() {
  const data = await chrome.storage.local.get(SETTING_KEYS);
  for (const key of SETTING_KEYS) {
    if (data[key]) document.getElementById(key).value = data[key];
  }
  await loadClipboard(false);
}

async function loadClipboard(fromUserAction) {
  const preview = document.getElementById("clipboard-preview");
  try {
    const text = await navigator.clipboard.readText();
    preview.value = text || "(クリップボードが空です)";
  } catch {
    preview.value = fromUserAction
      ? "(クリップボードを読み取れませんでした)"
      : "(自動読み取りに失敗。下の「再取得」を押してください)";
  }
}

function saveSettings() {
  const settings = {};
  for (const key of SETTING_KEYS) {
    settings[key] = document.getElementById(key).value;
  }
  chrome.storage.local.set(settings);
}

function showStatus(message, isError) {
  const el = document.getElementById("status");
  el.textContent = message;
  el.className = isError ? "error" : "success";
}

function generateTitle() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

function buildFrontmatter(tags) {
  const lines = ["---"];
  if (tags.length > 0) {
    lines.push(`tags: [${tags.join(", ")}]`);
  }
  const today = new Date().toISOString().split("T")[0];
  lines.push(`created: ${today}`);
  lines.push("---");
  return lines.join("\n");
}

async function sendToObsidian() {
  const vault = document.getElementById("vault").value.trim();
  if (!vault) {
    showStatus("Vault名を入力してください", true);
    return;
  }

  let clipText;
  try {
    clipText = await navigator.clipboard.readText();
  } catch (e) {
    showStatus("クリップボードの読み取りに失敗しました", true);
    return;
  }

  if (!clipText) {
    showStatus("クリップボードが空です", true);
    return;
  }

  saveSettings();

  const folder = document.getElementById("folder").value.trim();
  const tagsRaw = document.getElementById("tags").value.trim();
  const title = document.getElementById("title").value.trim() || generateTitle();

  const tags = tagsRaw
    ? tagsRaw.split(",").map((t) => t.trim()).filter(Boolean)
    : [];

  const frontmatter = buildFrontmatter(tags);
  const content = `${frontmatter}\n\n${clipText}`;

  const filePath = folder ? `${folder}/${title}` : title;

  const uri =
    `obsidian://new?vault=${encodeURIComponent(vault)}` +
    `&file=${encodeURIComponent(filePath)}` +
    `&content=${encodeURIComponent(content)}`;

  window.open(uri);
  showStatus("Obsidianに送信しました", false);
}

document.addEventListener("DOMContentLoaded", loadSettings);

for (const key of SETTING_KEYS) {
  document.getElementById(key).addEventListener("input", saveSettings);
}

document.getElementById("refresh-clipboard").addEventListener("click", () => {
  loadClipboard(true);
});
document.getElementById("send").addEventListener("click", sendToObsidian);

window.addEventListener("focus", () => {
  loadClipboard(false);
});
