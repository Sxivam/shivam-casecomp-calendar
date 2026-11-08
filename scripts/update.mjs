#!/usr/bin/env node
/*
  Weekly self-update for a case-comp site.

    ANTHROPIC_API_KEY=... node scripts/update.mjs            update the data files in place
    ANTHROPIC_API_KEY=... node scripts/update.mjs --dry      print what would change, write nothing
    node scripts/update.mjs --unstop-only                    refresh only the "open now" list (no API key needed)

  What it does, in order:
    1. Pulls open competitions from Unstop's public listing API (real titles, dates and links, never model-written).
    2. Asks Claude to pick the Unstop listings that belong on this site and match them to existing entries.
    3. Asks Claude (with web search) to re-check every entry in batches and return only changes, each with a source URL.
    4. Asks Claude for a few new entries this site is missing, each with a source URL.
    5. Checks every new link responds, applies only allowed fields, never deletes, and logs every change.
  Site-specific settings live in scripts/site.json. The GitHub Action in .github/workflows/weekly-update.yml runs it every Monday.
*/
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import Anthropic from '@anthropic-ai/sdk';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CFG = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/site.json'), 'utf8'));
const DRY = process.argv.includes('--dry');
let UNSTOP_ONLY = process.argv.includes('--unstop-only');
const EVERY_DAYS = 10;
const TODAY = new Date().toISOString().slice(0, 10);
const MODEL = 'claude-haiku-5-5'; // Haiku 5.5 at medium effort ONLY (his rule). Never switch to Opus/Sonnet.
const log = (...a) => console.log(...a);

/* ---------- data files: window.X = {...}; ---------- */
const readWin = (file, name) => {
  const p = path.join(ROOT, file);
  if (!fs.existsSync(p)) return null;
  const ctx = { window: {} };
  vm.runInNewContext(fs.readFileSync(p, 'utf8'), ctx);
  return ctx.window[name];
};
const writeWin = (file, name, value, header) => {
  if (DRY) return;
  fs.writeFileSync(path.join(ROOT, file), `/* ${header} */\nwindow.${name} = ${JSON.stringify(value, null, 1)};\n`);
};

const data = readWin(CFG.dataFile, CFG.dataVar);
const entries = CFG.listKey ? data[CFG.listKey] : data;
const byId = new Map(entries.map((e) => [String(e[CFG.idKey]), e]));

/* ---------- 1. Unstop ---------- */
async function unstop() {
  const seen = new Map();
  for (const term of CFG.unstopTerms) {
    for (let page = 1; page <= 3; page++) {
      const url = `https://unstop.com/api/public/opportunity/search-result?opportunity=competitions&oppstatus=open&per_page=30&page=${page}&searchTerm=${encodeURIComponent(term)}`;
      try {
        const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (case-comp calendar updater)', Accept: 'application/json' } });
        if (!r.ok) { log(`  unstop ${term} p${page}: HTTP ${r.status}`); break; }
        const j = await r.json();
        const rows = j?.data?.data || [];
        for (const x of rows) {
          if (x.type !== 'competitions') continue;
          const end = x.regnRequirements?.end_regn_dt || x.end_date || null;
          seen.set(x.id, {
            id: x.id,
            title: String(x.title || '').trim(),
            org: x.organisation?.name || '',
            festival: x.festival?.title || x.festival_name || '',
            ends: end,
            url: `https://unstop.com/${x.public_url}`,
            region: x.region || '',
          });
        }
        if (rows.length < 30) break;
      } catch (e) { log(`  unstop ${term}: ${e.message}`); break; }
    }
  }
  return [...seen.values()].filter((x) => !x.ends || new Date(x.ends) > new Date());
}

/* ---------- Claude ---------- */
let client = null;
const TOOLS = [
  { type: 'web_search_20250305', name: 'web_search', max_uses: CFG.searchesPerBatch || 3, user_location: { type: 'approximate', country: 'IN' } },
  { type: 'web_fetch_20250910', name: 'web_fetch', max_uses: 2, max_content_tokens: 6000 },
];
let spend = { input: 0, output: 0, searches: 0 };

async function ask(system, prompt, useWeb = true) {
  client ??= new Anthropic();
  const messages = [{ role: 'user', content: prompt }];
  for (let turn = 0; turn < 8; turn++) {
    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: 16000,
      output_config: { effort: 'medium' },
      system,
      tools: useWeb ? TOOLS : undefined,
      messages,
    });
    const msg = await stream.finalMessage();
    spend.input += msg.usage.input_tokens + (msg.usage.cache_read_input_tokens || 0);
    spend.output += msg.usage.output_tokens;
    spend.searches += msg.usage.server_tool_use?.web_search_requests || 0;
    if (msg.stop_reason === 'pause_turn') { messages.push({ role: 'assistant', content: msg.content }); continue; }
    if (msg.stop_reason === 'refusal') throw new Error('model declined the request');
    const text = msg.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n');
    const m = text.match(/```json\s*([\s\S]*?)```/) || text.match(/(\{[\s\S]*\})\s*$/);
    if (!m) throw new Error('no JSON in reply');
    return JSON.parse(m[1]);
  }
  throw new Error('too many paused turns');
}

const SYSTEM = `You maintain the data for "${CFG.siteName}", ${CFG.siteAbout}
Today is ${TODAY}. Accuracy matters more than coverage: a wrong date or a dead link costs a student a season.
Rules:
- Only report a change when a source you actually opened supports it. Put that URL in "source".
- Prefer official sites, the organiser's Instagram/LinkedIn, and Unstop. Ignore SEO aggregator pages that copy old data.
- Never invent a URL. Never guess a date; if a new season isn't announced, leave the entry alone.
- Keep the site's tone: short, plain, no hype, no em dashes.
- Reply with your reasoning first if you like, then end with exactly one JSON object in a \`\`\`json fence.`;

/* ---------- link checks ---------- */
async function alive(url) {
  if (!/^https?:\/\//.test(url || '')) return false;
  for (const method of ['HEAD', 'GET']) {
    try {
      const r = await fetch(url, { method, redirect: 'follow', signal: AbortSignal.timeout(15000), headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (r.status < 400) return true;
      if (r.status === 403 && /instagram|linkedin/.test(url)) return true; // they block bots but the page exists
    } catch {}
  }
  return false;
}

/* ---------- apply ---------- */
const changes = [];
const getAt = (o, k) => k.split('.').reduce((a, p) => (a == null ? a : a[p]), o);
const setAt = (o, k, v) => { const ps = k.split('.'); let a = o; ps.slice(0, -1).forEach((p) => { a[p] = a[p] && typeof a[p] === 'object' ? a[p] : {}; a = a[p]; }); a[ps.at(-1)] = v; };

const MON = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
// months a window text covers, e.g. "Sep–Nov" -> 9,10,11; "Nov–Dec reg · finale Mar" -> 11,12 (first range only)
function windowMonths(t) {
  const ms = [...String(t || '').toLowerCase().matchAll(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/g)].map((m) => MON[m[1]]);
  if (!ms.length) return null;
  const [a, b] = [ms[0], ms[1] && /^[^·;,(]*$/.test(String(t).split(/[·;,(]/)[0]) ? ms[1] : ms[0]];
  const out = []; for (let m = a, i = 0; i < 12; i++, m = m % 12 + 1) { out.push(m); if (m === b) break; } return out;
}
// Links written by the model must be plain https, and an existing official link can't be moved to a new
// domain (a poisoned web page could otherwise swap in a phishing page that "loads fine").
const TRUSTED_HOSTS = ['unstop.com', 'instagram.com', 'linkedin.com'];
// registrable domain: hul.co.in, iima.ac.in and bcg.com stay whole (handles two-part endings like .co.in / .ac.in)
const baseDomain = (h) => { const p = h.replace(/^www\./, '').toLowerCase().split('.'); const n = p.length >= 3 && p.at(-1).length === 2 && /^(co|ac|org|net|gov|edu|com|res|nic)$/.test(p.at(-2)) ? 3 : 2; return p.slice(-n).join('.'); };
function safeLink(url, oldUrl) {
  let u; try { u = new URL(String(url)); } catch { return false; }
  if (u.protocol !== 'https:' || u.username || u.password) return false;
  if (/^[\d.]+$|^\[|localhost/i.test(u.hostname)) return false;
  if (oldUrl) {
    let o; try { o = new URL(String(oldUrl)); } catch { o = null; }
    if (o && baseDomain(o.hostname) !== baseDomain(u.hostname) && !TRUSTED_HOSTS.includes(baseDomain(u.hostname))) return false;
  }
  return true;
}
const MAX_CHANGES = 40, MAX_LINK_CHANGES = 10;
let linkChanges = 0;

async function applyPatch(p) {
  const e = byId.get(String(p.id));
  if (!e) return log(`  skip: unknown id ${p.id}`);
  if (!p.source || !/^https?:\/\//.test(p.source)) return log(`  skip ${p.id}: no source`);
  // a new window text must still contain the month the entry is filed under (or move both together)
  const MC = CFG.monthCheck;
  if (MC && p.set && p.set[MC.text] !== undefined) {
    const mo = p.set[MC.month] ?? e[MC.month], wm = windowMonths(p.set[MC.text]);
    if (wm && !/dormant/i.test(p.set[MC.text]) && !wm.includes(mo)) { log(`  skip ${p.id}.${MC.text}: "${p.set[MC.text]}" does not include month ${mo}`); delete p.set[MC.text]; }
  }
  for (const [field, value] of Object.entries(p.set || {})) {
    const rule = CFG.fields[field];
    if (!rule) { log(`  skip ${p.id}.${field}: not an editable field`); continue; }
    if (changes.length >= MAX_CHANGES) { log(`  stop: ${MAX_CHANGES} changes reached this run`); return; }
    if (rule === 'url') {
      if (!safeLink(value, getAt(e, field))) { log(`  skip ${p.id}.${field}: not an allowed link (${value})`); continue; }
      if (linkChanges >= MAX_LINK_CHANGES) { log(`  skip ${p.id}.${field}: link change cap reached`); continue; }
      if (!(await alive(value))) { log(`  skip ${p.id}.${field}: link doesn't load (${value})`); continue; }
      linkChanges++;
    }
    if (rule === 'month' && !(Number.isInteger(value) && value >= 1 && value <= 12)) continue;
    if (rule === 'bool' && typeof value !== 'boolean') continue;
    if (rule === 'text' && (typeof value !== 'string' || value.length > 400)) continue;
    const before = getAt(e, field);
    if (JSON.stringify(before) === JSON.stringify(value)) continue;
    setAt(e, field, typeof value === 'string' ? value.replace(/\s[—–]\s/g, ', ') : value);
    changes.push({ id: p.id, name: e[CFG.nameKey], field, from: before ?? null, to: value, source: p.source });
  }
}

/* ---------- run ---------- */
const prevLive = readWin(CFG.liveFile, 'LIVE');
const prevLog = readWin(CFG.logFile, 'UPDATES') || { runs: [] };
// --auto (the daily schedule): a full check only when the last one is EVERY_DAYS or more old
if (process.argv.includes('--auto')) {
  const age = prevLog.last ? (Date.parse(TODAY) - Date.parse(prevLog.last)) / 864e5 : Infinity;
  UNSTOP_ONLY = age < EVERY_DAYS || !process.env.ANTHROPIC_API_KEY;
  log(UNSTOP_ONLY ? `Last full check ${prevLog.last || 'never'}; next one after ${EVERY_DAYS} days. Refreshing Unstop only.` : `Last full check ${prevLog.last || 'never'}: running a full check.`);
}

log(`\n${CFG.siteName}: ${entries.length} entries, ${TODAY}${DRY ? ' (dry run)' : ''}`);
log('1. Unstop');
const listings = await unstop();
log(`   ${listings.length} open competitions`);

let live = prevLive?.items || [];
if (listings.length && !UNSTOP_ONLY) {
  log('2. Picking Unstop listings for this site');
  try {
  const compact = listings.map((x) => ({ u: x.id, t: x.title, o: x.org, f: x.festival, ends: x.ends?.slice(0, 10) }));
  const names = entries.map((e) => ({ id: e[CFG.idKey], n: e[CFG.nameKey], o: e.org || e.inst || '' }));
  const pick = await ask(SYSTEM, `${CFG.livePrompt}

Our entries (id, name, organiser):
${JSON.stringify(names)}

Open Unstop listings (u = Unstop id):
${JSON.stringify(compact)}

Return {"picks":[{"u":<unstop id>,"match":"<our entry id or null>","track":"<one short label, e.g. Marketing, Finance, Strategy, Product, Ops, General>"}]}. Pick at most ${CFG.liveMax}. Leave out quizzes, school-level contests, paid-entry contests run by training companies, and anything off-topic.`, false);
  const lu = new Map(listings.map((x) => [x.id, x]));
  live = (pick.picks || []).map((p) => {
    const x = lu.get(Number(p.u)); if (!x) return null;
    const match = p.match && byId.has(String(p.match)) ? String(p.match) : null;
    return { ...x, match, track: String(p.track || '').slice(0, 24) };
  }).filter(Boolean).sort((a, b) => String(a.ends).localeCompare(String(b.ends)));
  log(`   kept ${live.length}`);
  } catch (e) {
    if (e.status === 401) { console.error('The Anthropic API key was rejected (401). Re-set the ANTHROPIC_API_KEY secret.'); process.exit(1); }
    log(`   picking failed: ${e.message}`);
  }
} else if (listings.length && UNSTOP_ONLY) {
  const known = new Map((prevLive?.items || []).map((x) => [x.id, x]));
  live = listings.filter((x) => known.has(x.id)).map((x) => ({ ...known.get(x.id), ...x }));
  // no picks yet (no API key so far): fall back to simple organiser and title filters
  if (!live.length && CFG.liveFallback) {
    const F = CFG.liveFallback, inc = F.include && new RegExp(F.include, 'i'), exc = F.exclude && new RegExp(F.exclude, 'i'), must = new RegExp(F.titleMust, 'i');
    live = listings.filter((x) => must.test(x.title) && (!inc || inc.test(x.org)) && (!exc || !exc.test(x.org + ' ' + x.title)))
      .map((x) => ({ ...x, match: null, track: '' }))
      .sort((a, b) => String(a.ends).localeCompare(String(b.ends))).slice(0, CFG.liveMax);
  }
}

if (!UNSTOP_ONLY) {
  log('3. Re-checking entries');
  const B = CFG.batchSize || 12;
  const openByMatch = new Map(live.filter((x) => x.match).map((x) => [x.match, x]));
  for (let i = 0; i < entries.length; i += B) {
    const batch = entries.slice(i, i + B).map((e) => {
      const o = {}; [CFG.idKey, CFG.nameKey, ...CFG.contextKeys].forEach((k) => { if (e[k] !== undefined) o[k] = e[k]; });
      const u = openByMatch.get(String(e[CFG.idKey])); if (u) o.unstop_open_now = { title: u.title, ends: u.ends, url: u.url };
      return o;
    });
    try {
      const r = await ask(SYSTEM, `Re-check these ${batch.length} entries for the ${CFG.season} season. For each one, search for its latest edition: has a new season been announced, did dates/months move, did it stop running, are the links still the official ones, did the prize change?

Editable fields and what they mean:
${JSON.stringify(CFG.fieldDocs, null, 1)}

Entries:
${JSON.stringify(batch, null, 1)}

Return {"patches":[{"id":"<entry id>","set":{"<field>":<new value>},"source":"<url you opened that proves it>","why":"<one short line>"}]}. Only entries that need a change. Empty list is a good answer.`);
      for (const p of r.patches || []) await applyPatch(p);
      log(`   ${Math.min(i + B, entries.length)}/${entries.length} checked, ${changes.length} changes so far`);
    } catch (e) { log(`   batch ${i / B + 1} failed: ${e.message}`); }
  }

  log('4. Looking for missing entries');
  try {
    const known = entries.map((e) => e[CFG.nameKey]).join('; ');
    const r = await ask(SYSTEM, `${CFG.addPrompt}

We already list: ${known}

Here is the shape of one entry:
${JSON.stringify(CFG.addTemplate, null, 1)}

Return {"additions":[{"entry":{...same shape...},"source":"<url you opened>"}]}. At most ${CFG.addMax}. Only ones that clearly ran in the last two seasons and fit this site. Empty list is fine.`);
    for (const a of (r.additions || []).slice(0, CFG.addMax)) {
      const e = a.entry || {};
      const name = String(e[CFG.nameKey] || '').trim();
      if (!name || !a.source || !(await alive(a.source))) { log(`   skip addition ${name}: no working source`); continue; }
      if (entries.some((x) => String(x[CFG.nameKey]).toLowerCase() === name.toLowerCase())) continue;
      // Build the entry ONLY from the template's own fields, each forced to the template's type. Nothing else gets in.
      const entry = { added: TODAY, isNew: true };
      for (const [k, tv] of Object.entries(CFG.addTemplate)) {
        const v = e[k];
        if (Array.isArray(tv)) entry[k] = Array.isArray(v) ? v.filter((x) => typeof x === 'string').map((x) => x.slice(0, 40)).slice(0, 10) : tv;
        else if (typeof tv === 'number') entry[k] = Number.isInteger(v) && v >= 1 && v <= 12 ? v : tv;
        else if (typeof tv === 'boolean') entry[k] = typeof v === 'boolean' ? v : tv;
        else if (tv && typeof tv === 'object') entry[k] = {};
        else entry[k] = typeof v === 'string' ? v.replace(/\s[—–]\s/g, ', ').slice(0, 400) : tv;
      }
      for (const k of ['logo', 'orgLogo']) if (k in entry) entry[k] = ''; // logos are local files only, added by hand
      for (const [k, rule] of Object.entries(CFG.fields)) if (rule === 'url') { const v = getAt(e, k); if (v && safeLink(v)) setAt(entry, k, v); else if (getAt(entry, k)) setAt(entry, k, ''); }
      if (CFG.idKey !== CFG.nameKey) entry[CFG.idKey] = String(e[CFG.idKey] || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
      if (byId.has(String(entry[CFG.idKey]))) continue;
      for (const [k, rule] of Object.entries(CFG.fields)) if (rule === 'url' && getAt(entry, k) && !(await alive(getAt(entry, k)))) setAt(entry, k, undefined);
      entries.push(entry); byId.set(String(entry[CFG.idKey]), entry);
      changes.push({ id: entry[CFG.idKey], name, field: '(new entry)', from: null, to: name, source: a.source });
    }
  } catch (e) { log(`   additions failed: ${e.message}`); }

  // entries flagged new more than 6 weeks ago lose the badge
  const cutoff = new Date(Date.now() - 42 * 864e5).toISOString().slice(0, 10);
  entries.forEach((e) => { if (e.isNew && e.added && e.added < cutoff) delete e.isNew; });
}

/* ---------- write ---------- */
log(`\n${changes.length} changes${changes.length ? ':' : ''}`);
changes.forEach((c) => log(`  ${c.name} · ${c.field}: ${JSON.stringify(c.from)} -> ${JSON.stringify(c.to)}\n    ${c.source}`));

if (CFG.checkedKey && !UNSTOP_ONLY) data[CFG.checkedKey] = TODAY;
writeWin(CFG.dataFile, CFG.dataVar, data, CFG.dataHeader);
writeWin(CFG.liveFile, 'LIVE', { updated: TODAY, source: 'unstop.com', items: live }, 'Open competitions on Unstop, refreshed by scripts/update.mjs. Titles, dates and links come straight from Unstop.');
if (!UNSTOP_ONLY) {
  prevLog.runs.unshift({ date: TODAY, changes, live: live.length });
  prevLog.runs = prevLog.runs.slice(0, 26);
  prevLog.last = TODAY;
  writeWin(CFG.logFile, 'UPDATES', prevLog, 'What the weekly updater changed, newest first.');
}
if (!UNSTOP_ONLY) {
  const cost = spend.input / 1e6 * 0.10 + spend.output / 1e6 * 0.50 + spend.searches * 0.01;
  log(`\nTokens: ${spend.input} in, ${spend.output} out, ${spend.searches} searches, about $${cost.toFixed(2)}`);
}
