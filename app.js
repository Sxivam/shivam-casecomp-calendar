/* The Fest Map '26-27 · Shivam Meet */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const { events: EVENTS, handles: HANDLES, checked } = window.FEST;

  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const MONTH_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const CATS = [
    { k: 'consulting', l: 'Consulting' }, { k: 'entrepreneurship', l: 'Entrepreneurship' }, { k: 'finance', l: 'Finance' },
    { k: 'tech-mgmt', l: 'Tech-Mgmt' }, { k: 'management', l: 'Management' }, { k: 'economics', l: 'Economics' },
    { k: 'cultural', l: 'Cultural' }, { k: 'academic', l: 'Academic' },
  ];
  const INSTS = ['IIM', 'IIT', 'DU', 'Other'];

  /* ---------- dates ---------- */
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const TM = today.getMonth() + 1;
  const DAY = 864e5;
  const chk = new Date(checked + 'T00:00:00');
  $('#checkedOn').textContent = chk.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
  $$('.checkedOn2').forEach((e) => { e.textContent = chk.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); });
  $('#todayLbl').textContent = today.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

  // next occurrence: exact start date if published, else the middle of the usual month
  EVENTS.forEach((ev) => {
    let d = ev.start ? new Date(ev.start + 'T00:00:00') : null;
    ev.exact = !!(d && d >= today);
    if (!ev.exact) {
      const y = ev.m > TM || (ev.m === TM && !ev.done) ? today.getFullYear() : today.getFullYear() + 1;
      d = new Date(y, ev.m - 1, 15);
      if (d < today) d = new Date(today.getTime() + 7 * DAY); // happening this month
    }
    ev.next = d;
    ev.days = Math.round((d - today) / DAY);
  });
  const when = (ev) => {
    const n = ev.days;
    if (!ev.exact && ev.m === TM && !ev.done) return ['This', 'month'];
    if (n <= 0) return ['Now', 'happening'];
    if (n < 14) return [n, n === 1 ? 'day to go' : 'days to go'];
    if (n < 70) return [(ev.exact ? '' : '~') + Math.round(n / 7), 'weeks to go'];
    return ['~' + Math.round(n / 30), 'months to go'];
  };

  /* ---------- reveal ---------- */
  const io = new IntersectionObserver((ents) => ents.forEach((e) => {
    if (!e.isIntersecting) return;
    e.target.classList.add('in'); io.unobserve(e.target);
    e.target.dispatchEvent(new CustomEvent('reveal'));
  }), { threshold: .2 });
  const watch = (el) => io.observe(el);
  $$('.rv').forEach(watch);

  /* ---------- hero title ---------- */
  $$('#heroTitle .w').forEach((w, i) => { w.style.transitionDelay = (0.15 + i * 0.07) + 's'; });
  requestAnimationFrame(() => $('#heroTitle').classList.add('in'));

  /* ---------- counts per month ---------- */
  const counts = MONTHS.map((_, i) => EVENTS.filter((e) => e.m === i + 1 && !e.status).length);
  const max = Math.max(...counts);
  const heat = (c) => (c >= 5 ? 'hot' : c >= 2 ? 'warm' : 'cold');
  const HEAT_FILL = { hot: '#ff4d4d', warm: '#fff9c4', cold: '#e5e0d8' };

  /* ---------- year dial ---------- */
  const segs = $('#dialSegs'), lbls = $('#dialLabels');
  const R1 = 98, R2 = 148;
  const pt = (r, a) => [r * Math.cos(a), r * Math.sin(a)];
  MONTHS.forEach((m, i) => {
    const a0 = (i / 12) * 2 * Math.PI - Math.PI / 2 + 0.02, a1 = ((i + 1) / 12) * 2 * Math.PI - Math.PI / 2 - 0.02;
    const [x0, y0] = pt(R2, a0), [x1, y1] = pt(R2, a1), [x2, y2] = pt(R1, a1), [x3, y3] = pt(R1, a0);
    const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.setAttribute('d', `M${x0} ${y0} A${R2} ${R2} 0 0 1 ${x1} ${y1} L${x2} ${y2} A${R1} ${R1} 0 0 0 ${x3} ${y3}Z`);
    p.setAttribute('class', 'seg'); p.setAttribute('fill', HEAT_FILL[heat(counts[i])]);
    p.style.transitionDelay = (0.4 + i * 0.06) + 's';
    p.innerHTML = `<title>${MONTH_FULL[i]}: ${counts[i]} fests</title>`;
    p.addEventListener('click', () => { setMonth(i + 1); $('#calendar').scrollIntoView({ behavior: 'smooth' }); });
    segs.appendChild(p);
    const am = (a0 + a1) / 2, [lx, ly] = pt(123, am);
    lbls.insertAdjacentHTML('beforeend', `<text class="dlbl" x="${lx}" y="${ly - 5}">${m}</text><text class="dcount" x="${lx}" y="${ly + 11}">${counts[i]}</text>`);
  });
  const needle = $('#needle');
  const dial = $('#dialWrap');
  const frac = (today.getMonth() + (today.getDate() - 1) / 31) / 12;
  dial.addEventListener('reveal', () => {
    setTimeout(() => { needle.style.transform = `rotate(${frac * 360}deg)`; }, reduce ? 0 : 500);
  });
  watch(dial);

  /* ---------- next big one + up-next rail ---------- */
  const upcoming = EVENTS.filter((e) => !e.status && e.cats.some((c) => c !== 'academic')).sort((a, b) => a.days - b.days);
  const big = upcoming.find((e) => e.star) || upcoming[0];
  $('#nnName').textContent = big.n;
  $('#nnInst').textContent = big.inst;
  const bw = when(big); $('#nnCd').textContent = `${bw[0]} ${bw[1]}`;

  const rail = $('#nextRail');
  rail.innerHTML = upcoming.slice(0, 8).map((ev, i) => {
    const [v, u] = when(ev);
    const pct = Math.max(4, Math.min(100, 100 - (ev.days / 180) * 100));
    const cls = ev.days <= 60 ? 'hot' : ev.days <= 100 ? 'warm' : '';
    const alert = ev.days <= 60 ? 'Alert window is open. Watch Unstop now.' : `Start watching in ~${Math.max(1, Math.round((ev.days - 60) / 7))} weeks.`;
    return `<a class="nx${ev.star ? ' star' : ''}" href="#calendar" data-n="${ev.n}" style="--r:${[-1.2, .8, -.5, 1.2][i % 4]}deg">
      <div class="nx-when">${v}<small>${u}</small></div>
      <h4>${ev.n}</h4><div class="nx-i">${ev.inst}</div>
      <div class="nx-d">📅 ${ev.d}</div>
      <div class="meter"><i class="${cls}" data-w="${pct}"></i></div>
      <div class="alert">${alert}</div></a>`;
  }).join('');
  $$('.nx', rail).forEach((el, i) => {
    el.addEventListener('reveal', () => setTimeout(() => {
      el.classList.add('in'); const bar = $('.meter i', el); bar.style.width = bar.dataset.w + '%';
    }, reduce ? 0 : i * 90));
    watch(el);
    el.addEventListener('click', (e) => { e.preventDefault(); state.q = el.dataset.n.toLowerCase(); $('#search').value = el.dataset.n; setMonth(0); $('#calendar').scrollIntoView({ behavior: 'smooth' }); });
  });

  /* ---------- seismograph ---------- */
  const bars = $('#bars');
  bars.innerHTML = counts.map((c, i) => `<div class="bar ${heat(c)}" data-m="${i + 1}" title="${MONTH_FULL[i]}: ${c} fests" style="--h:${(c / max) * 88}%"><b>${c}</b><i></i></div>`).join('');
  bars.insertAdjacentHTML('afterend', `<div class="bar-lbls">${MONTHS.map((m, i) => `<span class="${i + 1 === TM ? 'now' : ''}">${m}</span>`).join('')}</div>`);
  $('#seismo').addEventListener('reveal', () => $$('.bar', bars).forEach((b, i) => setTimeout(() => { $('i', b).style.height = getComputedStyle(b).getPropertyValue('--h'); }, reduce ? 0 : i * 70)));
  $$('.bar', bars).forEach((b) => b.addEventListener('click', () => { setMonth(+b.dataset.m); $('#calendar').scrollIntoView({ behavior: 'smooth' }); }));

  /* ---------- calendar ---------- */
  const state = { month: 0, cat: 'all', inst: 'all', q: '' };
  const railEl = $('#monthRail');
  railEl.innerHTML = `<button class="mr active" data-m="0">All<small>${EVENTS.length} fests</small></button>` +
    MONTHS.map((m, i) => `<button class="mr${i + 1 === TM ? ' now' : ''}" data-m="${i + 1}">${m}<small>${counts[i]} fests</small></button>`).join('');
  railEl.addEventListener('click', (e) => { const b = e.target.closest('.mr'); if (b) setMonth(+b.dataset.m); });
  function setMonth(m) {
    state.month = m;
    $$('.mr', railEl).forEach((b) => b.classList.toggle('active', +b.dataset.m === m));
    $$('.seg', segs).forEach((s, i) => s.classList.toggle('on', i + 1 === m));
    const act = $(`.mr[data-m="${m}"]`, railEl); act && act.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
    render();
  }

  const catChips = $('#cat-chips'), instChips = $('#inst-chips');
  catChips.innerHTML = `<span class="chip active" data-c="all">All tracks</span>` + CATS.map((c) => `<span class="chip" data-c="${c.k}">${c.l}</span>`).join('');
  instChips.innerHTML = `<span class="chip active" data-i="all">All</span>` + INSTS.map((x) => `<span class="chip" data-i="${x}">${x}</span>`).join('');
  catChips.addEventListener('click', (e) => { const c = e.target.dataset.c; if (!c) return; state.cat = c; $$('.chip', catChips).forEach((x) => x.classList.remove('active', 'cat-active')); e.target.classList.add(c === 'all' ? 'active' : 'cat-active'); render(); });
  instChips.addEventListener('click', (e) => { const c = e.target.dataset.i; if (!c) return; state.inst = c; $$('.chip', instChips).forEach((x) => x.classList.remove('active')); e.target.classList.add('active'); render(); });
  $('#search').addEventListener('input', (e) => { state.q = e.target.value.toLowerCase().trim(); render(); });

  const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return 'site'; } };
  function linksHtml(ev) {
    const L = ev.links || {};
    const out = [];
    if (L.site) out.push(`<a class="lk" href="${L.site}" target="_blank" rel="noopener" title="Official site, checked ${checked}"><span class="ok">✓</span>${host(L.site)} ↗</a>`);
    if (L.ig) out.push(`<a class="lk ig" href="https://instagram.com/${L.ig}" target="_blank" rel="noopener">@${L.ig} ↗</a>`);
    if (L.unstop) out.push(`<a class="lk us" href="${L.unstop}" target="_blank" rel="noopener">Unstop ↗</a>`);
    return out.length ? `<div class="links">${out.join('')}</div>` : `<div class="links"><span class="no-links">No official page found for this season yet. Watch the host's Instagram.</span></div>`;
  }

  function render() {
    const f = EVENTS.filter((ev) => {
      if (state.month && ev.m !== state.month) return false;
      if (state.cat !== 'all' && !ev.cats.includes(state.cat)) return false;
      if (state.inst !== 'all' && ev.it !== state.inst) return false;
      if (state.q) {
        const hay = `${ev.n} ${ev.inst} ${ev.sub} ${ev.org} ${ev.prize || ''}`.toLowerCase();
        if (!hay.includes(state.q)) return false;
      }
      return true;
    }).sort((a, b) => (state.month ? 0 : a.days - b.days) || a.m - b.m);

    $('#noresults').style.display = f.length ? 'none' : 'block';
    let label = `Showing ${f.length} event${f.length !== 1 ? 's' : ''}`;
    if (state.month) label += ` in ${MONTH_FULL[state.month - 1]}`; else label += ', soonest first';
    if (state.inst !== 'all') label += ` · ${state.inst}`;
    if (state.cat !== 'all') label += ` · ${CATS.find((c) => c.k === state.cat).l}`;
    $('#count').textContent = label;

    $('#cards').innerHTML = f.map((ev, i) => {
      const tags = ev.cats.map((c) => `<span class="tag">${CATS.find((x) => x.k === c).l}</span>`).join('');
      const [v, u] = when(ev);
      const cd = ev.status ? ev.status : `${v} ${u.replace(' to go', '')}`.replace('This month', 'this month');
      return `<article class="card${ev.star ? ' star' : ''}" style="--i:${Math.min(i, 14)};--r:${[-.6, .5, -.3, .7][i % 4]}deg">
        ${ev.star ? '<span class="star-badge">★ MUST-DO</span>' : ''}
        <div class="ev-month"><span>${MONTH_FULL[ev.m - 1]}</span><span class="cd">${cd}</span></div>
        <h3>${ev.n}</h3>
        <div class="inst">${ev.inst}</div>
        <div class="dates">📅 ${ev.d}${ev.last ? `<span class="last">Last edition: ${ev.last}</span>` : ''}</div>
        ${ev.prize ? `<span class="prize">💰 ${ev.prize}</span>` : ''}
        <div class="sub"><b>Watch:</b> ${ev.sub}</div>
        <div class="reg">Registration usually opens: <b>${ev.reg}</b></div>
        <div class="tags"><span class="tag itype">${ev.it}</span>${tags}</div>
        ${linksHtml(ev)}
      </article>`;
    }).join('');
  }
  render();

  /* ---------- routes ---------- */
  const ROUTES = {
    'Consulting aspirant': [['Venix (IIM-B)', 8], ['Ignite 180', 9], ['Red Brick (IIM-A)', 10], ['Advaita · ISB', 10], ['Ensemble (XLRI)', 11], ['Backwaters · Kotler Sutra', 1], ['SRCC Business Conclave', 2]],
    'Entrepreneurship / B-plan': [['Venix YES', 8], ['i5 Summit', 8], ['Atharv Ranbhoomi', 10], ['Eureka! IIT-B', 12], ['White Knight · Backwaters', 1], ['Empresario · GES', 2], ['Pitch Premier', 3]],
    'Finance / quant': [['Atharv finance', 10], ['Manfest-Varchasva', 2], ['Global Trading League', 2], ['Arbitrage · Vertex', 2], ['Beat the Market', 3]],
    'DU undergrad': [['Ignite 180 · KMC', 9], ['Econvista · LSR', 10], ['SRCC Business Conclave', 2], ['Arbitrage · Ramjas', 2], ['Delhi cluster', 3], ['Shri Ram Econ Summit', 4]],
  };
  const tabs = $('#routeTabs');
  tabs.innerHTML = Object.keys(ROUTES).map((k, i) => `<button class="rt${i ? '' : ' on'}" data-k="${k}">${k}</button>`).join('');
  // season order Aug -> Jul so routes read left to right
  const ORDER = [8, 9, 10, 11, 12, 1, 2, 3, 4, 5, 6, 7];
  $('#routeMonths').innerHTML = ORDER.map((m) => `<span>${MONTHS[m - 1]}</span>`).join('');
  const svg = $('#routeSvg'), stops = $('#routeStops'), list = $('#routeList');
  function drawRoute(k) {
    const pts = []; const seen = {};
    ROUTES[k].forEach(([name, m]) => {
      const col = ORDER.indexOf(m); seen[col] = (seen[col] || 0) + 1;
      const x = ((col + 0.5) / 12) * 1200 + (seen[col] - 1) * 46;
      const y = 200 - ((pts.length % 2) ? 120 : 40);
      pts.push({ name, x, y, lo: pts.length % 2 === 0 });
    });
    let d = `M${pts[0].x} ${pts[0].y}`;
    for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], b = pts[i], cx = (a.x + b.x) / 2; d += ` C${cx} ${a.y}, ${cx} ${b.y}, ${b.x} ${b.y}`; }
    svg.innerHTML = ORDER.map((_, i) => `<line class="grid-l" x1="${(i + .5) * 100}" y1="10" x2="${(i + .5) * 100}" y2="250"/>`).join('') +
      `<path class="path" d="${d}" pathLength="1000" style="stroke-dasharray:1000;stroke-dashoffset:1000"/>`;
    const path = $('.path', svg);
    requestAnimationFrame(() => {
      path.style.transition = reduce ? 'none' : 'stroke-dashoffset 1.6s cubic-bezier(.2,.8,.2,1)';
      path.style.strokeDashoffset = 0;
      path.addEventListener('transitionend', () => { path.style.strokeDasharray = '9 9'; }, { once: true });
    });
    stops.innerHTML = pts.map((p, i) => `<div class="stop${p.lo ? ' lo' : ''}${p.x < 150 ? ' edge-l' : p.x > 1050 ? ' edge-r' : ''}" style="left:${p.x / 12}%;top:${(p.y / 260) * 100}%;transition-delay:${reduce ? 0 : 0.2 + i * 0.2}s"><i>${i + 1}</i><span>${p.name}</span></div>`).join('');
    requestAnimationFrame(() => requestAnimationFrame(() => $$('.stop', stops).forEach((s) => s.classList.add('in'))));
    list.innerHTML = ROUTES[k].map(([n, m], i) => `<li style="--i:${i}"><span><b>${n}</b> · ${MONTHS[m - 1]}</span></li>`).join('');
  }
  tabs.addEventListener('click', (e) => { const b = e.target.closest('.rt'); if (!b) return; $$('.rt', tabs).forEach((t) => t.classList.toggle('on', t === b)); drawRoute(b.dataset.k); });
  const board = $('.route-board');
  board.addEventListener('reveal', () => drawRoute(Object.keys(ROUTES)[0]));

  /* ---------- handles ---------- */
  $('#handles').innerHTML = HANDLES.map((h) => `<a class="handle" href="https://instagram.com/${h.replace(/^@/, '')}" target="_blank" rel="noopener">@${h.replace(/^@/, '')}</a>`).join('');

  /* ---------- progress ---------- */
  const prog = $('#progress');
  addEventListener('scroll', () => { const h = document.documentElement.scrollHeight - innerHeight; prog.style.width = (h > 0 ? scrollY / h * 100 : 0) + '%'; }, { passive: true });
})();
