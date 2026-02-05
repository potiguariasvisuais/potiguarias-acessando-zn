// ====== CONFIG (cole suas chaves quando tiver) ======
const SUPABASE_URL = "COLE_AQUI_SUA_SUPABASE_URL";
const SUPABASE_ANON_KEY = "COLE_AQUI_SUA_ANON_PUBLIC_KEY";

// ====== UI REFS ======
const garden = document.getElementById("garden");

const composer = document.getElementById("composer");
const openComposer = document.getElementById("openComposer");
const closeComposer = document.getElementById("closeComposer");

const form = document.getElementById("muralForm");
const textEl = document.getElementById("text");
const mediaEl = document.getElementById("media");
const statusEl = document.getElementById("status");
const sendBtn = document.getElementById("sendBtn");

const viewer = document.getElementById("viewer");
const closeViewer = document.getElementById("closeViewer");
const viewerImg = document.getElementById("viewerImg");
const viewerText = document.getElementById("viewerText");
const viewerMeta = document.getElementById("viewerMeta");

// ====== Helpers ======
function setStatus(msg) { statusEl.textContent = msg || ""; }

function closeDialogSafe(dlg){
  try { dlg.close(); } catch {}
}

// Fecha clicando fora do card
composer?.addEventListener("click", (e) => {
  const formEl = composer.querySelector("form");
  if (!formEl) return;
  const r = formEl.getBoundingClientRect();
  const inside = (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom);
  if (!inside) closeDialogSafe(composer);
});

// ====== Botão “Deixar minha marca” (fix robusto) ======
openComposer?.addEventListener("click", () => {
  // dialog.showModal() existe no Chrome moderno
  if (composer?.showModal) composer.showModal();
  else composer?.setAttribute("open", ""); // fallback
});

closeComposer?.addEventListener("click", () => closeDialogSafe(composer));
closeViewer?.addEventListener("click", () => closeDialogSafe(viewer));

// ====== Supabase (não deixa o site quebrar) ======
let supabase = null;
function supabaseReady(){
  const ok =
    typeof window.supabase !== "undefined" &&
    SUPABASE_URL && SUPABASE_ANON_KEY &&
    !SUPABASE_URL.includes("COLE_AQUI") &&
    !SUPABASE_ANON_KEY.includes("COLE_AQUI");

  if (!ok) return false;

  if (!supabase) {
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return true;
}

const MAX_BYTES = 2 * 1024 * 1024; // 2MB

function validateFile(file){
  if (!file) return null;
  if (file.size > MAX_BYTES) return "Arquivo acima de 2MB. Envie um arquivo menor.";
  return null;
}

function formatDate(iso){
  try {
    const d = new Date(iso);
    return d.toLocaleString("pt-BR", { dateStyle:"short", timeStyle:"short" });
  } catch { return ""; }
}

// ====== Upload multimídia ======
async function uploadMediaIfAny(file){
  if (!file) return null;

  // Guarda em Storage "mural"
  const ext = (file.name.split(".").pop() || "bin").toLowerCase();
  const path = `${crypto.randomUUID()}.${ext}`;

  const { error: upErr } = await supabase
    .storage
    .from("mural")
    .upload(path, file, { contentType: file.type, upsert: false });

  if (upErr) throw upErr;

  const { data } = supabase.storage.from("mural").getPublicUrl(path);
  return data?.publicUrl || null;
}

async function insertPost(text, mediaUrl, mediaType){
  const { error } = await supabase
    .from("mural_posts")
    .insert([{ text: text || null, image_url: mediaUrl, media_type: mediaType || null }]);

  if (error) throw error;
}

// ====== Render “jardim” (se você já tinha, mantém o seu; aqui deixo simples) ======
function hashString(str){
  let h = 2166136261;
  for (let i=0;i<str.length;i++){
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function seeded01(seed){
  let x = seed || 123456789;
  x ^= x << 13; x >>>= 0;
  x ^= x >> 17; x >>>= 0;
  x ^= x << 5;  x >>>= 0;
  return (x >>> 0) / 4294967296;
}
function pickEmoji(id){
  const options = ["✶","✦","✺","✹","❋","✷","☼","☾","⟡","✧","✩","✪"];
  return options[hashString(id) % options.length];
}

function openViewer(post){
  // Para mídia: se for imagem, mostra no <img>. Se não for, mostra link no texto.
  const isImage = (post.media_type || "").startsWith("image/");
  if (post.image_url && isImage){
    viewerImg.src = post.image_url;
    viewerImg.style.display = "block";
    viewerImg.alt = "Imagem enviada ao mural";
  } else {
    viewerImg.removeAttribute("src");
    viewerImg.style.display = "none";
    viewerImg.alt = "";
  }

  let t = post.text || "";
  if (post.image_url && !isImage){
    t += (t ? "\n\n" : "") + `Arquivo: ${post.image_url}`;
  }

  viewerText.textContent = t;
  viewerMeta.textContent = post.created_at ? `Enviado em ${formatDate(post.created_at)}` : "";
  viewer.showModal();
}

function clearGarden(){ if (garden) garden.innerHTML = ""; }

function createSeedEl(post, idx){
  const el = document.createElement("button");
  el.className = "seed";
  el.type = "button";

  const base = hashString(post.id);
  const s1 = base ^ (idx * 2654435761);
  const s2 = (base + 1013904223) ^ (idx * 1597334677);

  const x = 6 + seeded01(s1) * 88;
  const y = 12 + seeded01(s2) * 76;
  el.style.left = x.toFixed(2) + "%";
  el.style.top = y.toFixed(2) + "%";

  const hasMedia = !!post.image_url;
  const isImage = (post.media_type || "").startsWith("image/");

  if (hasMedia && isImage){
    const img = document.createElement("img");
    img.className = "seedThumb";
    img.src = post.image_url;
    img.alt = "";
    el.appendChild(img);
  } else {
    const span = document.createElement("span");
    span.className = "emoji";
    span.textContent = pickEmoji(post.id);
    el.appendChild(span);
  }

  el.addEventListener("click", () => openViewer(post));
  return el;
}

async function fetchPosts(){
  const { data, error } = await supabase
    .from("mural_posts")
    .select("id, created_at, text, image_url, media_type")
    .order("created_at", { ascending: false })
    .limit(220);

  if (error) throw error;
  return data || [];
}

async function renderGarden(){
  if (!garden) return;
  if (!supabaseReady()) return; // sem supabase, não renderiza posts
  clearGarden();

  const posts = (await fetchPosts()).reverse();
  posts.forEach((p, idx) => garden.appendChild(createSeedEl(p, idx)));
}

// ====== Submit ======
form?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const text = (textEl.value || "").trim();
  const file = mediaEl.files?.[0] || null;

  const fileError = validateFile(file);
  if (fileError){
    setStatus(fileError);
    return;
  }
  if (!text && !file){
    setStatus("Escreva um texto e/ou envie uma mídia ✨");
    return;
  }

  // Mesmo que supabase não esteja pronto, o modal funciona.
  if (!supabaseReady()){
    setStatus("Falta configurar o Supabase (URL e anon key) no app.js.");
    return;
  }

  try {
    sendBtn.disabled = true;
    setStatus("Enviando…");

    const mediaUrl = await uploadMediaIfAny(file);
    const mediaType = file?.type || null;

    // ⚠️ precisa adicionar a coluna media_type (abaixo explico)
    await insertPost(text, mediaUrl, mediaType);

    textEl.value = "";
    mediaEl.value = "";
    setStatus("Recebido ✶ Sua marca já está no céu.");

    await renderGarden();
    setTimeout(() => closeDialogSafe(composer), 450);
  } catch (err) {
    console.error(err);
    setStatus("Não consegui enviar agora. Tente novamente.");
  } finally {
    sendBtn.disabled = false;
  }
});

// Start
renderGarden();
