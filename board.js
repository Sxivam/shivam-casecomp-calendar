/* The Fest Map v3: noticeboard of open Unstop comps (live.js) + "what changed" log (updates.js). */
(() => {
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const day = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  const left = (d) => Math.max(0, Math.ceil((new Date(d) - Date.now()) / 864e5));
  const L = window.LIVE, items = ((L && L.items) || []).filter((x) => !x.ends || new Date(x.ends) > new Date())
    .sort((a, b) => String(a.ends).localeCompare(String(b.ends)));
  const circle = '<svg viewBox="0 0 74 70" aria-hidden="true"><path d="M40 6 C 12 4, 3 26, 8 44 C 14 64, 52 68, 66 48 C 76 30, 62 6, 34 9"/></svg>';
  let all = false;
  function render() {
    const list = all ? items : items.slice(0, 8);
    $('#tickets').innerHTML = list.map((x, i) => {
      const n = left(x.ends);
      return `<a class="tkt" href="${esc(x.url)}" target="_blank" rel="noopener" style="--r:${[-2.2, 1.6, -1, 2.4, -1.8, 1][i % 6]}deg">
        <span class="tack"></span>
        <span class="tkt-days">${circle}<span><b>${n}</b><small>${n === 1 ? 'day' : 'days'}</small></span></span>
        <h4>${esc(x.title)}</h4>
        <span class="t-org">${esc(x.org)}</span>
        ${x.match ? `<span class="t-fest">on the map: ${esc(x.match)}</span>` : ''}
        <span class="t-foot"><span>closes ${day(x.ends)}</span><b>Register ↗</b></span></a>`;
    }).join('');
    $('#boardMore').hidden = items.length <= 8;
    $('#boardMore').textContent = all ? 'Show fewer' : `Show all ${items.length} pinned`;
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: .3 });
    document.querySelectorAll('.tkt').forEach((t) => io.observe(t));
  }
  if (items.length) {
    $('#board').hidden = false;
    $('#boardNote').textContent = `${items.length} open right now · board refreshed ${day(L.updated)}`;
    render();
    $('#boardMore').addEventListener('click', () => { all = !all; render(); });
  }

  // NEW badges on fest cards and the up-next rail
  const isNew = new Set(((window.FEST && window.FEST.events) || []).filter((e) => e.isNew).map((e) => e.n));
  const tagNew = () => document.querySelectorAll('.card h3, .nx h4').forEach((h) => { if (isNew.has(h.textContent.trim()) && !h.querySelector('.nx-new')) h.insertAdjacentHTML('beforeend', '<span class="nx-new">new</span>'); });
  tagNew(); new MutationObserver(tagNew).observe(document.body, { childList: true, subtree: true });

  // freshness stamp + changelog
  const U = window.UPDATES, last = U && U.runs && U.runs[0], st = $('#freshStamp');
  st.hidden = false;
  st.textContent = last ? `✓ re-checked ${day(last.date)} · ${last.changes.length} ${last.changes.length === 1 ? 'change' : 'changes'}` : 'auto-checks every Monday';
  const dlg = $('#logDlg');
  const lbl = { '(new entry)': 'Added to the map', m: 'Month', d: 'Usual timing', reg: 'Registrations open', last: 'Last edition', start: 'Next edition starts', status: 'Status', done: 'Finished this season', prize: 'Prize pool', sub: 'Flagship events', 'links.site': 'Official site', 'links.ig': 'Instagram', 'links.unstop': 'Unstop page' };
  st.addEventListener('click', () => {
    if (!last) return;
    $('#logB').innerHTML = U.runs.slice(0, 6).map((r) => `<h4>${day(r.date)} · ${r.changes.length} changes</h4>${r.changes.length ? '<ul>' + r.changes.map((c) => `<li><b>${esc(c.name)}</b>: ${esc(lbl[c.field] || c.field)} ${c.field === '(new entry)' ? '' : `${esc(c.from ?? 'none')} → `}${esc(c.to)} <a href="${esc(c.source)}" target="_blank" rel="noopener">source</a></li>`).join('') + '</ul>' : '<p>Nothing changed. Every fest still matched its sources.</p>'}`).join('');
    dlg.showModal();
  });
  document.addEventListener('click', (e) => { if (e.target.id === 'logX' || e.target === dlg) dlg.close(); });
})();
