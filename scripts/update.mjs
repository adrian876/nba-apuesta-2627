// Actualiza data/calendario.json y data/historial.json con datos de ESPN.
// Lo ejecuta GitHub Actions (.github/workflows/update.yml). En local: node scripts/update.mjs
import { readFile, writeFile } from 'node:fs/promises';

const ESPN = 'https://site.api.espn.com/apis';
const STANDINGS = `${ESPN}/v2/sports/basketball/nba/standings`;
const SCHEDULE = (id, type) => `${ESPN}/site/v2/sports/basketball/nba/teams/${id}/schedule?season=2027&seasontype=${type}`;
const SCOREBOARD = d => `${ESPN}/site/v2/sports/basketball/nba/scoreboard?dates=${d}`;
const FULL_EVERY_MS = 6 * 3600e3;   // reconstruir el calendario completo cada 6 h

// Puntos de los bonus; deben coincidir con BETS de index.html
const BETS = { cup: [-6, -2], mvp: [-3, -1], dpoy: [-3, -1], mip: [-6, -2], sixth: [-6, -2], coach: [-6, -2] };

const readJSON = async (f, def) => { try { return JSON.parse(await readFile(f, 'utf8')); } catch { return def; } };
const writeJSON = (f, v, indent = 1) => writeFile(f, JSON.stringify(v, null, indent) + '\n');

async function get(url) {
  for (let i = 0; i < 3; i++) {
    const r = await fetch(url, { headers: { 'user-agent': 'nba-apuesta-2627' } });
    if (r.ok) return r.json();
    await new Promise(res => setTimeout(res, 2000 * (i + 1)));
  }
  throw new Error('ESPN falla: ' + url);
}

// Fecha YYYY-MM-DD en una zona horaria
const dayIn = (tz, d = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(d);

function normGame(e) {
  const c = e.competitions[0];
  const st = (e.status || c.status || {}).type || {};
  const side = h => {
    const t = c.competitors.find(x => x.homeAway === h);
    const s = t.score == null ? null : typeof t.score === 'object' ? t.score.displayValue : t.score;
    return { t: t.team.abbreviation, s: s == null || s === '' ? null : +s };
  };
  const g = {
    id: e.id, d: e.date, type: (e.seasonType && e.seasonType.type) || (e.season && e.season.type) || null,
    home: side('home'), away: side('away'), st: st.state || 'pre', det: st.shortDetail || '',
  };
  const note = c.notes && c.notes[0] && c.notes[0].headline;
  if (note) g.note = note;
  if (g.st === 'pre') { g.home.s = null; g.away.s = null; }
  return g;
}

async function calendar(standings) {
  const cal = await readJSON('data/calendario.json', { full: null, games: [] });
  const byId = new Map(cal.games.map(g => [g.id, g]));

  if (!cal.full || Date.now() - new Date(cal.full).getTime() > FULL_EVERY_MS) {
    const ids = standings.children.flatMap(ch => ch.standings.entries.map(e => e.team.id));
    const jobs = ids.flatMap(id => [1, 2, 3].map(t => SCHEDULE(id, t)));
    for (let i = 0; i < jobs.length; i += 6) {
      const res = await Promise.all(jobs.slice(i, i + 6).map(u => get(u).catch(() => null)));
      for (const r of res) for (const e of (r && r.events) || []) byId.set(e.id, normGame(e));
    }
    cal.full = new Date().toISOString();
  }

  // Marcadores frescos de ayer, hoy y mañana (fechas de EE. UU., como las agrupa ESPN)
  for (const off of [-1, 0, 1]) {
    const d = dayIn('America/New_York', new Date(Date.now() + off * 864e5)).replaceAll('-', '');
    const r = await get(SCOREBOARD(d)).catch(() => null);
    for (const e of (r && r.events) || []) byId.set(e.id, normGame(e));
  }

  cal.games = [...byId.values()].sort((a, b) => a.d.localeCompare(b.d) || a.id.localeCompare(b.id));
  await writeJSON('data/calendario.json', cal, 0);
  console.log('calendario:', cal.games.length, 'partidos');
}

function scores(standings, bets) {
  const types = (standings.seasons && standings.seasons[0] && standings.seasons[0].types) || [];
  const reg = types.find(t => t.abbreviation === 'reg');
  const pre = reg ? Date.now() < new Date(reg.startDate).getTime() : false;

  const pos = {};
  for (const ch of standings.children) {
    const list = ch.standings.entries.map(e => {
      const s = {}; e.stats.forEach(x => s[x.name] = x.displayValue);
      return { abbr: e.team.abbreviation, seed: +s.playoffSeed || 99, pct: +s.winPercent || 0, diff: +s.pointDifferential || 0 };
    });
    list.sort((a, b) => a.seed - b.seed || b.pct - a.pct || b.diff - a.diff);
    list.forEach((t, i) => pos[t.abbr] = i + 1);
  }

  const out = {};
  for (const [name, p] of Object.entries(bets.players)) {
    let base = 0;
    if (!pre) for (const c of ['E', 'W']) p[c].forEach((abbr, i) => base += Math.abs((pos[abbr] || i + 1) - (i + 1)));
    let bonus = 0;
    for (const [k, [win, fin]] of Object.entries(BETS)) {
      const r = bets.results[k];
      if (!r || !r.winner) continue;
      if (p[k] === r.winner) bonus += win;
      else if ((r.finalists || []).includes(p[k])) bonus += fin;
    }
    out[name] = [base + bonus, base, bonus];
  }
  return { pre, pts: out };
}

async function history(standings) {
  const bets = await readJSON('data/apuestas.json');
  const h = await readJSON('data/historial.json', { days: [] });
  const today = dayIn('Europe/Madrid');
  const { pre, pts } = scores(standings, bets);
  const entry = { d: today, pre, pts };
  const i = h.days.findIndex(x => x.d === today);
  if (i >= 0) h.days[i] = entry; else h.days.push(entry);
  h.days.sort((a, b) => a.d.localeCompare(b.d));
  await writeJSON('data/historial.json', h);
  console.log('historial', today, JSON.stringify(pts));
}

const standings = await get(STANDINGS);
await calendar(standings);
await history(standings);
