/* Annikas Serien – alles läuft im Browser; Abgleich & Push über GitHub (Zweig "daten") */
const CFG = { check: '15e41090f108a20c08930cceb91a70e016dbd855cae6a910ff2f4684fbf9ddf0', owner: 'janhettich26-collab', repo: 'annikas-serien', branch: 'daten',
  vapid: 'BArCpAXW_imzXuqBKmAYiZ4szxtO6v1w4Rgqs2hkv4tfzyEnrE5X6BQk-2i6-yxq9zyvbEDqtH6OzHWZ_GNeWIM' };
const ST = {
  a: { l: 'Schaue ich', k: 'Schaue ich gerade', d: 'bin mittendrin', i: '✕' },
  w: { l: 'Geht weiter', k: 'Auf Stand', d: 'schaue weiter, wenn Neues kommt', i: '✓' },
  f: { l: 'Fertig', k: 'Komplett fertig', d: 'keine neue Staffel mehr', i: '✓' },
  x: { l: 'Abgebrochen', k: 'Nicht gut', d: 'schaue ich nicht weiter', i: '✕' } };
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const deDate = d => d ? d.split('-').reverse().join('.') : '';

let base = [], news = [], filter = 'alle', query = '', sort = localStorage.sort || 'nr';
let state = { shows: {}, added: [], removed: [] };
/* Vorschau (…/?vorschau): ohne Anmeldung ansehen und ausprobieren; liest Annikas Stand nur, speichert nichts, kein Zugangsschlüssel */
const VORSCHAU = new URLSearchParams(location.search).has('vorschau');
if (!VORSCHAU) try { Object.assign(state, JSON.parse(localStorage.state || '{}')); } catch (e) {}
let tok = VORSCHAU ? '' : (localStorage.ghk || '');
if (!VORSCHAU && location.hash.startsWith('#k=')) { tok = decodeURIComponent(location.hash.slice(3)); localStorage.ghk = tok; history.replaceState(null, '', location.pathname); }

/* ---------- Daten ---------- */
const all = () => base.concat(state.added.filter(a => !base.some(b => b.id === a.id))).filter(s => !state.removed.includes(s.id));
const eff = s => ({ ...s.init, ...(state.shows[s.id] || {}) });
function save(id, patch) {
  if (id) { const sh = all().find(s => s.id === id); state.shows[id] = { ...eff(sh), ...patch, t: Date.now() }; }
  if (VORSCHAU) return;
  localStorage.state = JSON.stringify(state); schedulePush();
}
function hint(s) { // was gibt es Neues zu dieser Serie?
  const e = eff(s); if (e.st !== 'a' && e.st !== 'w') return null;
  if (s.aired > e.s) { const n = s.aired - e.s; return { hot: 1, short: n === 1 ? `Staffel ${s.aired} ist da` : `${n} neue Staffeln`, long: n === 1 ? `Staffel ${s.aired} ist schon verfügbar.` : `Es gibt schon ${s.aired} Staffeln – ${n} mehr als du gesehen hast.` }; }
  if (s.next && s.next.s > e.s) return { hot: 1, short: s.next.d ? `Staffel ${s.next.s} ab ${deDate(s.next.d)}` : `Staffel ${s.next.s} kommt`, long: s.next.d ? `Staffel ${s.next.s} startet am ${deDate(s.next.d)}.` : `Staffel ${s.next.s} ist angekündigt – Termin steht noch nicht fest.` };
  if (e.st === 'w' && s.run === 'Ended') return { short: '', long: 'Die Serie ist beendet – es kommt keine neue Staffel mehr. Du kannst sie auf „Komplett fertig“ setzen.' };
  if (e.st === 'w') return { short: '', long: 'Noch keine neue Staffel angekündigt. Die App prüft das jede Woche.' };
  return null;
}
const pos = e => 'Staffel ' + e.s + (e.e ? ' · Folge ' + e.e : '');
const posS = e => 'S' + e.s + (e.e ? ' · F' + e.e : '');

/* ---------- Anzeige ---------- */
function poster(s) { return s.img ? `<img loading="lazy" src="${esc(s.img)}" alt="">` : `<div class="ph">${esc(s.title)}</div>`; }
function render() {
  const list = all(), cnt = { a: 0, w: 0, f: 0, x: 0 };
  list.forEach(s => cnt[eff(s).st]++);
  $('#sub').textContent = `${list.length} Serien · ${cnt.f + cnt.w} durchgeschaut · ${cnt.a} am Laufen`;
  $('#chips').innerHTML = [['alle', 'Alle', list.length], ['a', '❌ ' + ST.a.l, cnt.a], ['w', '✔️ ' + ST.w.l, cnt.w], ['f', '✅ ' + ST.f.l, cnt.f], ['x', '✖️ ' + ST.x.l, cnt.x]]
    .map(([k, l, n]) => `<button class="chip${filter === k ? ' on' : ''}" data-f="${k}">${l}<b>${n}</b></button>`).join('');
  const plain = filter === 'alle' && !query;
  const now = list.filter(s => eff(s).st === 'a');
  $('#secNow').hidden = !plain || !now.length;
  const nowEl = $('#now'), sl = nowEl.scrollLeft;
  nowEl.innerHTML = now.map(s => { const e = eff(s); return `<div class="now" data-id="${s.id}"><div class="nbg" style="background-image:url('${esc(s.img || '')}')"></div>${s.img ? `<img src="${esc(s.img)}" alt="">` : ''}<div class="inf"><div class="t">${esc(s.title)}</div><div class="m">${pos(e)}</div><button class="plus" data-plus="${s.id}">＋ Folge geschaut</button></div></div>`; }).join('');
  nowEl.scrollLeft = sl;
  $('#dots').innerHTML = now.length > 1 ? now.map(() => '<i></i>').join('') : ''; markDot();
  const nw = list.map(s => [s, hint(s)]).filter(x => x[1] && x[1].hot && eff(x[0]).st === 'w');
  $('#secNew').hidden = !plain || !nw.length;
  $('#new').innerHTML = nw.map(([s, h]) => `<div class="nw" data-id="${s.id}"><div class="card">${poster(s)}</div><div class="tag">${esc(h.short)}</div></div>`).join('');
  let g = list.filter(s => filter === 'alle' || eff(s).st === filter);
  if (query) { const q = query.toLowerCase(); g = g.filter(s => (s.title + ' ' + (s.name || '')).toLowerCase().includes(q)); }
  g.sort(sort === 'az' ? (a, b) => a.title.localeCompare(b.title, 'de') : sort === 'neu' ? (a, b) => (b.nr || 9e9) - (a.nr || 9e9) : (a, b) => (a.nr || 9e9) - (b.nr || 9e9));
  $('#gridTitle').textContent = filter === 'alle' ? 'Alle Serien' : ST[filter].k;
  $('#sort').textContent = 'Reihenfolge: ' + { nr: 'Liste', neu: 'Neueste zuerst', az: 'A–Z' }[sort];
  $('#grid').innerHTML = g.map(s => { const e = eff(s), h = hint(s); return `<div class="card ${e.st}" data-id="${s.id}">${poster(s)}${h && h.hot ? '<span class="dot">NEU</span>' : ''}<span class="bd ${e.st}">${ST[e.st].i}</span><div class="cap"><b>${esc(s.title)}</b><span>${posS(e)}</span></div></div>`; }).join('');
  $('#empty').hidden = g.length > 0;
}
function toast(t) { const el = $('#toast'); el.textContent = t; el.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => el.hidden = true, 2200); }
function openSheet(html) { $('#sheet').innerHTML = html; $('#sheet').hidden = $('#veil').hidden = false; $('#sheet').scrollTop = 0; document.body.style.overflow = 'hidden'; }
function closeSheet() { $('#sheet').hidden = $('#veil').hidden = true; document.body.style.overflow = ''; cur = null; }

let cur = null;
function detail(id) {
  const s = all().find(x => x.id === id); if (!s) return; cur = id;
  const e = eff(s), h = hint(s), big = s.img ? s.img.replace('medium_portrait', 'original_untouched') : '';
  const meta = [s.name && s.name !== s.title ? s.name : '', s.year, s.net, s.aired ? s.aired + (s.aired === 1 ? ' Staffel' : ' Staffeln') : '', s.run === 'Ended' ? 'beendet' : s.run === 'Running' ? 'läuft noch' : ''].filter(Boolean).join(' · ');
  openSheet(`<button class="close" data-close>✕</button>
  <div class="hero"><div class="bg" style="background-image:url('${esc(s.img || '')}')"></div><div class="in">${s.img ? `<img src="${esc(s.img)}" data-big="${esc(big)}" alt="">` : ''}<div><h3>${esc(s.title)}</h3><p>${esc(meta)}</p></div></div></div>
  <div class="lbl">Mein Stand</div>
  <div class="sts">${Object.keys(ST).map(k => `<button class="stb${e.st === k ? ' on' : ''}" data-st="${k}"><span class="bd ${k}">${ST[k].i}</span><span>${ST[k].k}<small>${ST[k].d}</small></span></button>`).join('')}</div>
  <div class="lbl">Wo bin ich?</div>
  <div class="step"><div><button data-step="s,-1">−</button><div class="v"><b>${e.s}</b><small>Staffel</small></div><button data-step="s,1">＋</button></div>
  <div><button data-step="e,-1">−</button><div class="v"><b>${e.e || '–'}</b><small>Folge</small></div><button data-step="e,1">＋</button></div></div>
  ${h ? `<div class="info${h.hot ? ' hot' : ''}">${h.hot ? '🎬 ' : ''}${esc(h.long)}</div>` : ''}
  ${e.st === 'a' || e.st === 'w' ? `<button class="big" data-next>Nächste Staffel anfangen (Staffel ${e.s + 1})</button>` : ''}
  <button class="ghost" data-del>Serie aus meiner Liste entfernen</button>`);
}
function settings() {
  if (VORSCHAU) return openSheet('<button class="close" data-close>✕</button><h3 class="pl">Vorschau</h3><p class="tx">Das ist eine Vorschau von Annikas Serien-App. Du kannst alles antippen und ausprobieren – gespeichert wird nichts, und an Annikas Liste ändert sich nichts.</p><p class="tx">Die echte App hat dazu: eigene Anmeldung, automatische Sicherung und eine Mitteilung aufs Handy, sobald eine neue Staffel kommt.</p>');
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  openSheet(`<button class="close" data-close>✕</button><h3 class="pl">Einstellungen</h3>
  <div class="lbl">Benachrichtigung bei neuer Staffel</div>
  <p class="tx">Du bekommst nur eine Nachricht bei Serien mit ❌ oder ✔️ – also dort, wo du weiterschauen würdest.</p>
  ${!standalone ? '<div class="info">iPhone: erst unten auf „Teilen“ tippen → „Zum Home-Bildschirm“. Dann die App vom Home-Bildschirm öffnen und hier einschalten.</div>' : ''}
  <button class="big" data-push>Benachrichtigungen einschalten</button>
  <div class="lbl">Abgleich</div>
  <p class="tx" id="syncInfo">${tok ? 'Verbunden – dein Stand wird automatisch gesichert.' : 'Noch nicht verbunden: dein Stand liegt nur auf diesem Gerät. Die Sicherung wird von Jan noch freigeschaltet – danach geht es automatisch.'}</p>
  ${tok ? '<button class="ghost" data-sync>Jetzt abgleichen</button>' : ''}
  <div class="lbl">Sicherung</div>
  <button class="ghost" data-exp>Meinen Stand kopieren</button>
  <button class="ghost" data-imp>Stand einfügen (wiederherstellen)</button>
  <button class="ghost" data-out>Abmelden</button>`);
}
let addT;
function addSheet() {
  openSheet(`<button class="close" data-close>✕</button><h3 class="pl">Neue Serie</h3><input class="in" id="addQ" type="search" placeholder="Titel eingeben …" autocomplete="off"><div id="addRes"></div>`);
  setTimeout(() => $('#addQ').focus(), 250);
}
async function addSearch(q) {
  if (q.length < 2) return;
  const r = await fetch('https://api.tvmaze.com/search/shows?q=' + encodeURIComponent(q)).then(r => r.json()).catch(() => []);
  addSearch.res = r.map(x => x.show);
  if ($('#addRes')) $('#addRes').innerHTML = addSearch.res.map((s, i) => `<button class="res" data-add="${i}">${s.image ? `<img src="${esc(s.image.medium)}" alt="">` : '<span class="noi"></span>'}<span><b>${esc(s.name)}</b><small>${esc([(s.premiered || '').slice(0, 4), (s.network || s.webChannel || {}).name].filter(Boolean).join(' · '))}</small></span></button>`).join('') || '<p class="tx">Nichts gefunden.</p>';
}
async function addShow(s) {
  const id = 't' + s.id;
  if (all().some(x => x.id === id)) { toast('Ist schon in deiner Liste'); return detail(id); }
  state.removed = state.removed.filter(x => x !== id);
  let aired = 0, max = 0, next = null;
  try { const se = await fetch(`https://api.tvmaze.com/shows/${s.id}/seasons`).then(r => r.json()); const today = new Date().toISOString().slice(0, 10);
    aired = se.filter(x => x.premiereDate && x.premiereDate <= today).length; max = Math.max(0, ...se.map(x => x.number)); const up = se.find(x => !x.premiereDate || x.premiereDate > today); if (up) next = { s: up.number, d: up.premiereDate || null }; } catch (e) {}
  if (!base.some(b => b.id === id)) state.added.push({ id, nr: Math.max(0, ...all().map(x => x.nr || 0)) + 1, title: s.name, tv: s.id, name: s.name, year: (s.premiered || '').slice(0, 4), img: s.image ? s.image.medium : null, net: (s.network || s.webChannel || {}).name || '', run: s.status, aired, max, next, init: { st: 'a', s: 1, e: 1 } });
  save(id, { st: 'a', s: 1, e: 1 }); render(); detail(id); toast('Hinzugefügt');
}

/* ---------- Bedienung ---------- */
document.addEventListener('click', ev => {
  const t = ev.target, c = sel => t.closest(sel);
  let el;
  if ((el = c('[data-plus]'))) { const id = el.dataset.plus, e = eff(all().find(s => s.id === id)); save(id, { e: (e.e || 0) + 1 }); render(); toast('Folge ' + ((e.e || 0) + 1) + ' ✓'); return; }
  if ((el = c('[data-f]'))) { filter = el.dataset.f; render(); window.scrollTo({ top: 0 }); return; }
  if (c('#sort')) { sort = { nr: 'neu', neu: 'az', az: 'nr' }[sort]; localStorage.sort = sort; return render(); }
  if (c('#btnSet')) return settings();
  if (c('#btnAdd')) return addSheet();
  if (c('[data-close]') || t.id === 'veil') return closeSheet();
  if ((el = c('[data-add]'))) return addShow(addSearch.res[+el.dataset.add]);
  if ((el = c('[data-st]')) && cur) { const k = el.dataset.st, s = all().find(x => x.id === cur), p = { st: k }; if (k === 'f' || k === 'w') p.e = null; if (k === 'f' && s.aired > eff(s).s) p.s = s.aired; save(cur, p); render(); return detail(cur); }
  if ((el = c('[data-step]')) && cur) { const [f, d] = el.dataset.step.split(','), e = eff(all().find(x => x.id === cur)); const v = Math.max(f === 's' ? 1 : 0, (e[f] || 0) + +d); save(cur, f === 's' ? { s: v } : { e: v || null }); render(); return detail(cur); }
  if (c('[data-next]') && cur) { const e = eff(all().find(x => x.id === cur)); save(cur, { st: 'a', s: e.s + 1, e: 1 }); render(); return detail(cur); }
  if (c('[data-del]') && cur) { if (confirm('Wirklich aus der Liste entfernen?')) { state.removed.push(cur); save(); closeSheet(); render(); } return; }
  if (c('[data-push]')) return enablePush();
  if (c('[data-sync]')) return pull().then(() => toast('Abgeglichen'));
  if (c('[data-exp]')) return navigator.clipboard.writeText(JSON.stringify(state)).then(() => toast('Kopiert'));
  if (c('[data-imp]')) { const v = prompt('Gesicherten Stand hier einfügen:'); if (v) try { const o = JSON.parse(v); if (o.shows) { state = { shows: {}, added: [], removed: [], ...o }; save(); render(); toast('Wiederhergestellt'); } } catch (e) { toast('Das war kein gültiger Stand'); } return; }
  if ((el = c('[data-id]'))) return detail(el.dataset.id);
});
$('#q').addEventListener('input', e => { query = e.target.value.trim(); render(); });
document.addEventListener('input', e => { if (e.target.id === 'addQ') { clearTimeout(addT); addT = setTimeout(() => addSearch(e.target.value.trim()), 350); } });

/* ---------- Abgleich über GitHub ---------- */
const b64e = s => btoa(unescape(encodeURIComponent(s))), b64d = s => decodeURIComponent(escape(atob(s.replace(/\s/g, ''))));
const api = (path, opt = {}) => fetch(`https://api.github.com/repos/${CFG.owner}/${CFG.repo}/contents/${path}` + (opt.method ? '' : '?ref=' + CFG.branch), { cache: 'no-store', ...opt, headers: { Authorization: 'Bearer ' + tok, Accept: 'application/vnd.github+json' } });
async function readFile(path, fallback) { const r = await api(path); if (r.status === 404) return { data: fallback, sha: undefined }; if (!r.ok) throw new Error('gh ' + r.status); const j = await r.json(); return { data: JSON.parse(b64d(j.content)), sha: j.sha }; }
const writeFile = (path, data, sha) => api(path, { method: 'PUT', body: JSON.stringify({ message: 'Stand aktualisiert', branch: CFG.branch, sha, content: b64e(JSON.stringify(data)) }) });
let sha, pushT;
function merge(r) {
  if (!r || !r.shows) return;
  for (const id in r.shows) if (!state.shows[id] || (r.shows[id].t || 0) > (state.shows[id].t || 0)) state.shows[id] = r.shows[id];
  (r.added || []).forEach(a => { if (!state.added.some(x => x.id === a.id)) state.added.push(a); });
  state.removed = [...new Set([...(state.removed || []), ...(r.removed || [])])];
  if (!VORSCHAU) localStorage.state = JSON.stringify(state);
}
async function pull() { if (!tok) return; try { const f = await readFile('state.json', {}); sha = f.sha; merge(f.data); render(); } catch (e) { console.warn(e); } }
function schedulePush() { if (!tok) return; clearTimeout(pushT); pushT = setTimeout(pushState, 2500); }
async function pushState(retry) {
  try { let r = await writeFile('state.json', state, sha);
    if (r.status === 409 || r.status === 422) { if (retry) return; await pull(); return pushState(true); }
    if (r.ok) sha = (await r.json()).content.sha; } catch (e) { console.warn(e); }
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && localStorage.dk && !VORSCHAU) { loadBase().then(unlockKey).then(pull); } });

/* ---------- Push ---------- */
const u8 = s => Uint8Array.from(atob((s + '='.repeat((4 - s.length % 4) % 4)).replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
async function enablePush() {
  try {
    if (!('PushManager' in window) || !('Notification' in window)) return toast('Erst zum Home-Bildschirm hinzufügen');
    if (!tok) return toast('Sicherung ist noch nicht freigeschaltet');
    if (await Notification.requestPermission() !== 'granted') return toast('Mitteilungen sind nicht erlaubt');
    const reg = await navigator.serviceWorker.ready;
    const sub = (await reg.pushManager.getSubscription()) || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: u8(CFG.vapid) });
    const f = await readFile('subs.json', []), j = sub.toJSON();
    if (!f.data.some(x => x.endpoint === j.endpoint)) { f.data.push(j); const r = await writeFile('subs.json', f.data, f.sha); if (!r.ok) throw new Error('subs ' + r.status); }
    toast('Benachrichtigungen sind an ✓');
  } catch (e) { console.warn(e); toast('Hat nicht geklappt – bitte nochmal'); }
}

/* ---------- Start ---------- */
async function loadBase() {
  try { const [s, n] = await Promise.all([fetch('data/shows.json', { cache: 'no-cache' }).then(r => r.json()), fetch('data/news.json', { cache: 'no-cache' }).then(r => r.json()).catch(() => ({}))]);
    base = s; news = n.events || []; if (n.checked) $('#stand').textContent = 'Zuletzt geprüft: ' + deDate(n.checked); if (!VORSCHAU) localStorage.base = JSON.stringify(s); render(); } catch (e) { }
}
/* ---------- Anmeldung (Name + Passwort; entschluesselt auch den Abgleich-Schluessel) ---------- */
const hex = b => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join(''), unhex = h => Uint8Array.from(h.match(/../g), x => parseInt(x, 16));
async function derive(name, pw) {
  const enc = new TextEncoder(), km = await crypto.subtle.importKey('raw', enc.encode(pw.trim().toLowerCase()), 'PBKDF2', false, ['deriveBits']);
  return crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode('annikas-serien:' + name.trim().toLowerCase()), iterations: 200000 }, km, 256);
}
async function unlockKey() { // holt den verschluesselten Abgleich-Schluessel und oeffnet ihn mit dem Passwort
  if (tok || !localStorage.dk) return;
  try { const k = await fetch('data/key.json', { cache: 'no-cache' }).then(r => r.ok ? r.json() : null); if (!k) return;
    const key = await crypto.subtle.importKey('raw', unhex(localStorage.dk), 'AES-GCM', false, ['decrypt']);
    tok = new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unhex(k.iv) }, key, unhex(k.ct))); localStorage.ghk = tok; } catch (e) { console.warn(e); }
}
function start() {
  try { base = JSON.parse(localStorage.base || '[]'); if (base.length) render(); } catch (e) {}
  loadBase().then(unlockKey).then(pull);
}
function login() {
  const el = document.createElement('div'); el.id = 'login';
  el.innerHTML = `<form><div class="logo">🎬</div><h1>Annikas <span>Serien</span></h1><p>Bitte anmelden</p>
  <input id="lgN" placeholder="Name" autocomplete="username" autocapitalize="off" autocorrect="off" spellcheck="false">
  <input id="lgP" type="password" placeholder="Passwort" autocomplete="current-password" autocapitalize="off">
  <button class="big">Anmelden</button><p id="lgE"></p></form>`;
  document.body.appendChild(el);
  el.querySelector('form').addEventListener('submit', async ev => {
    ev.preventDefault();
    const dk = await derive($('#lgN').value, $('#lgP').value);
    if (hex(await crypto.subtle.digest('SHA-256', dk)) !== CFG.check) { $('#lgE').textContent = 'Name oder Passwort stimmt nicht.'; $('#lgP').value = ''; return; }
    localStorage.dk = hex(dk); el.remove(); start();
  });
}
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
async function startVorschau() {
  const b = document.createElement('div'); b.id = 'vorschau'; b.textContent = 'Vorschau · zum Ausprobieren · nichts wird gespeichert'; document.body.prepend(b);
  await loadBase();
  try { merge(await fetch('https://raw.githubusercontent.com/' + CFG.owner + '/' + CFG.repo + '/' + CFG.branch + '/state.json', { cache: 'no-store' }).then(r => r.json())); } catch (e) { console.warn(e); }
  render();
}
if (VORSCHAU) startVorschau(); else if (localStorage.dk) start(); else login();

/* Abmelden */
document.addEventListener('click', e => { if (e.target.closest('[data-out]')) { localStorage.removeItem('dk'); localStorage.removeItem('ghk'); location.reload(); } });

/* Oben gleitet automatisch durch, was sie gerade schaut */
let glideHold = 0;
const slideW = el => el.children.length > 1 ? el.children[1].offsetLeft - el.children[0].offsetLeft : 1;
function markDot() { const el = $('#now'), i = Math.round(el.scrollLeft / slideW(el)); [...$('#dots').children].forEach((d, k) => d.className = k === i ? 'on' : ''); }
$('#now').addEventListener('scroll', markDot, { passive: true });
['touchstart', 'pointerdown'].forEach(ev => $('#now').addEventListener(ev, () => glideHold = Date.now() + 8000, { passive: true }));
setInterval(() => {
  const el = $('#now'), n = el.children.length;
  if (n < 2 || $('#secNow').hidden || !$('#sheet').hidden || document.hidden || Date.now() < glideHold) return;
  let i = Math.round(el.scrollLeft / slideW(el)) + 1; if (i >= n) i = 0;
  el.scrollTo({ left: i * slideW(el), behavior: 'smooth' });
}, 3500);
