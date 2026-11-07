/* The Fest Map '26-27 · Shivam Meet. v4: modular, link-first.
   Modules: hero (+ year dial on desktop), Open now & next up (live.js + next fests), the calendar, handles, footer. */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const { events: EVENTS, handles: HANDLES, checked } = window.FEST;
  const LIVE = (window.LIVE && window.LIVE.items) || [];
  const SITE = 'https://shivam-casecomp-calendar.vercel.app';

  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const MONTH_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const CATS = [
    ['consulting', 'Consulting'], ['finance', 'Finance'], ['entrepreneurship', 'Entrepreneurship'], ['management', 'Management'],
    ['tech-mgmt', 'Tech-mgmt'], ['economics', 'Economics'], ['cultural', 'Cultural'], ['academic', 'Academic'],
  ];
  const CAT_LABEL = Object.fromEntries(CATS);

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // house rule: no em or en dashes in visible copy (the data sometimes has them)
  const clean = (s) => String(s == null ? '' : s).replace(/\s*—\s*/g, ', ').replace(/\s+–\s+/g, ' to ').replace(/–/g, '-').trim();
  const t = (s) => esc(clean(s));

  /* ---------- dates ---------- */
  const DAY = 864e5;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const TM = today.getMonth() + 1;
  const fmt = (d) => d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  const ymd = (d) => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const daysTo = (d) => Math.round((d - today) / DAY);

  EVENTS.forEach((ev) => {
    let d = ev.start ? new Date(ev.start + 'T00:00:00') : null;
    ev.exact = !!(d && d >= today);
    if (!ev.exact) {
      const y = ev.m > TM || (ev.m === TM && !ev.done) ? today.getFullYear() : today.getFullYear() + 1;
      d = new Date(y, ev.m - 1, 15);
      if (d < today) d = new Date(today.getTime() + 7 * DAY);
    }
    ev.next = d;
    ev.days = daysTo(d);
  });

  const liveOk = LIVE.filter((x) => !x.ends || new Date(x.ends) > new Date())
    .map((x) => ({ ...x, endDate: new Date(x.ends || Date.now() + 30 * DAY) }))
    .sort((a, b) => a.endDate - b.endDate);
  const liveFor = Object.fromEntries(liveOk.filter((x) => x.match).map((x) => [x.match, x]));

  /* ---------- reminders (Google Calendar, all-day) ---------- */
  const gcal = (title, date, link) => {
    const end = new Date(date.getTime() + DAY);
    const details = `${link ? link + '\n\n' : ''}From The Fest Map: ${SITE}`;
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${ymd(date)}/${ymd(end)}&details=${encodeURIComponent(details)}`;
  };
  // when registrations usually open, before the fest's next edition
  function regDate(ev) {
    const r = String(ev.reg || '');
    const mi = MONTH_FULL.findIndex((m) => new RegExp(`\\b(${m}|${m.slice(0, 3)})\\b`, 'i').test(r));
    let d;
    if (mi >= 0) {
      const day = /early/i.test(r) ? 3 : /mid/i.test(r) ? 14 : /late/i.test(r) ? 22 : 1;
      d = new Date(ev.next.getFullYear(), mi, day);
      if (d > ev.next) d = new Date(ev.next.getFullYear() - 1, mi, day);
    } else d = new Date(ev.next.getTime() - 60 * DAY);
    if (d <= today) d = new Date(Math.max(today.getTime() + DAY, ev.next.getTime() - 21 * DAY));
    return d;
  }

  /* ---------- links, status ---------- */
  const igUrl = (h) => (/^https?:/.test(h) ? h : `https://instagram.com/${String(h).replace(/^@/, '')}`);
  const findUrl = (n) => `https://unstop.com/competitions?searchTerm=${encodeURIComponent(n)}`;
  function primary(ev) {
    const L = ev.links || {}, lv = liveFor[ev.n];
    if (lv) return { href: lv.url, label: 'Register ↗', kind: 'live' };
    if (L.unstop) return { href: L.unstop, label: 'Unstop page ↗' };
    if (L.site || L.web) return { href: L.site || L.web, label: 'Official site ↗' };
    if (L.ig) return { href: igUrl(L.ig), label: 'Instagram ↗' };
    return { href: findUrl(ev.n), label: 'Find on Unstop ↗' };
  }
  function others(ev, used) {
    const L = ev.links || {}, out = [];
    if (L.unstop && L.unstop !== used) out.push([L.unstop, 'Unstop']);
    if ((L.site || L.web) && (L.site || L.web) !== used) out.push([L.site || L.web, 'Official site']);
    if (L.ig && igUrl(L.ig) !== used) out.push([igUrl(L.ig), 'Instagram']);
    return out;
  }
  const weeks = (n) => `~${Math.max(1, Math.round(n / 7))} wks`;
  function status(ev) {
    const lv = liveFor[ev.n];
    if (lv) return ['open', `Open now · closes ${fmt(lv.endDate)}`];
    if (ev.status) return ['off', clean(ev.status).replace(/^./, (c) => c.toUpperCase())];
    if (ev.done && ev.m === TM) return ['off', 'Done for this season'];
    if (ev.exact) return ev.days <= 45 ? ['soon', `Starts in ${ev.days} days`] : ['plain', `Starts ${fmt(ev.next)}`];
    if (ev.m === TM) return ['soon', 'This month'];
    if (ev.days <= 60) return ['soon', `In ${weeks(ev.days)}`];
    return ['plain', `Usually ${MONTHS[ev.m - 1]}`];
  }

  /* ---------- hero ---------- */
  $('#nFests').textContent = EVENTS.length;
  $('#todayLbl').textContent = fmt(today);
  $('#checkedOn').textContent = new Date(checked + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  requestAnimationFrame(() => $('.title').classList.add('in'));

  const counts = MONTHS.map((_, i) => EVENTS.filter((e) => e.m === i + 1 && !e.status).length);
  // year dial (desktop only, via CSS); a segment filters the calendar to that month
  (() => {
    const segs = $('#dialSegs'), lbls = $('#dialLabels'), R1 = 98, R2 = 148;
    const pt = (r, a) => [r * Math.cos(a), r * Math.sin(a)];
    const fill = (c) => (c >= 5 ? '#ff4d4d' : c >= 2 ? '#fff9c4' : '#e5e0d8');
    MONTHS.forEach((m, i) => {
      const a0 = (i / 12) * 2 * Math.PI - Math.PI / 2 + 0.02, a1 = ((i + 1) / 12) * 2 * Math.PI - Math.PI / 2 - 0.02;
      const [x0, y0] = pt(R2, a0), [x1, y1] = pt(R2, a1), [x2, y2] = pt(R1, a1), [x3, y3] = pt(R1, a0);
      const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      p.setAttribute('d', `M${x0} ${y0} A${R2} ${R2} 0 0 1 ${x1} ${y1} L${x2} ${y2} A${R1} ${R1} 0 0 0 ${x3} ${y3}Z`);
      p.setAttribute('class', 'seg'); p.setAttribute('fill', fill(counts[i]));
      p.style.transitionDelay = (0.3 + i * 0.05) + 's';
      p.innerHTML = `<title>${MONTH_FULL[i]}: ${counts[i]} fests</title>`;
      p.addEventListener('click', () => { setMonth(i + 1); $('#calendar').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' }); });
      segs.appendChild(p);
      const am = (a0 + a1) / 2, [lx, ly] = pt(123, am);
      lbls.insertAdjacentHTML('beforeend', `<text class="dlbl" x="${lx}" y="${ly - 5}">${m}</text><text class="dcount" x="${lx}" y="${ly + 11}">${counts[i]}</text>`);
    });
    const frac = (today.getMonth() + (today.getDate() - 1) / 31) / 12;
    requestAnimationFrame(() => {
      $('#dialWrap').classList.add('in');
      setTimeout(() => { $('#needle').style.transform = `rotate(${frac * 360}deg)`; }, reduce ? 0 : 500);
    });
  })();

  /* ---------- open now & next up ---------- */
  const circle = '<svg viewBox="0 0 74 70" aria-hidden="true"><path d="M40 6 C 12 4, 3 26, 8 44 C 14 64, 52 68, 66 48 C 76 30, 62 6, 34 9"/></svg>';
  const nextFests = EVENTS.filter((e) => !e.status && !(e.done && e.m === TM) && !liveFor[e.n] && e.days <= 120).sort((a, b) => a.days - b.days);
  const items = [
    ...liveOk.map((x) => ({ kind: 'live', date: x.endDate, x })),
    ...nextFests.map((ev) => ({ kind: 'fest', date: ev.next, ev })),
  ].sort((a, b) => a.date - b.date);
  const SHOW = 6;
  let showAll = false;
  function ticket(it, i) {
    const r = [-1.6, 1.2, -0.8, 1.8, -1.2, 0.8][i % 6];
    if (it.kind === 'live') {
      const x = it.x, n = Math.max(0, daysTo(x.endDate));
      return `<article class="tkt" style="--r:${r}deg"><span class="tack" aria-hidden="true"></span>
        <span class="tkt-days" aria-label="${n} days left">${circle}<span><b>${n}</b><small>${n === 1 ? 'day' : 'days'}</small></span></span>
        <p class="tkt-k">Registration closes ${fmt(x.endDate)}</p>
        <h3>${t(x.title)}</h3>
        <p class="tkt-org">${t(x.org)}${x.match ? ` · ${t(x.match)}` : ''}</p>
        <div class="acts"><a class="btn-go" href="${esc(x.url)}" target="_blank" rel="noopener">Register ↗</a>
        <a class="btn-ghost" href="${gcal(`Deadline: ${clean(x.title)}`, x.endDate, x.url)}" target="_blank" rel="noopener" aria-label="Add the ${t(x.title)} deadline to Google Calendar">Remind me</a></div></article>`;
    }
    const ev = it.ev, p = primary(ev), n = ev.days;
    const big = ev.m === TM && !ev.exact ? ['This', 'month'] : n < 60 ? [n, n === 1 ? 'day' : 'days'] : [weeks(n).replace(' wks', ''), 'wks'];
    return `<article class="tkt fest${ev.star ? ' star' : ''}" style="--r:${r}deg"><span class="tack" aria-hidden="true"></span>
      <span class="tkt-days" aria-label="Starts ${big.join(' ')}">${circle}<span><b>${big[0]}</b><small>${big[1]}</small></span></span>
      <p class="tkt-k">Fest${ev.exact ? ` starts ${fmt(ev.next)}` : `, usually ${MONTHS[ev.m - 1]}`}${ev.isNew ? ' <span class="new">new</span>' : ''}</p>
      <h3>${t(ev.n)}</h3>
      <p class="tkt-org">${t(ev.inst)}</p>
      <div class="acts"><a class="btn-go" href="${esc(p.href)}" target="_blank" rel="noopener">${p.label}</a>
      <a class="btn-ghost" href="${gcal(`Register: ${clean(ev.n)} (${clean(ev.inst)})`, regDate(ev), p.href)}" target="_blank" rel="noopener" aria-label="Add a reminder for ${t(ev.n)} to Google Calendar">Remind me</a></div></article>`;
  }
  function renderTickets() {
    const list = showAll ? items : items.slice(0, SHOW);
    $('#tickets').innerHTML = list.map(ticket).join('') || '<p class="empty">Nothing open right now. Check the calendar below.</p>';
    const more = $('#moreTickets');
    more.hidden = items.length <= SHOW;
    more.textContent = showAll ? 'Show fewer' : `Show all ${items.length}`;
    $$('.tkt').forEach((el, i) => setTimeout(() => el.classList.add('in'), reduce ? 0 : 80 + i * 60));
  }
  $('#moreTickets').addEventListener('click', () => { showAll = !showAll; renderTickets(); if (!showAll) $('#now').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' }); });
  renderTickets();

  /* ---------- calendar ---------- */
  const state = { month: 0, cat: 'all', q: '', all: false };
  const ORDER = Array.from({ length: 12 }, (_, i) => ((TM - 1 + i) % 12) + 1); // starts at this month
  $('#months').innerHTML = `<button class="mchip on" data-m="0" role="tab" aria-selected="true">All<small>${EVENTS.length}</small></button>` +
    ORDER.map((m) => `<button class="mchip${m === TM ? ' now' : ''}${counts[m - 1] ? '' : ' empty'}" data-m="${m}" role="tab" aria-selected="false">${MONTHS[m - 1]}<small>${counts[m - 1]}</small></button>`).join('');
  $('#months').addEventListener('click', (e) => { const b = e.target.closest('.mchip'); if (b) setMonth(+b.dataset.m); });
  function setMonth(m) {
    state.month = m; state.all = false;
    $$('.mchip').forEach((b) => { const on = +b.dataset.m === m; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
    const a = $(`.mchip[data-m="${m}"]`); if (a) a.scrollIntoView({ block: 'nearest', inline: 'center', behavior: reduce ? 'auto' : 'smooth' });
    render();
  }
  $('#tracks').innerHTML = `<button class="tchip on" data-c="all" aria-pressed="true">All tracks</button>` +
    CATS.map(([k, l]) => `<button class="tchip" data-c="${k}" aria-pressed="false">${l}</button>`).join('');
  $('#tracks').addEventListener('click', (e) => {
    const b = e.target.closest('.tchip'); if (!b) return;
    state.cat = b.dataset.c; state.all = false;
    $$('.tchip').forEach((x) => { const on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-pressed', on); });
    render();
  });
  $('#search').addEventListener('input', (e) => { state.q = e.target.value.trim().toLowerCase(); state.all = false; render(); });
  $('#clear').addEventListener('click', () => {
    $('#search').value = ''; state.q = ''; state.cat = 'all';
    $$('.tchip').forEach((x) => { const on = x.dataset.c === 'all'; x.classList.toggle('on', on); x.setAttribute('aria-pressed', on); });
    setMonth(0);
  });

  const hay = (ev) => `${ev.n} ${ev.inst} ${ev.it} ${ev.sub} ${ev.org} ${ev.prize || ''} ${ev.cats.map((c) => CAT_LABEL[c]).join(' ')} ${MONTH_FULL[ev.m - 1]}`.toLowerCase();
  function row(ev, i) {
    const [cls, txt] = status(ev), p = primary(ev), more = others(ev, p.href);
    const remind = gcal(liveFor[ev.n] ? `Deadline: ${clean(ev.n)}` : `Register: ${clean(ev.n)} (${clean(ev.inst)})`, liveFor[ev.n] ? liveFor[ev.n].endDate : regDate(ev), p.href);
    const id = `d${i}`;
    const dl = [
      ['Usual timing', ev.d], ['Registration usually opens', ev.reg], ['Last edition', ev.last], ['Prize pool', ev.prize],
      ['Flagship events', ev.sub], ['Organiser', ev.org], ['Tracks', ev.cats.map((c) => CAT_LABEL[c]).join(', ')],
    ].filter(([, v]) => v).map(([k, v]) => `<dt>${k}</dt><dd>${t(v)}</dd>`).join('');
    return `<article class="row${ev.star ? ' star' : ''}${cls === 'off' ? ' off' : ''}" style="--i:${Math.min(i, 12)}">
      <div class="r-main">
        <p class="r-top"><span class="st st-${cls}">${esc(txt)}</span>${ev.star ? '<span class="must">★ Must-do</span>' : ''}${ev.isNew ? '<span class="new">new</span>' : ''}</p>
        <h3>${t(ev.n)}</h3>
        <p class="r-meta">${t(ev.inst)} · ${t(ev.d)}</p>
      </div>
      <div class="acts">
        <a class="btn-go" href="${esc(p.href)}" target="_blank" rel="noopener">${p.label}</a>
        <a class="btn-ghost" href="${remind}" target="_blank" rel="noopener" aria-label="Add a reminder for ${t(ev.n)} to Google Calendar">Remind me</a>
        <button class="r-more" type="button" aria-expanded="false" aria-controls="${id}">Details</button>
      </div>
      <div class="r-details" id="${id}" hidden>
        <dl>${dl}</dl>
        ${more.length ? `<p class="r-links">${more.map(([u, l]) => `<a href="${esc(u)}" target="_blank" rel="noopener">${l} ↗</a>`).join('')}</p>` : ''}
      </div>
    </article>`;
  }
  const CAP = 12;
  function render() {
    const base = EVENTS.filter((ev) => (!state.month || ev.m === state.month) && (state.cat === 'all' || ev.cats.includes(state.cat)));
    const toks = state.q.split(/\s+/).filter(Boolean);
    let f = toks.length ? base.filter((ev) => { const h = hay(ev); return toks.every((k) => h.includes(k)); }) : base;
    let near = false;
    if (toks.length && !f.length) { // never empty: show the closest matches
      f = EVENTS.map((ev) => [ev, toks.filter((k) => hay(ev).includes(k)).length]).filter(([, s]) => s).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([ev]) => ev);
      near = f.length > 0;
    }
    f.sort((a, b) => (a.status ? 1 : 0) - (b.status ? 1 : 0) || a.days - b.days);
    const filtered = state.month || state.cat !== 'all' || state.q;
    $('#clear').hidden = !filtered;
    const where = [state.month ? MONTH_FULL[state.month - 1] : '', state.cat !== 'all' ? CAT_LABEL[state.cat] : ''].filter(Boolean).join(' · ');
    $('#count').textContent = near ? `No exact match for "${state.q}". Closest:` : `${f.length} ${f.length === 1 ? 'fest' : 'fests'}${where ? ` · ${where}` : ''} · soonest first`;
    const shown = state.all || state.month || f.length <= CAP + 3 ? f : f.slice(0, CAP);
    let html = '', lastM = null;
    shown.forEach((ev, i) => {
      if (!state.month && !near && ev.m !== lastM) {
        lastM = ev.m;
        html += `<h3 class="mhead">${MONTH_FULL[ev.m - 1]}${ev.m === TM ? ' <span>this month</span>' : ''}</h3>`;
      }
      html += row(ev, i);
    });
    if (!f.length) html = `<div class="empty">Nothing matches. <button class="link-btn" type="button" data-clear>Clear filters</button></div>`;
    if (shown.length < f.length) html += `<button class="btn-sm more" type="button" data-all>Show all ${f.length} fests</button>`;
    $('#rows').innerHTML = html;
  }
  $('#rows').addEventListener('click', (e) => {
    const m = e.target.closest('.r-more');
    if (m) { const d = $('#' + m.getAttribute('aria-controls')); const open = m.getAttribute('aria-expanded') === 'true'; m.setAttribute('aria-expanded', !open); m.textContent = open ? 'Details' : 'Hide'; d.hidden = open; return; }
    if (e.target.closest('[data-all]')) { state.all = true; render(); return; }
    if (e.target.closest('[data-clear]')) $('#clear').click();
  });
  render();

  /* ---------- handles ---------- */
  $('#nHandles').textContent = HANDLES.length;
  $('#handleRow').innerHTML = HANDLES.map((h) => { const u = String(h).replace(/^@/, ''); return `<a class="handle" href="${igUrl(u)}" target="_blank" rel="noopener">@${esc(u)}</a>`; }).join('');

  /* ---------- what changed (updates.js) ---------- */
  const U = window.UPDATES, dlg = $('#logDlg');
  const LBL = { '(new entry)': 'Added to the map', m: 'Month', d: 'Usual timing', reg: 'Registrations open', last: 'Last edition', start: 'Next edition starts', status: 'Status', done: 'Finished this season', prize: 'Prize pool', sub: 'Flagship events', 'links.site': 'Official site', 'links.ig': 'Instagram', 'links.unstop': 'Unstop page' };
  const runs = (U && U.runs) || [];
  if (!runs.length) $('#logBtn').hidden = true;
  $('#logBtn').addEventListener('click', () => {
    $('#logB').innerHTML = runs.slice(0, 6).map((r) => `<h4>${fmt(new Date(r.date + 'T00:00:00'))} · ${r.changes.length} ${r.changes.length === 1 ? 'change' : 'changes'}</h4>${r.changes.length
      ? '<ul>' + r.changes.map((c) => `<li><b>${t(c.name)}</b>: ${esc(LBL[c.field] || c.field)} ${c.field === '(new entry)' ? '' : `${t(c.from ?? 'none')} → `}${t(c.to)} <a href="${esc(c.source)}" target="_blank" rel="noopener">source</a></li>`).join('') + '</ul>'
      : '<p>Nothing changed. Every fest still matched its sources.</p>'}`).join('');
    dlg.showModal();
  });
  document.addEventListener('click', (e) => { if (e.target.id === 'logX' || e.target === dlg) dlg.close(); });
})();
