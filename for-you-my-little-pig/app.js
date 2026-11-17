"use strict";

Object.assign(GIFT, globalThis.GIFT_CUSTOM || {});
applyGiftFonts(GIFT.typography, document.documentElement);

const get = (id) => document.getElementById(id);
const app = get("app");
const dialog = get("dialog");
const voice = get("voice-audio");
const background = get("background-audio");
const STORAGE = "little-pig-universe-2026-v1";
const initial = { intro: false, stamps: [], flowers: [], stars: [], pendingStar: null, golden: false, letters: [], vouchers: [], game: [], foundPig: false, hillPass: false, ending: false, eggs: [], watered: 0, night: false, lamp: true, volume: GIFT.music.volume, music: true };
let saved = {};
try { saved = JSON.parse(localStorage.getItem(STORAGE)) || {}; } catch {}
const state = { ...initial, ...saved };
const places = [
  { id: "house", name: "Căn nhà của tụi mình", mark: "⌂", x: 52, y: 44, color: "peach" },
  { id: "museum", name: "Bảo tàng ký ức", mark: "▧", x: 25, y: 23, color: "cream" },
  { id: "radio", name: "Đài phát thanh của tui", mark: "♫", x: 85, y: 36, color: "rose" },
  { id: "garden", name: "Khu vườn yêu thương", mark: "✿", x: 18, y: 59, color: "sage" },
  { id: "stars", name: "Chiếc lọ ngàn sao", mark: "✦", x: 43, y: 79, color: "cream" },
  { id: "post", name: "Bưu điện gửi đến tương lai", mark: "✉", x: 84, y: 71, color: "peach" },
  { id: "hill", name: "Ngọn đồi bí mật", mark: "☾", x: 66, y: 13, color: "rose" },
];
const regular = places.slice(0, -1);
let scene = "intro";
let envelope = 0;
let mainLetterOpen = false;
let albumPage = 0;
let selectVoice = 0;
let hillLine = 0;
let hillTimer;
let pigTaps = 0;
let gameNote = "";
let finalVoicePlaying = false;
let dialogReturn = null;
let pickedAudio = null;
let soundEnabled = false;
let context;
let musicGain;
let musicLoop;
let nextMusicTime = 0;
let musicIndex = 0;
let musicGeneration = 0;
let renderedCount = 0;
const hasMusic = Boolean(GIFT.music.src || GIFT.music.generated);
const isReduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

const save = () => {
  try { localStorage.setItem(STORAGE, JSON.stringify(state)); } catch {}
};
const add = (key, value) => {
  if (state[key].includes(value)) return false;
  state[key].push(value);
  save();
  return true;
};
const escape = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
function source(value) {
  if (!value) return "";
  try {
    const url = new URL(value, location.href);
    if (["http:", "https:", "file:"].includes(url.protocol)) return url.href;
  } catch {}
  return "";
}
const dateText = (date) => date ? date.split("-").reverse().join(".") : "";
const action = (label, id, options = "") => `<button class="button" data-action="${id}" ${options}>${label}</button>`;
const linkButton = (label, destination, secondary = false) => `<button class="button ${secondary ? "secondary" : ""}" data-go="${destination}">${label}</button>`;
const pid = (key) => places.find((item) => item.id === key);
const unlocked = () => state.hillPass || regular.every((item) => state.stamps.includes(item.id));
const allStamps = () => places.every((item) => state.stamps.includes(item.id));
const two = (number) => String(number).padStart(2, "0");
const announce = (message) => { get("announcer").textContent = message; };
function stamp(id) {
  if (add("stamps", id)) announce("Đã nhận dấu " + pid(id).name);
}

function pig(style = "", attributes = "") {
  const body = '<span class="pig-head"><i class="ear left"></i><i class="ear right"></i><i class="eye left"></i><i class="eye right"></i><i class="cheek left"></i><i class="cheek right"></i><i class="pig-nose"></i></span><span class="pig-body"><i></i></span>';
  return attributes
    ? `<button class="pig ${style}" ${attributes}>${body}</button>`
    : `<span class="pig ${style}" aria-hidden="true">${body}</span>`;
}
function photoFrame(photo, index, clickable = true) {
  const path = source(photo.src);
  const name = photo.caption || photo.id;
  const frame = `<span class="photo-paper">${path ? `<img src="${escape(path)}" alt="${escape(name)}" loading="lazy">` : `<span class="photo-empty" aria-hidden="true">▧</span>`}</span><span class="photo-caption">${escape(name)}</span>`;
  return clickable ? `<button class="polaroid" data-action="photo" data-index="${index}">${frame}</button>` : `<div class="polaroid">${frame}</div>`;
}

function openDialog(title, content) {
  if (!dialog.open) dialogReturn = document.activeElement;
  get("dialog-content").innerHTML = `<h2 id="dialog-title">${escape(title)}</h2>${content}`;
  if (!dialog.open) dialog.showModal();
  wireAudio();
}
function note(title, content) {
  openDialog(title, `<p class="handwritten note-text">${escape(content)}</p>`);
}
dialog.addEventListener("click", (event) => { if (event.target === dialog) dialog.close(); });
dialog.addEventListener("close", () => {
  if (dialogReturn instanceof HTMLElement && dialogReturn.isConnected) dialogReturn.focus();
});
function refresh(focusId) {
  render();
  if (focusId) app.querySelector(focusId)?.focus({ preventScroll: true });
}
function go(next, direct = false) {
  if (!views[next]) return;
  if (!state.intro && next !== "intro") { if (direct) history.replaceState(null, "", "#intro"); return; }
  if (next === "hill" && !unlocked()) { showHillLock(); return; }
  clearInterval(hillTimer);
  if (dialog.open) dialog.close();
  if (scene === "hill" && next !== "hill" && finalVoicePlaying) {
    finalVoicePlaying = false;
    voice.pause();
  }
  scene = next;
  if (next === "hill") {
    hillLine = state.ending || isReduced ? GIFT.finale.length : 1;
  }
  if (!direct && location.hash !== "#" + next) history.pushState(null, "", "#" + next);
  window.scrollTo(0, 0);
  render();
  app.focus({ preventScroll: true });
  if (next === "hill" && hillLine < GIFT.finale.length) {
    hillTimer = setInterval(() => {
      hillLine++;
      get("hill-line")?.replaceChildren(GIFT.finale[hillLine - 1]);
      if (hillLine >= GIFT.finale.length) {
        clearInterval(hillTimer);
        if (get("hill-reveal")) get("hill-reveal").hidden = false;
      }
    }, 3000);
  }
}
function chapter(title, copy, body, className = "") {
  const found = pid(scene);
  const stamped = found && state.stamps.includes(scene);
  return `<section class="chapter ${className}"><div class="chapter-head"><button class="text-link" data-go="map">← Bản đồ</button><h1>${title}</h1>${copy ? `<p>${copy}</p>` : ""}</div>${body}${stamped ? `<p class="collected"><span aria-hidden="true">${found.mark}</span> Dấu đã có trong hộ chiếu</p>` : ""}</section>`;
}

function intro() {
  const recipient = escape(GIFT.recipient);
  const notePart = envelope === 1
    ? `<section class="envelope-card"><button class="envelope-button" data-action="seal" aria-label="Chạm vào dấu heo để mở thư"><span class="envelope-art"><span class="wax" aria-hidden="true">🐽</span></span><span>Chạm vào dấu heo để mở thư</span></button></section>`
    : `<section class="opening-letter"><span class="script">Gửi ${recipient},</span><p>${escape(GIFT.opening)}</p>${action("Bắt đầu hành trình <span aria-hidden=\"true\">→</span>", "begin")}</section>`;
  return `<div class="intro-view"><section class="hero"><div class="hero-copy">
    <p class="date-label"><i></i> ${dateText(GIFT.giftDate)}</p>
    <h1>For You,<br><em>My Little Pig</em></h1>
    <p class="hero-subtitle">Một thế giới nhỏ dành riêng cho <strong>${recipient}</strong>.</p>
    ${envelope === 0 ? `<div class="parcel"><div class="parcel-address"><p class="parcel-lead">Có một bưu kiện đặc biệt vừa được gửi đến…</p><p><b>GỬI ĐẾN</b> ${recipient}<br><b>GỬI TỪ</b> ${escape(GIFT.fromLabel)}</p></div><span class="mail-stamp" aria-hidden="true">✿</span></div><div class="intro-actions">${action("Nhận bưu kiện <span aria-hidden=\"true\">→</span>", "parcel")}${state.intro ? linkButton("Về bản đồ", "map", true) : ""}</div>` : notePart}
    </div><figure class="hero-figure"><div class="postal-tape" aria-hidden="true"></div><div class="hero-scenery"><img src="assets/meadow.jpg" alt="Chú heo đưa thư ôm bưu kiện chạy qua đồng hoa, phía sau là căn nhà nhỏ"><button class="hidden-object butterfly" data-action="egg" data-id="butterfly" aria-label="Chú bướm" title="Chú bướm"></button><div class="postal-pig" aria-hidden="true">${pig("sage walking")}<span>✉</span></div></div><figcaption><span class="script">chú heo tới giao thư nè!</span><span class="little-flower" aria-hidden="true">❀</span></figcaption></figure></section>
    <div class="intro-bottom"><span aria-hidden="true">✿ &nbsp; ❋ &nbsp; ✿</span><div></div><span class="script">một món quà nhỏ của Quỳnh</span></div></div>`;
}
function map() {
  const mapPins = places.map((place) => `<button class="map-pin tone-${place.color}" style="--x:${place.x}%;--y:${place.y}%" data-go="${place.id}" aria-label="${place.name}${place.id === "hill" && !unlocked() ? ", đang khóa" : ""}"><span class="pin-mark" aria-hidden="true">${place.mark}</span><span class="pin-label">${place.name}</span>${state.stamps.includes(place.id) ? '<span class="pin-done" aria-hidden="true">✓</span>' : ""}</button>`).join("");
  return `<section class="chapter map-chapter"><div class="chapter-head"><div class="map-heading"><div><h1>The Little Pig Universe</h1><p>HC muốn ghé đâu trước?</p></div><button class="passport-button" data-action="passport"><span aria-hidden="true">▤</span> Hộ chiếu <strong>${state.stamps.length}/${places.length}</strong></button></div></div>
    <div class="map-canvas"><img src="assets/map.jpg" alt="Bản đồ minh họa với những lối mòn nối bảy địa điểm">${mapPins}<div class="map-pigs" aria-hidden="true">${pig("sage walking")}${pig("rose walking")}</div></div>
    <div class="directory" aria-label="Các địa điểm">${places.map((place)=>`<button class="text-link" data-go="${place.id}"><span aria-hidden="true">${place.mark}</span> ${place.name}</button>`).join("")}</div>
    <div class="trail-links">${GIFT.mainLetter.text.trim() ? linkButton(escape(GIFT.mainLetter.title), "main-letter") : ""}${linkButton("Đi tìm chú heo thất lạc", "game", true)}${linkButton("Voucher của HC", "vouchers", true)}${allStamps() ? action("Mở thư thưởng ✉", "bonus") : ""}</div>
    </section>`;
}
function showPassport() {
  openDialog("Hộ chiếu kỷ niệm", `<p>${state.stamps.length}/${places.length} con dấu</p><ul class="stamp-list">${places.map((item) => `<li class="${state.stamps.includes(item.id) ? "stamped" : ""}"><span aria-hidden="true">${item.mark}</span><div>${item.name}<small>${state.stamps.includes(item.id) ? "Đã nhận" : "Chưa có dấu"}</small></div></li>`).join("")}</ul>${allStamps() ? action("Mở thư thưởng ✉", "bonus") : ""}`);
}
function showHillLock() {
  const remaining = regular.filter((item) => !state.stamps.includes(item.id)).map((item) => item.name);
  openDialog("Ngọn đồi bí mật", `<p>Ghé thêm ${remaining.length} nơi để lấy đủ dấu lên đồi nha.</p><ul class="remaining">${remaining.map((item) => `<li>${item}</li>`).join("")}</ul><div class="dialog-actions">${action("Quay lại khám phá", "close")}<button class="button secondary" data-action="skip-hill">Lên đồi luôn</button></div>`);
}

const roomObjects = [
  ["frame", "Khung ảnh", 14, 30], ["cassette", "Máy cassette", 11, 51], ["gift", "Hộp quà", 44, 64],
  ["diary", "Quyển nhật ký", 60, 71], ["clock", "Đồng hồ", 46, 20], ["pillow", "Chiếc gối", 12, 88],
  ["window", "Cửa sổ", 73, 22], ["plant", "Chậu cây", 79, 52], ["lamp", "Đèn bàn", 95, 70],
  ["calendar", "Tấm lịch", 94, 31],
];
function house() {
  const objects = roomObjects.map(([id, label, x, y]) => `<button class="room-pin" style="--x:${x}%;--y:${y}%" data-action="room" data-id="${id}" aria-label="${label}" title="${label}"><span aria-hidden="true">+</span><span class="room-label">${label}</span></button>`).join("");
  return chapter("Căn nhà của tụi mình", "Mấy món đồ trong nhà có chuyện riêng á. HC chạm thử xem.", `<figure class="room ${state.night ? "night" : ""} ${state.lamp ? "" : "lamp-off"}"><img src="assets/cottage.jpg" alt="Căn nhà nhỏ với cửa sổ, hộp quà, đèn bàn và máy cassette"><div class="room-light" aria-hidden="true"></div>${state.night ? '<button class="moon window-moon" data-action="egg" data-id="moon" aria-label="Mặt trăng">☾</button>' : ""}<span class="plant-growth stage-${state.watered}" aria-hidden="true">✿</span><span class="calendar-mark" aria-hidden="true">♡</span>${objects}<div class="room-pig">${pig("asleep", 'data-action="egg" data-id="sleep" aria-label="Chú heo đang ngủ"')}</div></figure><div class="directory room-directory" aria-label="Đồ vật trong nhà">${roomObjects.map(([id, label]) => `<button class="text-link" data-action="room" data-id="${id}">${label}</button>`).join("")}</div>`);
}
function clockText() {
  const start = new Date(GIFT.startDate + "T00:00:00+07:00").getTime();
  const seconds = Math.max(0, Math.floor((Date.now() - start) / 1000));
  return `${Math.floor(seconds / 86400)} ngày · ${two(Math.floor(seconds / 3600) % 24)}:${two(Math.floor(seconds / 60) % 60)}:${two(seconds % 60)}`;
}
setInterval(() => { if (get("clock-live")) get("clock-live").textContent = clockText(); }, 1000);
function useRoom(id) {
  stamp("house");
  if (id === "frame") return go("museum");
  if (id === "cassette") {
    selectVoice = 0;
    go("radio");
    if (GIFT.voices[0]?.src) chooseTrack(GIFT.voices[0]);
    return;
  }
  if (id === "window" || id === "lamp" || id === "plant") {
    if (id === "window") state.night = !state.night;
    if (id === "lamp") state.lamp = !state.lamp;
    if (id === "plant") {
      state.watered = Math.min(3, state.watered + 1);
      announce(["", "Đã tưới một chút nước.", "Cây ra lá rồi.", "Cây nở hoa rồi!"][state.watered]);
    }
    save();
    refresh('.room-pin[data-id="' + id + '"]');
    return;
  }
  if (id === "clock") {
    openDialog("Tụi mình đã bên nhau", `<p class="elapsed" id="clock-live">${clockText()}</p><p>Từ ${dateText(GIFT.startDate)}</p>`);
    return;
  }
  if (id === "calendar") {
    openDialog("Tấm lịch", `<div class="calendar-card"><span>${dateText(GIFT.giftDate).slice(3)}</span><b>${dateText(GIFT.giftDate).slice(0, 2)}</b><span aria-hidden="true">♡</span></div><p>Ngày bưu kiện đến tay ${escape(GIFT.recipient)}.</p>`);
    return;
  }
  if (id === "pillow") {
    document.querySelector(".room-pig .pig")?.classList.remove("asleep");
    add("eggs", "sleep");
  }
  note(roomObjects.find((item) => item[0] === id)?.[1] || "Trong căn nhà", GIFT.house[id]);
}

function museum() {
  const total = Math.ceil(GIFT.photos.length / 4);
  return chapter("Bảo tàng ký ức", "Our Little Memories", `<div class="scrapbook"><span class="script photo-quote">${escape(GIFT.photoQuote)}</span><div class="album-grid" data-page="${albumPage}">${GIFT.photos.slice(albumPage * 4, albumPage * 4 + 4).map((photo, i) => photoFrame(photo, i + albumPage * 4)).join("")}</div><div class="album-controls"><button class="button secondary" data-action="album" data-shift="-1" ${albumPage === 0 ? "disabled" : ""}>← Trang trước</button><span>${albumPage + 1} / ${total}</span><button class="button secondary" data-action="album" data-shift="1" ${albumPage + 1 === total ? "disabled" : ""}>Lật trang →</button></div></div>
  <section class="memory-history"><h2>Những ngày tụi mình đánh dấu</h2><ol class="timeline">${GIFT.timeline.map((item) => `<li><time datetime="${escape(item.date)}">${dateText(item.date)}</time><div><b>${escape(item.title)}</b>${item.text ? `<p>${escape(item.text)}</p>` : ""}</div></li>`).join("")}</ol></section>
  <section class="memory-history"><h2>Để cạnh nhau</h2><div class="paired-list">${GIFT.photoPairs.map((pair) => `<div class="photo-pair">${pair.filter((i) => GIFT.photos[i]).map((i) => photoFrame(GIFT.photos[i], i)).join("")}</div>`).join("")}</div></section>`);
}
function showPhoto(index) {
  const photo = GIFT.photos[index];
  if (!photo) return;
  stamp("museum");
  const path = source(photo.src);
  openDialog(photo.caption || photo.id, `${path ? `<img class="detail-photo" src="${escape(path)}" alt="${escape(photo.caption || photo.id)}">` : '<p class="empty-note">Ảnh thật sẽ nằm ở đây.</p>'}${photo.date ? `<p>${dateText(photo.date)}</p>` : ""}${photo.voice ? audioControls(photo.voice, "Nghe bên tấm ảnh") : ""}`);
}

function audioControls(track, title = track.title || "Bản ghi âm") {
  const src = source(track.src);
  const link = source(track.link);
  const id = escape(track.id || src);
  if (!src) return link ? `<a class="button secondary" href="${escape(link)}" target="_blank" rel="noopener noreferrer">Mở bản ghi âm ↗</a>` : `<p class="empty-note">Đang chờ bản thu của Quỳnh <small>${escape(track.id || "")}</small></p>`;
  return `<div class="audio-control" data-track="${id}" data-src="${escape(src)}" data-final="${track === GIFT.finaleVoice ? "true" : "false"}"><button class="button play" data-action="play-track" aria-label="Phát ${escape(title)}">▶</button><input class="seek" type="range" min="0" max="100" value="0" step="0.1" aria-label="Vị trí phát"><output class="time-audio">0:00 / –:––</output>${link ? `<a class="text-link" href="${escape(link)}" target="_blank" rel="noopener noreferrer">Bản thu ↗</a>` : ""}<p class="media-error" aria-live="polite" hidden></p></div>`;
}
function radio() {
  const track = GIFT.voices[selectVoice];
  return chapter("Đài phát thanh của tui", "Có những điều chữ viết không thể nói hết, nên tui để giọng nói của tui ở đây.", `<div class="radio-layout"><div class="radio-art"><div class="radio-case"><div class="speaker"></div><div class="receiver"><span class="dial"></span><div class="cassette"><i></i><i></i></div><div class="knobs"><b></b><b></b><b></b></div></div></div><div class="radio-pigs">${pig("sage", 'data-action="nose" aria-label="Chạm mũi chú heo"')}${pig("rose", 'data-action="hug" aria-label="Hai chú heo ôm nhau"')}</div></div>
  <div class="track-panel"><h2>Love Radio</h2><ol class="tracks">${GIFT.voices.map((item, i) => `<li><button data-action="select-track" data-index="${i}" aria-pressed="${i === selectVoice}"><span>${two(i + 1)}</span><b>${escape(item.title)}</b><span aria-hidden="true">${i === selectVoice ? "♫" : "›"}</span></button></li>`).join("")}</ol><div class="player-slot">${track ? audioControls(track) : ""}</div></div></div>`);
}
function audioTime(seconds) {
  return Number.isFinite(seconds) ? Math.floor(seconds / 60) + ":" + two(Math.floor(seconds % 60)) : "–:––";
}
function syncAudio() {
  const playing = !voice.paused && !voice.ended && voice.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && Boolean(pickedAudio);
  app.classList.toggle("voice-playing", playing);
  document.querySelectorAll(".audio-control").forEach((node) => {
    const active = pickedAudio && node.dataset.track === pickedAudio.id && node.dataset.src === pickedAudio.src;
    const button = node.querySelector(".play");
    button.textContent = active && playing ? "❚❚" : "▶";
    button.setAttribute("aria-label", active && playing ? "Tạm dừng" : "Phát bản ghi âm");
    const seek = node.querySelector(".seek");
    seek.disabled = !(active && Number.isFinite(voice.duration));
    seek.value = active && voice.duration ? voice.currentTime / voice.duration * 100 : 0;
    node.querySelector(".time-audio").textContent = active ? audioTime(voice.currentTime) + " / " + audioTime(voice.duration) : "0:00 / –:––";
    const error = node.querySelector(".media-error");
    if (active && pickedAudio.error) {
      error.hidden = false;
      error.textContent = pickedAudio.error;
    } else error.hidden = true;
  });
  get("music-label").textContent = !hasMusic ? "Âm thanh" : soundEnabled && state.music ? "Nhạc đang bật" : "Âm thanh";
}
function wireAudio() {
  syncAudio();
}
function chooseTrack(track) {
  const src = source(track.src);
  if (!src) return;
  playTrack({ track: track.id || src, src, final: String(track === GIFT.finaleVoice) });
}
async function playTrack(data) {
  if (!data.src) return;
  if (pickedAudio?.id === data.track && pickedAudio?.src === data.src && !voice.paused) { voice.pause(); return; }
  if (pickedAudio?.id !== data.track || pickedAudio.src !== data.src || pickedAudio.error) {
    voice.pause();
    pickedAudio = { id: data.track, src: data.src, error: "" };
    voice.src = data.src;
  }
  const activeAudio = pickedAudio;
  finalVoicePlaying = data.final === "true";
  try { await voice.play(); }
  catch (error) {
    if (pickedAudio !== activeAudio || error.name === "AbortError") return;
    pickedAudio.error = "Chưa phát được tệp này. HC có thể thử lại hoặc mở đường dẫn bản thu nếu có.";
    finalVoicePlaying = false;
    syncAudio();
  }
}
for (const event of ["loadedmetadata", "timeupdate", "play", "playing", "waiting", "pause", "ended", "error"]) {
  voice.addEventListener(event, () => {
    if (event === "error" && pickedAudio) pickedAudio.error = "Không mở được tệp ghi âm này.";
    if (event === "play" || event === "playing") levelMusic(true);
    if (event === "pause" || event === "ended" || event === "error") levelMusic(false);
    if (event === "ended" && finalVoicePlaying && scene === "hill") finishEnding();
    if (event === "ended" || event === "error") finalVoicePlaying = false;
    syncAudio();
  });
}
const melody = [
  [60, 0], [64, .5], [67, 1], [72, 2], [67, 3.2], [64, 3.7], [57, 4.5], [60, 5],
  [64, 5.5], [69, 6.5], [64, 7.5], [65, 8.5], [69, 9], [72, 9.5], [76, 10.4], [72, 11.7],
  [55, 12.5], [62, 13], [65, 13.5], [71, 14.5], [67, 15.7], [64, 16.2],
];
function musicTick() {
  while (nextMusicTime + melody[musicIndex][1] < context.currentTime + 0.35) {
    const [note, offset] = melody[musicIndex];
    const time = Math.max(context.currentTime, nextMusicTime + offset);
    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = 440 * 2 ** ((note - 69) / 12);
    envelope.gain.setValueAtTime(0.001, time);
    envelope.gain.exponentialRampToValueAtTime(0.22, time + 0.045);
    envelope.gain.exponentialRampToValueAtTime(0.001, time + 1.65);
    oscillator.connect(envelope).connect(musicGain);
    oscillator.start(time);
    oscillator.stop(time + 1.7);
    musicIndex++;
    if (musicIndex === melody.length) { musicIndex = 0; nextMusicTime += 17.5; }
  }
}
function stopMusic() {
  musicGeneration++;
  clearInterval(musicLoop);
  musicLoop = null;
  background.pause();
  levelMusic(!voice.paused);
  syncAudio();
}
function levelMusic(duck) {
  const volume = soundEnabled && state.music ? state.volume / 100 : 0;
  if (musicGain && context) musicGain.gain.setTargetAtTime(duck ? volume * 0.27 : volume, context.currentTime, 0.16);
  if (GIFT.music.src && soundEnabled && state.music) {
    if (duck) background.pause();
    else if (volume > 0) background.play().catch(() => {});
  }
  background.volume = volume;
}
async function startMusic() {
  if (!hasMusic || !state.music) return;
  soundEnabled = true;
  const run = ++musicGeneration;
  const src = source(GIFT.music.src);
  if (src) {
    if (background.src !== src) background.src = src;
    levelMusic(!voice.paused);
    if (voice.paused && state.volume > 0) {
      try { await background.play(); } catch { announce("Chưa bật được nhạc nền."); }
    }
  } else if (GIFT.music.generated) {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!context) {
        context = new AudioContext();
        musicGain = context.createGain();
        musicGain.gain.value = 0;
        musicGain.connect(context.destination);
      }
      await context.resume();
      if (run !== musicGeneration || !state.music) return;
      levelMusic(!voice.paused);
      if (!musicLoop) {
        nextMusicTime = context.currentTime + 0.06;
        musicIndex = 0;
        musicTick();
        musicLoop = setInterval(musicTick, 200);
      }
    } catch { announce("Trình duyệt chưa phát được nhạc nền."); }
  }
  syncAudio();
}
let youtubeTrack = 0;

function showYouTubeMusic() {
  const tracks = GIFT.youtubeMusic;
  const track = tracks[youtubeTrack];
  const choices = tracks.map((song, index) => `
    <button class="button ${index === youtubeTrack ? "" : "secondary"}" data-action="youtube-track"
      data-index="${index}" aria-pressed="${index === youtubeTrack}">${escape(song.title)}</button>
  `).join("");
  openDialog("Âm thanh", `
    <div class="dialog-actions" role="group" aria-label="Chọn bài hát">${choices}</div>
    <p style="margin:1rem 0 .5rem"><strong>${escape(track.title)}</strong> · ${escape(track.artist)}</p>
    <iframe id="youtube-music-player" title="YouTube · ${escape(track.title)}"
      src="https://www.youtube.com/embed/${encodeURIComponent(track.id)}?playsinline=1"
      style="display:block;width:100%;min-height:200px;aspect-ratio:16/9;border:0;border-radius:10px"
      referrerpolicy="strict-origin-when-cross-origin"
      allow="encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>
    <a class="text-link" href="https://www.youtube.com/watch?v=${encodeURIComponent(track.id)}"
      target="_blank" rel="noopener noreferrer">Mở trên YouTube ↗</a>
  `);
}

dialog.addEventListener("close", () => {
  if (!dialog.open) get("youtube-music-player")?.remove();
});

function showSound() {
  if (!GIFT.music.src && GIFT.youtubeMusic?.length) {
    showYouTubeMusic();
    return;
  }
  openDialog("Âm thanh", `<p>${GIFT.music.src ? "Nhạc nền của Quỳnh" : GIFT.music.generated ? "Nhạc hộp nhạc" : "Chưa có nguồn nhạc nền"}</p><label class="range-label" for="music-volume">Âm lượng nhạc nền <output id="volume-text">${state.volume}%</output></label><input id="music-volume" type="range" min="0" max="100" value="${state.volume}" ${hasMusic ? "" : "disabled"}><div class="dialog-actions">${action(soundEnabled && state.music ? "Tắt nhạc" : "Bật nhạc", "toggle-music", hasMusic ? "" : "disabled")}${!voice.paused ? action("Tạm dừng bản thu", "pause-voice") : ""}</div>`);
}

const flowerColors = ["#d88a90", "#efb980", "#d7a6b4", "#e3c271", "#b299b1"];
function garden() {
  return chapter("Khu vườn yêu thương", "HC chạm vào từng hạt giống để coi tui đã trồng gì nha.", `<div class="garden-bed"><div class="garden-count">${state.flowers.length}/${GIFT.flowers.length} bông đã nở</div><div class="flowers">${GIFT.flowers.map((_, i) => `<button class="flower-slot ${state.flowers.includes(i) ? "bloomed" : ""}" style="--petal:${flowerColors[i % flowerColors.length]}" data-action="flower" data-index="${i}" aria-label="${state.flowers.includes(i) ? "Đọc lại bông hoa" : "Gieo hạt"} ${i + 1}"><span class="bloom" aria-hidden="true">✿</span><span class="stem" aria-hidden="true"></span><span class="seed" aria-hidden="true">●</span></button>`).join("")}</div>${state.flowers.length >= GIFT.flowers.length ? '<button class="clover" data-action="egg" data-id="clover" aria-label="Cỏ bốn lá">🍀</button>' : ""}</div><div class="compact-pigs">${pig("sage", 'data-action="nose" aria-label="Chạm mũi chú heo"')}${pig("rose", 'data-action="hug" aria-label="Hai chú heo ôm nhau"')}</div>`);
}
const jarPattern = Array.from({ length: 30 }, (_, i) => ({
  x: (i * 37) % 83 + 9, y: (i * 17) % 47 + 45, rotate: (i * 43) % 86 - 45,
  color: ["#cc6269", "#edb060", "#ef9bad", "#90ab70"][i % 4],
}));
function stars() {
  const hasPending = state.pendingStar !== null;
  return chapter("Chiếc lọ ngàn sao", "Tui gấp mấy lời nhỏ xíu bỏ vô đây. HC rút một ngôi sao nha.", `<div class="stars-layout"><div class="jar-scene"><span class="jar-spark spark-a" aria-hidden="true">✧</span><span class="jar-spark spark-b" aria-hidden="true">✦</span>
    <button class="jar ${hasPending ? "has-star" : ""}" data-action="${hasPending ? "open-star" : "draw-star"}" ${state.stars.length >= GIFT.stars.length ? "disabled" : ""} aria-label="${hasPending ? "Mở ngôi sao vừa rút" : "Rút một ngôi sao"}"><span class="jar-lid"></span><span class="jar-glass"><span class="jar-shine"></span>${jarPattern.map((star) => `<i style="--sx:${star.x}%;--sy:${star.y}%;--turn:${star.rotate}deg;--star:${star.color}">✦</i>`).join("")}<span class="jar-label script">gửi HC</span></span>${hasPending ? '<span class="drawn-star" aria-hidden="true">✦</span>' : ""}</button></div>
    <div class="star-counter"><h2>${state.stars.length} / ${GIFT.stars.length}</h2><p>ngôi sao đã mở</p>${state.stars.length < GIFT.stars.length ? action(hasPending ? "Mở ngôi sao vừa rút" : "Rút một ngôi sao", hasPending ? "open-star" : "draw-star") : '<p>HC đã mở hết sao trong lọ rồi ✦</p>'}${state.stars.length >= 19 ? action(state.golden ? "Đọc lại sao vàng ✦" : "Mở sao vàng 19.11 ✦", "golden") : ""}${state.stars.length ? '<button class="text-link" data-action="star-history">Xem lại sao đã mở →</button>' : ""}</div></div>`);
}
function showStar(index) {
  note("Ngôi sao giấy", GIFT.stars[index]);
}

function mainLetter() {
  const letter = GIFT.mainLetter;
  const title = escape(letter.title);
  const image = source(letter.src);
  const track = letter.voice?.src || letter.voice?.link ? audioControls(letter.voice, "Nghe giọng Quỳnh") : "";
  const content = mainLetterOpen
    ? `<article class="keepsake-paper" aria-labelledby="keepsake-title">
        <div class="keepsake-ornament" aria-hidden="true">✿</div>
        <time datetime="${escape(GIFT.giftDate)}">${dateText(GIFT.giftDate)}</time>
        <h1 id="keepsake-title" tabindex="-1">${title}</h1>
        <div class="long-letter-text">${escape(letter.text || "Quỳnh đang viết lá thư này.")}</div>
        ${image ? `<img class="keepsake-photo" src="${escape(image)}" alt="Ảnh gửi cùng lá thư" loading="lazy">` : ""}
        ${track}
        <p class="script keepsake-signature">${escape(GIFT.sender)}</p>
      </article>`
    : `<div class="keepsake-envelope">
        <h1>${title}</h1>
        <button class="envelope-button" data-action="open-main-letter">
          <span class="envelope-art" aria-hidden="true"><span class="wax">✿</span></span>
          <span>Mở phong thư</span>
        </button>
      </div>`;
  return `<section class="chapter keepsake-chapter"><div class="keepsake-navigation"><button class="text-link" data-go="post">← Bưu điện</button></div>${content}</section>`;
}

function post() {
  const featured = GIFT.mainLetter.text.trim() ? `<div class="featured-letter">${linkButton(escape(GIFT.mainLetter.title) + " ✉", "main-letter")}</div>` : "";
  return chapter("Bưu điện gửi đến tương lai", "Lúc nào cần thì HC ghé mở một lá thư nha.", `${featured}<div class="letter-box">${GIFT.letters.map((letter, i) => `<button class="mail-letter tone-${["rose", "cream", "sage", "peach"][i % 4]} ${state.letters.includes(i) ? "mail-opened" : ""}" data-action="letter" data-index="${i}"><span class="fold" aria-hidden="true"></span><span class="post-seal" aria-hidden="true">${state.letters.includes(i) ? "✓" : "✿"}</span><span>${escape(letter.title)}</span></button>`).join("")}</div><div class="trail-links">${linkButton("Mở cuốn voucher của HC", "vouchers", true)}</div>`);
}
function showLetter(index) {
  const letter = GIFT.letters[index];
  if (!letter) return;
  add("letters", index);
  stamp("post");
  refresh('.mail-letter[data-index="' + index + '"]');
  const image = source(letter.src);
  openDialog(letter.title, `<div class="letter-contents"><p class="handwritten note-text">${escape(letter.text)}</p>${image ? `<img class="detail-photo" src="${escape(image)}" alt="Ảnh gửi cùng thư">` : ""}${letter.voice ? audioControls(letter.voice) : ""}<p class="script">${escape(GIFT.sender)}</p></div>`);
}

const gameCoordinates = [[19, 72], [34, 52], [53, 67], [66, 41], [82, 31], [90, 53]];
function game() {
  const position = gameCoordinates[Math.min(5, state.game.length)];
  return chapter("Đi tìm chú heo thất lạc", "Một chú heo đã đi lạc trong thế giới ký ức. HC nhặt mấy món dọc đường để tìm chú heo đó nha.", `<div class="game-board ${state.foundPig ? "game-won" : ""}"><div class="game-path" aria-hidden="true"></div><div class="game-mover" style="--x:${state.game.length ? position[0] - 8 : 7}%;--y:${state.game.length ? position[1] + 9 : 85}%">${pig("sage walking")}</div>
  ${GIFT.game.map((item, i) => `<button class="game-item ${state.game.includes(i) ? "found" : ""}" style="--x:${gameCoordinates[i][0]}%;--y:${gameCoordinates[i][1]}%" data-action="game-item" data-index="${i}" aria-label="${escape(item.name)}"><span aria-hidden="true">${state.game.includes(i) ? "✓" : item.icon}</span></button>`).join("")}<div class="lost-pig">${pig("rose", 'data-action="find-pig" aria-label="Tìm thấy chú heo"')}</div></div>
  <div class="game-status"><strong>${state.game.length}/${GIFT.game.length} món đã nhặt</strong><p id="game-note" aria-live="polite">${escape(gameNote || (state.foundPig ? "tìm thấy nhau r nè!" : ""))}</p></div><div class="trail-links">${state.foundPig ? action("Ôm lại một cái", "game-hug") : '<button class="text-link" data-action="skip-game">Bỏ qua trò chơi →</button>'}</div>`);
}
function gameHug() {
  app.querySelector(".game-board")?.classList.add("game-won");
  sprinkle(app.querySelector(".game-board"));
  get("game-note").textContent = GIFT.hug;
}

function vouchers() {
  return chapter("Voucher chỉ dành cho HC", "", `<div class="voucher-book">${GIFT.vouchers.map((title, i) => {
    const used = state.vouchers.includes(i);
    return `<button class="voucher tone-${["cream", "rose", "sage", "peach"][i % 4]} ${used ? "used" : ""}" data-action="voucher" data-index="${i}"><span class="ticket-icon" aria-hidden="true">✿</span><span><small>CHO ${escape(GIFT.recipient.toUpperCase())}</small><b>${escape(title)}</b></span>${used ? '<span class="used-stamp">ĐÃ SỬ DỤNG</span>' : ""}</button>`;
  }).join("")}</div>`);
}
function showVoucher(index, pressing = false) {
  const title = GIFT.vouchers[index];
  if (!title) return;
  const infinite = index === GIFT.vouchers.length - 1;
  const used = state.vouchers.includes(index);
  openDialog(title, `<div class="ticket-preview ${pressing ? "pressing" : ""}"><b>${escape(GIFT.recipient)}</b><span>${infinite ? "Dùng bao nhiêu lần cũng được" : used ? "ĐÃ SỬ DỤNG" : "Một phiếu của Quỳnh gửi HC"}</span></div><div class="dialog-actions">${!used || infinite ? action(infinite ? "Nhận yêu thương ♡" : "Xác nhận sử dụng", "redeem", 'data-index="' + index + '"') : ""}<button class="button secondary" data-action="save-voucher" data-index="${index}">Lưu ảnh voucher</button></div>`);
}

function hill() {
  const real = GIFT.photos.map((item, i) => ({ item, i })).filter(({ item }) => source(item.src));
  return `<section class="chapter hill-chapter"><div class="chapter-head"><button class="text-link" data-go="map">← Bản đồ</button><h1>Ngọn đồi bí mật</h1></div><div class="hill-scene ${state.ending ? "ending-scene" : ""}"><img src="assets/hill.jpg" alt="Hai chú heo ngồi cạnh nhau dưới bầu trời đầy sao"><div class="hill-shade"></div>
  <button class="moon hill-moon" data-action="egg" data-id="moon" aria-label="Mặt trăng">☾</button>
  ${real.length ? `<div class="memory-stars">${real.slice(0, 12).map(({ item, i }, pos) => `<button style="--delay:${pos * 0.45}s" data-action="photo" data-index="${i}" aria-label="${escape(item.caption || item.id)}"><img src="${escape(source(item.src))}" alt=""></button>`).join("")}</div>` : ""}
  <div class="hill-copy"><p id="hill-line">${escape(state.ending ? GIFT.closing : GIFT.finale[hillLine - 1])}</p>${state.ending ? `<p class="hill-date">${dateText(GIFT.giftDate)} — Made with love, just for ${escape(GIFT.recipient)}.</p>` : ""}</div><div class="hill-pigs">${pig("sage")}${pig("rose")}</div><div class="heart-stars" aria-hidden="true">✦<i>✧</i><i>✧</i><i>·</i><i>✦</i><i>·</i><i>✧</i></div></div>
  ${state.ending ? `<div class="hill-actions">${action("Cho tui một cái ôm", "final-hug")}${linkButton("Mở bưu thiếp cuối hành trình", "certificate", true)}<p id="hug-line" class="handwritten" aria-live="polite"></p></div>` : `<div class="hill-actions">${hillLine < GIFT.finale.length ? '<button class="text-link" data-action="hill-read">Đọc cả lá thư</button>' : ""}<div id="hill-reveal" ${hillLine >= GIFT.finale.length ? "" : "hidden"}>${GIFT.finaleVoice.src || GIFT.finaleVoice.link ? action("Nghe điều cuối cùng tui muốn nói", "final-voice") : '<p class="empty-note">Lời nhắn cuối đang chờ bản thu của Quỳnh <small>VOICE_FINAL</small></p>'}${action(GIFT.finaleVoice.src ? "Đọc lời chúc cuối" : "Mở lời chúc cuối", "finish")}</div></div>`}</section>`;
}
function finishEnding() {
  const shouldPause = finalVoicePlaying;
  finalVoicePlaying = false;
  if (shouldPause && !voice.paused) voice.pause();
  state.ending = true;
  stamp("hill");
  save();
  if (dialog.open) dialog.close();
  render();
  app.querySelector(".hill-scene")?.classList.add("final-hugging");
  sprinkle(app.querySelector(".hill-scene"));
}
function certificate() {
  return chapter("Bưu thiếp cuối hành trình", "", `<article class="certificate"><div class="cert-botanical" aria-hidden="true">❀ ✿ ❀</div><p class="date-label">GIẤY CHỨNG NHẬN</p><h2>${escape(GIFT.recipient)}</h2><p class="script">là chú heo được yêu thương rất nhiều.</p><div class="cert-pigs">${pig("sage")}${pig("rose")}</div><dl><div><dt>Người sở hữu</dt><dd>${escape(GIFT.recipient)}</dd></div><div><dt>Ngày cấp</dt><dd>${dateText(GIFT.giftDate)}</dd></div><div><dt>Người cấp</dt><dd>Người thương HC</dd></div><div><dt>Thời hạn</dt><dd>Không có ngày hết hạn</dd></div></dl><div class="signature"><span class="script">${escape(GIFT.sender)}</span><span aria-hidden="true">✿</span></div></article><div class="trail-links">${action("Lưu ảnh bưu thiếp", "save-certificate")}${linkButton("Về thế giới nhỏ", "map", true)}</div>`);
}

function surprise(id) {
  if (id !== "clover" && !GIFT.eggs[id]) return;
  add("eggs", id);
  const names = { moon: "Gửi chú heo trước giờ ngủ", butterfly: "Lời nhắn của chú bướm", clover: "Cỏ bốn lá", sleep: "Chú heo ngủ quên", hug: "Hai chú heo", nose: "Chú heo đỏ mặt", bonus: "Lá thư ở cuối hộ chiếu" };
  note(names[id], id === "clover" ? GIFT.clover : GIFT.eggs[id]);
}
function sprinkle(target) {
  if (!target || isReduced) return;
  const group = document.createElement("span");
  group.className = "petal-fall";
  group.setAttribute("aria-hidden", "true");
  group.innerHTML = Array.from({ length: 18 }, (_, i) => `<i style="--left:${(i * 39) % 100}%;--delay:${i / 30}s">${i % 3 === 0 ? "✦" : "✿"}</i>`).join("");
  target.append(group);
  setTimeout(() => group.remove(), 2500);
}

function downloadCard(index) {
  const isCertificate = index === undefined;
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = isCertificate ? 850 : 650;
  const ctx = canvas.getContext("2d");
  if (!ctx) { announce("Trình duyệt chưa thể tạo ảnh."); return; }
  const center = canvas.width / 2;
  ctx.fillStyle = "#fff8eb";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = "#b48774";
  ctx.lineWidth = 3;
  ctx.strokeRect(36, 36, canvas.width - 72, canvas.height - 72);
  ctx.strokeStyle = "#e0b6aa";
  ctx.strokeRect(51, 51, canvas.width - 102, canvas.height - 102);
  ctx.textAlign = "center";
  const line = (txt, y, font, color = "#65483d") => {
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.fillText(txt, center, y, 1010);
  };
  const flower = (x, y) => {
    ctx.font = "42px Georgia";
    ctx.fillStyle = "#b94c59";
    ctx.fillText("✿", x, y);
  };
  flower(106, 126);
  flower(canvas.width - 106, 126);
  flower(106, canvas.height - 92);
  flower(canvas.width - 106, canvas.height - 92);
  const drawPig = (x, y, color) => {
    const oval = (dx, dy, rx, ry, fill, angle = 0) => {
      ctx.beginPath();
      ctx.ellipse(x + dx, y + dy, rx, ry, angle, 0, 2 * Math.PI);
      ctx.fillStyle = fill;
      ctx.fill();
    };
    oval(-40, -30, 17, 26, "#eaa1aa", -.5);
    oval(40, -30, 17, 26, "#eaa1aa", .5);
    oval(0, 47, 40, 27, color);
    oval(0, 0, 49, 43, "#f4b8bc");
    oval(-22, -4, 3.5, 5, "#65483d");
    oval(22, -4, 3.5, 5, "#65483d");
    oval(0, 11, 20, 13, "#e58f99");
    oval(-6, 10, 2.6, 3.4, "#a45d65");
    oval(6, 10, 2.6, 3.4, "#a45d65");
  };
  if (isCertificate) {
    line("GIẤY CHỨNG NHẬN", 125, "29px Georgia", "#b94c59");
    line(GIFT.recipient, 220, "78px Georgia");
    line("là chú heo được yêu thương rất nhiều.", 288, "italic 37px Georgia", "#956c58");
    drawPig(540, 375, "#b8c9a3");
    drawPig(655, 385, "#d9969d");
    line("Người sở hữu · " + GIFT.recipient, 520, "32px Georgia");
    line("Ngày cấp · " + dateText(GIFT.giftDate), 570, "30px Georgia");
    line("Người cấp · Người thương HC", 620, "30px Georgia");
    line("Thời hạn · Không có ngày hết hạn", 670, "30px Georgia");
    line(GIFT.sender, 750, "italic 35px Georgia", "#b94c59");
  } else {
    line("VOUCHER CHO " + GIFT.recipient.toUpperCase(), 145, "30px Georgia", "#b94c59");
    line(GIFT.vouchers[index], 245, "56px Georgia");
    drawPig(540, 352, "#b8c9a3");
    drawPig(655, 362, "#d9969d");
    if (state.vouchers.includes(index)) line("ĐÃ SỬ DỤNG", 477, "bold 32px Georgia", "#b94c59");
    if (index === GIFT.vouchers.length - 1) line("Dùng bao nhiêu lần cũng được", 477, "italic 30px Georgia");
    line(GIFT.sender + " · " + dateText(GIFT.giftDate), 535, "italic 34px Georgia", "#956c58");
  }
  canvas.toBlob((blob) => {
    if (!blob) { announce("Chưa lưu được ảnh. HC thử lại nha."); return; }
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = isCertificate ? "Buu-thiep-cho-HC.png" : `Voucher-HC-${two(index + 1)}.png`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(href), 15000);
  });
}

const views = { intro, map, house, museum, radio, garden, stars, post, game, vouchers, hill, certificate, "main-letter": mainLetter };
function render() {
  app.innerHTML = views[scene]();
  app.dataset.scene = scene;
  app.dataset.render = ++renderedCount;
  get("map-nav").hidden = !state.intro || scene === "map";
  document.body.dataset.scene = scene;
  wireAudio();
}
const handlers = {
  "open-main-letter": () => { mainLetterOpen = true; refresh("#keepsake-title"); },
  parcel: () => { envelope = 1; refresh(".envelope-button"); },
  seal: () => { envelope = 2; refresh('[data-action="begin"]'); },
  begin: () => { state.intro = true; save(); startMusic(); go("map"); },
  close: () => dialog.close(),
  passport: showPassport,
  bonus: () => { if (allStamps()) surprise("bonus"); },
  "skip-hill": () => { state.hillPass = true; save(); go("hill"); },
  room: ({ id }) => useRoom(id),
  album: ({ shift }) => {
    albumPage = Math.max(0, Math.min(Math.ceil(GIFT.photos.length / 4) - 1, albumPage + Number(shift)));
    stamp("museum");
    refresh('[data-action="album"]:not(:disabled)');
  },
  photo: (_, i) => showPhoto(i),
  "select-track": (_, i) => {
    if (!GIFT.voices[i]) return;
    selectVoice = i;
    stamp("radio");
    refresh('.tracks button[data-index="' + i + '"]');
  },
  "play-track": (data, _, button) => { if (scene === "radio") stamp("radio"); playTrack(button.closest(".audio-control").dataset); },
  sound: showSound,
  "youtube-track": (_, index) => {
    if (!GIFT.youtubeMusic[index] || youtubeTrack === index) return;
    youtubeTrack = index;
    showYouTubeMusic();
    dialog.querySelector('[aria-pressed="true"]')?.focus();
  },
  "toggle-music": () => {
    state.music = !(soundEnabled && state.music);
    save();
    if (state.music) startMusic();
    else stopMusic();
    showSound();
  },
  "pause-voice": () => { voice.pause(); showSound(); },
  egg: ({ id }, _, button) => {
    if (id === "sleep") button.classList.add("snoring");
    surprise(id);
  },
  nose: (_, i, button) => {
    pigTaps++;
    if (pigTaps < 3) return;
    pigTaps = 0;
    button.classList.add("blushed");
    surprise("nose");
  },
  hug: (_, i, button) => {
    button.parentElement.classList.add("hugging");
    sprinkle(button.parentElement);
    surprise("hug");
  },
  flower: (_, i) => {
    if (!GIFT.flowers[i]) return;
    add("flowers", i);
    stamp("garden");
    refresh('.flower-slot[data-index="' + i + '"]');
    app.querySelector('.flower-slot[data-index="' + i + '"]')?.classList.add("sprouting");
    setTimeout(() => { if (scene === "garden" && !dialog.open) note("Một bông hoa cho HC", GIFT.flowers[i]); }, isReduced ? 0 : 250);
  },
  "draw-star": () => {
    if (state.pendingStar !== null || state.stars.length >= GIFT.stars.length) return;
    const remaining = GIFT.stars.map((_, i) => i).filter((i) => !state.stars.includes(i));
    state.pendingStar = remaining[Math.floor(Math.random() * remaining.length)];
    save();
    refresh('[data-action="open-star"]');
    announce("Một ngôi sao bay ra rồi.");
  },
  "open-star": () => {
    if (state.pendingStar === null) return;
    const i = state.pendingStar;
    state.pendingStar = null;
    add("stars", i);
    stamp("stars");
    refresh('[data-action="draw-star"]');
    showStar(i);
    if (state.stars.length === 19) announce("Sao vàng 19.11 đã xuất hiện.");
  },
  "star-history": () => {
    openDialog("Những ngôi sao đã mở", `<ol class="star-history">${state.stars.map((i, order) => `<li><small>✦ ${two(order + 1)}</small><span>${escape(GIFT.stars[i])}</span></li>`).join("")}</ol>`);
  },
  golden: () => {
    if (state.stars.length < 19) return;
    state.golden = true;
    save();
    refresh('[data-action="golden"]');
    note("✦ Sao vàng ngày 19.11", GIFT.goldenStar);
  },
  letter: (_, i) => showLetter(i),
  "game-item": (_, i, button) => {
    const item = GIFT.game[i];
    if (!item) return;
    add("game", i);
    gameNote = item.text;
    button.classList.add("found");
    button.querySelector("span").textContent = "✓";
    const mover = app.querySelector(".game-mover");
    mover.style.setProperty("--x", (gameCoordinates[i][0] - 7) + "%");
    mover.style.setProperty("--y", (gameCoordinates[i][1] + 8) + "%");
    get("game-note").textContent = item.text;
    app.querySelector(".game-status strong").textContent = state.game.length + "/" + GIFT.game.length + " món đã nhặt";
  },
  "find-pig": () => {
    if (state.game.length < GIFT.game.length) {
      get("game-note").textContent = "Còn " + (GIFT.game.length - state.game.length) + " món trên đường á.";
      return;
    }
    state.foundPig = true;
    save();
    refresh('[data-action="game-hug"]');
    gameHug();
  },
  "game-hug": gameHug,
  "skip-game": () => go("map"),
  voucher: (_, i) => showVoucher(i),
  redeem: (_, i) => {
    if (i !== GIFT.vouchers.length - 1) add("vouchers", i);
    refresh('.voucher[data-index="' + i + '"]');
    dialogReturn = app.querySelector('.voucher[data-index="' + i + '"]');
    showVoucher(i, true);
  },
  "save-voucher": (_, i) => downloadCard(i),
  "hill-read": () => {
    clearInterval(hillTimer);
    hillLine = GIFT.finale.length;
    refresh();
    openDialog("Trên ngọn đồi", `<div class="hill-letter">${GIFT.finale.map((line) => `<p>${escape(line)}</p>`).join("")}</div>`);
  },
  "final-voice": () => {
    openDialog(GIFT.finaleVoice.title, audioControls(GIFT.finaleVoice) + '<div class="dialog-actions">' + action("Đọc lời chúc cuối", "finish") + '</div>');
    if (GIFT.finaleVoice.src) chooseTrack(GIFT.finaleVoice);
  },
  finish: finishEnding,
  "final-hug": () => {
    app.querySelector(".hill-scene")?.classList.add("final-hugging");
    sprinkle(app.querySelector(".hill-scene"));
    get("hug-line").textContent = GIFT.hug;
    add("eggs", "hug");
  },
  "save-certificate": () => downloadCard(),
};
document.addEventListener("click", (event) => {
  const control = event.target.closest("button[data-action], button[data-go]");
  if (!control) return;
  const data = control.dataset;
  if (data.go) go(data.go);
  else handlers[data.action]?.(data, Number(data.index), control);
});
document.addEventListener("input", (event) => {
  const target = event.target;
  if (target.id === "music-volume") {
    state.volume = Number(target.value);
    get("volume-text").textContent = state.volume + "%";
    save();
    levelMusic(!voice.paused);
  }
  if (target.classList.contains("seek") && Number.isFinite(voice.duration)) voice.currentTime = Number(target.value) / 100 * voice.duration;
});
window.addEventListener("popstate", () => go(location.hash.slice(1) || "intro", true));
document.querySelector("footer time").textContent = dateText(GIFT.giftDate);
document.querySelector("footer time").dateTime = GIFT.giftDate;
render();
const startScene = location.hash.slice(1);
if (startScene && startScene !== "intro") go(startScene, true);
