// Potiguarias Visuais — Acessando a ZN
// app.js (corrigido e completo)

// ====== CONFIG ======
const SUPABASE_URL = "https://bjxcgnhjfqcpulmzlahp.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_FmaJ0Zp4JIj1teRUPFwBCw_dqt1YpBo";

// ====== LIMITES ======
const MAX_BYTES = 2 * 1024 * 1024; // 2MB

// ====== Supabase (UMA ÚNICA declaração) ======
let supabaseClient = null; // <-- NÃO crie outra variável chamada "supabase"

// Inicializa o Supabase apenas quando a lib estiver carregada
function supabaseReady() {
  if (typeof window.supabase === "undefined") return false;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return false;

  if (!supabaseClient) {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return true;
}

// ====== UI REFS (após DOM pronto) ======
let garden, composer, openComposer, closeComposer;
let form, textEl, mediaEl, statusEl, sendBtn;
let viewer, closeViewer, viewerImg, viewerText, viewerMeta;

// ====== Helpers ======
function setStatus(msg) {
  if (!statusEl) return;
  statusEl.textContent = msg || "";
}

function closeDialogSafe(dlg) {
  try { dlg.close(); } catch {}
}

function validateFile(file) {
  if (!file) return null;
  if (file.size > MAX_BYTES) return "Arquivo acima de 2MB. Envie um arquivo menor.";
  return null;
}

function formatDate(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return "";
  }
}

// ====== Upload multimídia (imagem/vídeo/áudio) ======
async function uploadMediaIfAny(file) {
  if (!file) return null;

  // Bucket: "mural"
  const ext = (file.name.split(".").pop() || "bin").toLowerCase();
  const path = `${crypto.randomUUID()}.${ext}`;

  const { error: upErr } = await supabaseClient
    .storage
    .from("mural")
    .upload(path, file, { contentType: file.type, upsert: false });

  if (upErr) throw upErr;

  const { data } = supabaseClient.storage.from("mural").getPublicUrl(path);
  return data?.publicUrl || null;
}

async function insertPost(text, mediaUrl, mediaType) {
  // tabela: mural_posts
  // colunas: text, image_url, media_type
  const { error } = await supabaseClient
    .from("mural_posts")
    .insert([{
      text: text || null,
      image_url: mediaUrl || null,
      media_type: mediaType || null
    }]);

  if (error) throw error;
}

// ====== Render “jardim” (ícones flutuantes) ======
function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function seeded01(seed) {
  let x = seed || 123456789;
  x ^= x << 13; x >>>= 0;
  x ^= x >> 17; x >>>= 0;
  x ^= x << 5;  x >>>= 0;
  return (x >>> 0) / 4294967296;
}

function pickEmoji(id) {
  const options = ["✶", "✦", "✺", "✹", "❋", "✷", "☼", "☾", "⟡", "✧", "✩", "✪"];
  return options[hashString(id) % options.length];
}

function clearGarden() {
  if (garden) garden.innerHTML = "";
}

function openViewer(post) {
  const mediaType = post.media_type || "";
  const isImage = mediaType.startsWith("image/");
  const isVideo = mediaType.startsWith("video/");
  const isAudio = mediaType.startsWith("audio/");

  // Reset
  viewerImg.style.display = "none";
  viewerImg.removeAttribute("src");
  viewerImg.alt = "";

  // Se quiser vídeo/áudio embutido, dá pra expandir aqui.
  // Por enquanto:
  // - imagem: mostra no <img>
  // - vídeo/áudio: mostra link dentro do texto
  if (post.image_url && isImage) {
    viewerImg.src = post.image_url;
    viewerImg.style.display = "block";
    viewerImg.alt = "Imagem enviada ao mural";
  }

  let t = post.text || "";
  if (post.image_url && (isVideo || isAudio)) {
    t += (t ? "\n\n" : "") + `Arquivo: ${post.image_url}`;
  } else if (post.image_url && !isImage) {
    // fallback para qualquer outro tipo
    t += (t ? "\n\n" : "") + `Arquivo: ${post.image_url}`;
  }

  viewerText.textContent = t;
  viewerMeta.textContent = post.created_at ? `Enviado em ${formatDate(post.created_at)}` : "";
  viewer.showModal();
}

function createSeedEl(post, idx) {
  const el = document.createElement("button");
  el.className = "seed";
  el.type = "button";
  el.setAttribute("aria-label", "Abrir postagem do mural");

  const base = hashString(post.id);
  const s1 = base ^ (idx * 2654435761);
  const s2 = (base + 1013904223) ^ (idx * 1597334677);

  const x = 6 + seeded01(s1) * 88;
  const y = 12 + seeded01(s2) * 76;
  el.style.left = x.toFixed(2) + "%";
  el.style.top = y.toFixed(2) + "%";

  // variação do movimento
  const phaseSeed = (base ^ 0x9e3779b9) >>> 0;
  const dur = 4.8 + seeded01(phaseSeed) * 4.5;
  el.style.animationDuration = dur.toFixed(2) + "s";
  el.style.animationDelay = (-seeded01(phaseSeed ^ 12345) * dur).toFixed(2) + "s";

  const hasMedia = !!post.image_url;
  const mediaType = post.media_type || "";
  const isImage = mediaType.startsWith("image/");

  if (hasMedia && isImage) {
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

async function fetchPosts() {
  const { data, error } = await supabaseClient
    .from("mural_posts")
    .select("id, created_at, text, image_url, media_type")
    .order("created_at", { ascending: false })
    .limit(220);

  if (error) throw error;
  return data || [];
}

async function renderGarden() {
  if (!garden) return;
  if (!supabaseReady()) return;

  clearGarden();
  const posts = (await fetchPosts()).reverse();
  posts.forEach((p, idx) => garden.appendChild(createSeedEl(p, idx)));
}

// ====== START (após DOM pronto) ======
window.addEventListener("DOMContentLoaded", () => {
  // Refs
  garden = document.getElementById("garden");

  composer = document.getElementById("composer");
  openComposer = document.getElementById("openComposer");
  closeComposer = document.getElementById("closeComposer");

  form = document.getElementById("muralForm");
  textEl = document.getElementById("text");
  mediaEl = document.getElementById("media");
  statusEl = document.getElementById("status");
  sendBtn = document.getElementById("sendBtn");

  viewer = document.getElementById("viewer");
  closeViewer = document.getElementById("closeViewer");
  viewerImg = document.getElementById("viewerImg");
  viewerText = document.getElementById("viewerText");
  viewerMeta = document.getElementById("viewerMeta");

  // ====== Modal abrir/fechar ======
  openComposer?.addEventListener("click", () => {
    // garantido mesmo se supabase ainda não estiver ok
    if (composer?.showModal) composer.showModal();
    else composer?.setAttribute("open", "");
  });

  closeComposer?.addEventListener("click", () => closeDialogSafe(composer));
  closeViewer?.addEventListener("click", () => closeDialogSafe(viewer));

  // Fecha clicando fora do card
  composer?.addEventListener("click", (e) => {
    const formEl = composer.querySelector("form");
    if (!formEl) return;
    const r = formEl.getBoundingClientRect();
    const inside = (
      e.clientX >= r.left && e.clientX <= r.right &&
      e.clientY >= r.top && e.clientY <= r.bottom
    );
    if (!inside) closeDialogSafe(composer);
  });

  // ====== Submit ======
  form?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const text = (textEl?.value || "").trim();
    const file = mediaEl?.files?.[0] || null;

    const fileError = validateFile(file);
    if (fileError) {
      setStatus(fileError);
      return;
    }

    if (!text && !file) {
      setStatus("Escreva um texto e/ou envie uma mídia ✨");
      return;
    }

    if (!supabaseReady()) {
      setStatus("Supabase não carregou (confira os <script> e as chaves).");
      return;
    }

    try {
      sendBtn.disabled = true;
      setStatus("Enviando…");

      const mediaUrl = await uploadMediaIfAny(file);
      const mediaType = file?.type || null;

      await insertPost(text, mediaUrl, mediaType);

      if (textEl) textEl.value = "";
      if (mediaEl) mediaEl.value = "";
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

  // Render inicial
  renderGarden();
});
