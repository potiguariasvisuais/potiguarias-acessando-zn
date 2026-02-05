const SUPABASE_URL = "https://bjxcgnhjfqcpulmzlahp.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_FmaJ0Zp4JIj1teRUPFwBCw_dqt1YpBo";

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const garden = document.getElementById("garden");

const composer = document.getElementById("composer");
const openComposer = document.getElementById("openComposer");
const closeComposer = document.getElementById("closeComposer");

const form = document.getElementById("muralForm");
const textEl = document.getElementById("text");
const imageEl = document.getElementById("image");
const statusEl = document.getElementById("status");
const sendBtn = document.getElementById("sendBtn");

const viewer = document.getElementById("viewer");
const closeViewer = document.getElementById("closeViewer");
const viewerImg = document.getElementById("viewerImg");
const viewerText = document.getElementById("viewerText");
const viewerMeta = document.getElementById("viewerMeta");

function setStatus(msg){ statusEl.textContent = msg || ""; }

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
function pickEmoji(post){
  const options = ["✶","✦","✺","✹","❋","✷","☼","☾","⟡","✧","✩","✪"];
  const seed = hashString(post.id);
  return options[seed % options.length];
}
function formatDate(iso){
  try {
    const d = new Date(iso);
    return d.toLocaleString("pt-BR", { dateStyle:"short", timeStyle:"short" });
  } catch { return ""; }
}

async function uploadImageIfAny(file){
  if (!file) return null;

  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `${crypto.randomUUID()}.${ext}`;

  const { error: upErr } = await supabase
    .storage.from("mural")
    .upload(path, file, { contentType: file.type, upsert:false });

  if (upErr) throw upErr;

  const { data } = supabase.storage.from("mural").getPublicUrl(path);
  return data?.publicUrl || null;
}

async function insertPost(text, imageUrl){
  if (!text && !imageUrl) throw new Error("empty");

  const { error } = await supabase
    .from("mural_posts")
    .insert([{ text: text || null, image_url: imageUrl }]);

  if (error) throw error;
}

function clearGarden(){ garden.innerHTML = ""; }

function createSeedEl(post, idx){
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

  const phaseSeed = (base ^ 0x9e3779b9) >>> 0;
  const dur = 4.8 + seeded01(phaseSeed) * 4.5;
  el.style.animationDuration = dur.toFixed(2) + "s";
  el.style.animationDelay = (-seeded01(phaseSeed ^ 12345) * dur).toFixed(2) + "s";

  if (post.image_url){
    const img = document.createElement("img");
    img.className = "seedThumb";
    img.src = post.image_url;
    img.alt = "";
    el.appendChild(img);
  } else {
    const span = document.createElement("span");
    span.className = "emoji";
    span.textContent = pickEmoji(post);
    el.appendChild(span);
  }

  el.addEventListener("click", () => openViewer(post));
  return el;
}

function openViewer(post){
  if (post.image_url){
    viewerImg.src = post.image_url;
    viewerImg.style.display = "block";
    viewerImg.alt = "Imagem enviada ao mural";
  } else {
    viewerImg.removeAttribute("src");
    viewerImg.style.display = "none";
    viewerImg.alt = "";
  }

  viewerText.textContent = post.text || "";
  viewerMeta.textContent = post.created_at ? `Enviado em ${formatDate(post.created_at)}` : "";
  viewer.showModal();
}

function closeDialogSafe(dlg){
  try { dlg.close(); } catch {}
}

async function fetchPosts(){
  const { data, error } = await supabase
    .from("mural_posts")
    .select("id, created_at, text, image_url")
    .order("created_at", { ascending: false })
    .limit(220);

  if (error) throw error;
  return data || [];
}

async function renderGarden(){
  clearGarden();
  let posts = [];
  try {
    posts = await fetchPosts();
  } catch (e){
    console.error(e);
    return;
  }

  posts.reverse().forEach((p, idx) => {
    garden.appendChild(createSeedEl(p, idx));
  });
}

openComposer?.addEventListener("click", () => composer.showModal());
closeComposer?.addEventListener("click", () => closeDialogSafe(composer));
closeViewer?.addEventListener("click", () => closeDialogSafe(viewer));

// fechar no backdrop
composer?.addEventListener("click", (e) => {
  const rect = composer.getBoundingClientRect();
  const inside = (e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom);
  if (!inside) closeDialogSafe(composer);
});
viewer?.addEventListener("click", (e) => {
  const rect = viewer.getBoundingClientRect();
  const inside = (e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom);
  if (!inside) closeDialogSafe(viewer);
});

form?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const text = (textEl.value || "").trim();
  const file = imageEl.files?.[0] || null;

  if (!text && !file){
    setStatus("Envie um texto e/ou uma imagem ✨");
    return;
  }

  try {
    sendBtn.disabled = true;
    setStatus("Enviando…");

    const imageUrl = await uploadImageIfAny(file);
    await insertPost(text, imageUrl);

    textEl.value = "";
    imageEl.value = "";
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

renderGarden();

// Se quiser “ao vivo” (sem refresh), descomenta:
 supabase.channel("mural")
   .on("postgres_changes", { event: "INSERT", schema: "public", table: "mural_posts" }, () => renderGarden())
   .subscribe();
