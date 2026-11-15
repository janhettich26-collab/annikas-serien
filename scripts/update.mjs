// Wochenlauf: Staffelstand aller Serien bei TVmaze pruefen, data/ aktualisieren, Push senden.
// Aufruf: node scripts/update.mjs [Ordner mit state.json + subs.json]
import fs from 'fs';
const dir = process.argv[2] || '_daten';
const rd = (p, d) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return d; } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const get = async u => { for (let i = 0; i < 5; i++) { try { const r = await fetch(u); if (r.status === 429) { await sleep(4000); continue; } if (!r.ok) return null; return await r.json(); } catch (e) { await sleep(2000); } } return null; };
const de = d => d.split('-').reverse().join('.');
const today = new Date().toISOString().slice(0, 10);

const shows = rd('data/shows.json', []);
const state = rd(dir + '/state.json', {}), subs = rd(dir + '/subs.json', []);
const old = rd('data/news.json', { events: [] });
for (const a of state.added || []) if (!shows.some(s => s.id === a.id)) shows.push({ ...a, fresh: true });

const events = [];
for (const s of shows) {
  if (!s.tv) continue;
  const sh = await get(`https://api.tvmaze.com/shows/${s.tv}?embed=seasons`); await sleep(600);
  if (!sh || !sh._embedded) { console.log('uebersprungen', s.title); continue; }
  const se = sh._embedded.seasons;
  const aired = se.filter(x => x.premiereDate && x.premiereDate <= today).length;
  const max = se.length ? Math.max(...se.map(x => x.number)) : 0;
  const up = se.find(x => !x.premiereDate || x.premiereDate > today);
  const next = up ? { s: up.number, d: up.premiereDate || null } : null;
  const fresh = s.fresh; delete s.fresh;
  if (!fresh) {
    if (aired > (s.aired || 0)) events.push({ id: s.id, text: `${s.title}: Staffel ${aired} ist jetzt da` });
    else if (max > (s.max || 0)) events.push({ id: s.id, text: `${s.title}: Staffel ${max} ` + (next && next.d ? `startet am ${de(next.d)}` : 'ist angekündigt') });
    else if (next && next.d && !(s.next && s.next.d)) events.push({ id: s.id, text: `${s.title}: Staffel ${next.s} startet am ${de(next.d)}` });
  }
  Object.assign(s, { aired, max, next, run: sh.status, img: sh.image ? sh.image.medium : s.img || null });
}
// nur Serien, die sie weiterschauen wuerde (❌ aktiv / ✔️ geht weiter) und die nicht entfernt sind
const st = s => ({ ...s.init, ...((state.shows || {})[s.id] || {}) }).st;
const mine = events.filter(e => { const s = shows.find(x => x.id === e.id); return ['a', 'w'].includes(st(s)) && !(state.removed || []).includes(s.id); });
console.log('Aenderungen gesamt:', events.length, '| fuer Push:', mine.length); mine.forEach(e => console.log(' -', e.text));

fs.writeFileSync('data/shows.json', JSON.stringify(shows).replace(/\},\{"id"/g, '},\n{"id"'));
fs.writeFileSync('data/news.json', JSON.stringify({ checked: today, events: mine.map(e => ({ ...e, d: today })).concat(old.events || []).slice(0, 40) }));

const test = process.env.PUSH_TEST;
if ((mine.length || test) && subs.length && process.env.VAPID_PRIVATE) {
  const wp = (await import('web-push')).default;
  wp.setVapidDetails('https://github.com/' + (process.env.GITHUB_REPOSITORY || ''), process.env.VAPID_PUBLIC, process.env.VAPID_PRIVATE);
  const body = test ? 'Test: Benachrichtigungen funktionieren ✓' : mine.slice(0, 4).map(e => e.text).join('\n') + (mine.length > 4 ? `\n… und ${mine.length - 4} weitere` : '');
  for (const sub of subs) {
    try { await wp.sendNotification(sub, JSON.stringify({ title: test ? 'Annikas Serien' : '🎬 Neue Staffel!', body })); console.log('Push gesendet'); }
    catch (e) { console.log('Push fehlgeschlagen', e.statusCode || e.message); }
  }
} else console.log('Kein Push (Ereignisse:', mine.length, '· Geraete:', subs.length, ')');
