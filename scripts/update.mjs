// Actualiza data/calendario.json y data/historial.json con datos de ESPN.
// Lo ejecuta GitHub Actions (.github/workflows/update.yml). En local: node scripts/update.mjs
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';

const ESPN = 'https://site.api.espn.com/apis';
const STANDINGS = `${ESPN}/v2/sports/basketball/nba/standings?seasontype=2`;   // siempre liga regular
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

// Plantillas actuales de los 30 equipos con las medias de temporada de cada jugador.
// Si la temporada aún no tiene datos, ESPN devuelve la anterior (requestedSeason lo indica).
const ROSTER = id => `${ESPN}/site/v2/sports/basketball/nba/teams/${id}/roster`;
const PLAYER_STATS = `https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba/statistics/byathlete?season=2027&seasontype=2&limit=1000`;

async function rosters(standings) {
  const old = await readJSON('data/plantillas.json', null);
  const hasLeaders = await readJSON('data/lideres.json', null);
  if (old && hasLeaders && Date.now() - new Date(old.updated).getTime() < FULL_EVERY_MS) return;

  const ps = await get(PLAYER_STATS);
  const idx = {};
  ps.categories.forEach(c => c.names.forEach((n, i) => idx[n] = [c.name, i]));
  const val = (a, n) => { const [c, i] = idx[n]; const cat = a.categories.find(x => x.name === c); return cat ? +cat.values[i] : 0; };
  const r1 = v => Math.round(v * 10) / 10;
  const stats = {};
  for (const a of ps.athletes) {
    stats[a.athlete.id] = {
      gp: val(a, 'gamesPlayed'), min: r1(val(a, 'avgMinutes')), pts: r1(val(a, 'avgPoints')),
      reb: r1(val(a, 'avgRebounds')), ast: r1(val(a, 'avgAssists')), stl: r1(val(a, 'avgSteals')),
      blk: r1(val(a, 'avgBlocks')), to: r1(val(a, 'avgTurnovers')),
      fgm: r1(val(a, 'avgFieldGoalsMade')), fga: r1(val(a, 'avgFieldGoalsAttempted')), fgp: r1(val(a, 'fieldGoalPct')),
      tpm: r1(val(a, 'avgThreePointFieldGoalsMade')), tpa: r1(val(a, 'avgThreePointFieldGoalsAttempted')), tpp: r1(val(a, 'threePointFieldGoalPct')),
    };
  }

  const teams = {};
  for (const ch of standings.children) for (const e of ch.standings.entries) {
    const r = await get(ROSTER(e.team.id)).catch(() => null);
    if (!r) { if (old && old.teams[e.team.abbreviation]) teams[e.team.abbreviation] = old.teams[e.team.abbreviation]; continue; }
    teams[e.team.abbreviation] = r.athletes.map(a => {
      const p = { id: a.id, n: a.displayName, j: a.jersey || '', p: (a.position && a.position.abbreviation) || '' };
      const inj = a.injuries && a.injuries[0];
      if (inj && inj.status) p.inj = inj.status;
      if (stats[a.id]) p.s = stats[a.id];
      return p;
    });
  }
  const season = ps.requestedSeason ? ps.requestedSeason.displayName : '';
  await writeJSON('data/plantillas.json', { updated: new Date().toISOString(), season, teams }, 0);
  console.log('plantillas:', Object.keys(teams).length, 'equipos, estadísticas de', season);
  await leaders(ps, val, season);
}

// Líderes de la temporada (top 10) de jugadores y equipos.
// Eficiencia (EFF de la NBA) = PTS + REB + AST + ROB + TAP - tiros fallados - libres fallados - pérdidas, por partido.
const TEAM_STATS = `https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba/statistics/byteam?season=2027&seasontype=2&limit=50`;
const LEADER_CATS = [
  ['pts', 'Puntos totales'], ['ppg', 'Puntos por partido'], ['apg', 'Asistencias por partido'],
  ['rpg', 'Rebotes por partido'], ['eff', 'Eficiencia por partido'], ['spg', 'Robos por partido'],
];
const r1 = v => Math.round(v * 10) / 10;
const eff = x => x.ppg + x.rpg + x.apg + x.spg + x.bpg - (x.fga - x.fgm) - (x.fta - x.ftm) - x.tov;

async function leaders(ps, val, season) {
  // jugadores: para las medias hay que haber jugado al menos el 70 % de los partidos del que más ha jugado
  const pl = ps.athletes.map(a => {
    const x = {
      id: a.athlete.id, n: a.athlete.displayName, t: a.athlete.teamShortName || '', gp: val(a, 'gamesPlayed'),
      pts: val(a, 'points'), ppg: val(a, 'avgPoints'), apg: val(a, 'avgAssists'), rpg: val(a, 'avgRebounds'),
      spg: val(a, 'avgSteals'), bpg: val(a, 'avgBlocks'), tov: val(a, 'avgTurnovers'),
      fgm: val(a, 'avgFieldGoalsMade'), fga: val(a, 'avgFieldGoalsAttempted'), ftm: val(a, 'avgFreeThrowsMade'), fta: val(a, 'avgFreeThrowsAttempted'),
    };
    x.eff = eff(x);
    return x;
  });
  const maxGp = Math.max(1, ...pl.map(x => x.gp));
  const minGp = Math.max(1, Math.ceil(maxGp * 0.7));
  const players = {};
  for (const [k] of LEADER_CATS) {
    const pool = k === 'pts' ? pl : pl.filter(x => x.gp >= minGp);
    players[k] = pool.sort((a, b) => b[k] - a[k]).slice(0, 10).map(x => ({ id: x.id, n: x.n, t: x.t, gp: x.gp, v: k === 'pts' ? x.pts : r1(x[k]) }));
  }

  // equipos
  const ts = await get(TEAM_STATS);
  const tidx = {};
  ts.categories.forEach(c => (c.names || []).forEach((n, i) => tidx[c.name + ':' + n] ??= i));
  const tval = (t, cat, n) => { const c = t.categories.find(x => x.name === cat && x.splitId === '0'); const i = tidx[cat + ':' + n]; return c && i != null ? +c.values[i] : 0; };
  const tl = ts.teams.map(t => {
    const x = {
      t: t.team.abbreviation, gp: tval(t, 'general', 'gamesPlayed'),
      pts: tval(t, 'offensive', 'points'), ppg: tval(t, 'offensive', 'avgPoints'), apg: tval(t, 'offensive', 'avgAssists'),
      rpg: tval(t, 'general', 'avgRebounds'), spg: tval(t, 'defensive', 'avgSteals'), bpg: tval(t, 'defensive', 'avgBlocks'),
      tov: tval(t, 'offensive', 'avgTurnovers'), fgm: tval(t, 'offensive', 'avgFieldGoalsMade'), fga: tval(t, 'offensive', 'avgFieldGoalsAttempted'),
      ftm: tval(t, 'offensive', 'avgFreeThrowsMade'), fta: tval(t, 'offensive', 'avgFreeThrowsAttempted'),
    };
    x.eff = eff(x);
    return x;
  });
  const teams = {};
  for (const [k] of LEADER_CATS) teams[k] = tl.sort((a, b) => b[k] - a[k]).slice(0, 10).map(x => ({ t: x.t, gp: x.gp, v: k === 'pts' ? x.pts : r1(x[k]) }));

  await writeJSON('data/lideres.json', { updated: new Date().toISOString(), season, minGp, cats: LEADER_CATS, players, teams }, 0);
  console.log('líderes de', season, '· mínimo', minGp, 'partidos · máx. anotador:', players.ppg[0] && players.ppg[0].n, players.ppg[0] && players.ppg[0].v);
}

// Copia de seguridad de la estadística de cada partido terminado: data/partidos/<id>.json.
// Misma forma que boxscore.players de ESPN pero solo con los campos que usa la web.
// La web la usa solo si ESPN falla. Como mucho BACKUP_PER_RUN partidos por ejecución.
const SUMMARY = id => `${ESPN}/site/v2/sports/basketball/nba/summary?event=${id}`;
const BACKUP_PER_RUN = 60;

async function backups() {
  await mkdir('data/partidos', { recursive: true });
  const have = new Set((await readdir('data/partidos')).map(f => f.replace('.json', '')));
  const cal = await readJSON('data/calendario.json', { games: [] });
  const todo = cal.games.filter(g => g.st === 'post' && !have.has(g.id)).slice(0, BACKUP_PER_RUN);
  let saved = 0;
  for (const g of todo) {
    const d = await get(SUMMARY(g.id)).catch(() => null);
    const players = d && d.boxscore && d.boxscore.players;
    if (!players || !players.length) continue;   // aún sin estadística: se reintenta en la siguiente ejecución
    const slim = players.map(tp => {
      const st = tp.statistics[0];
      return {
        team: { abbreviation: tp.team.abbreviation },
        statistics: [{
          labels: st.labels, totals: st.totals,
          athletes: st.athletes.map(a => ({
            athlete: { id: a.athlete.id, displayName: a.athlete.displayName, shortName: a.athlete.shortName, jersey: a.athlete.jersey },
            starter: !!a.starter, didNotPlay: !!a.didNotPlay, stats: a.stats || [],
          })),
        }],
      };
    });
    await writeJSON(`data/partidos/${g.id}.json`, { id: g.id, d: g.d, home: g.home, away: g.away, boxscore: { players: slim } }, 0);
    saved++;
  }
  console.log('copias de partidos:', saved, 'nuevas,', have.size + saved, 'en total');
}

const standings = await get(STANDINGS);
await calendar(standings);
await history(standings);
await rosters(standings);
await backups();
