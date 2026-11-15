// Verschluesselt den GitHub-Zugangsschluessel mit Name + Passwort -> data/key.json
// Aufruf: node scripts/schluessel.mjs <Name> <Passwort> [Zugangsschluessel]
import fs from 'fs';
const [name, pw, token] = process.argv.slice(2);
const enc = new TextEncoder(), hex = b => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
const km = await crypto.subtle.importKey('raw', enc.encode(pw.trim().toLowerCase()), 'PBKDF2', false, ['deriveBits']);
const dk = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode('annikas-serien:' + name.trim().toLowerCase()), iterations: 200000 }, km, 256);
console.log('check', hex(await crypto.subtle.digest('SHA-256', dk)));
if (token) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await crypto.subtle.importKey('raw', dk, 'AES-GCM', false, ['encrypt']);
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(token));
  fs.writeFileSync('data/key.json', JSON.stringify({ iv: hex(iv), ct: hex(ct) }));
  console.log('data/key.json geschrieben');
}
