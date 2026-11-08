/* Wispr Gate kit
   Email gate + "claim Wispr Flow Pro for 3 months FREE", using the Flow Bar, dictation sounds and stickers
   from the Wispr Flow Creator Pack.

   Usage (end of <body>):
     <link rel="stylesheet" href="wispr/wispr-gate.css">
     <script>window.WISPR_GATE = { lock: "#library", ...see README };</script>
     <script src="wispr/wispr-gate.js" defer></script>

   Needs the kit's /api/unlock and /api/me functions on the same Vercel project.
*/
(function () {
  // Safe to run again (e.g. a React page that remounts): the previous instance cleans itself up first.
  if (window.WisprGate && window.WisprGate.destroy) window.WisprGate.destroy();
  const AC_ = new AbortController(), LSN = { signal: AC_.signal };
  const C = Object.assign({
    lock: null,                 // selector(s) locked until signup: the first match shows as a faded preview, any others are hidden
    gateAt: null,               // put the gate card after this element (defaults to the locked section)
    peek: null,                 // element inside the preview that should still show (e.g. "#grid"): preview runs to its top + peekExtra px
    peekExtra: 300,
    offerAt: null,              // put the "Plus: claim Wispr Flow Pro..." line after this element (optional)
    gateClaims: true,           // before signup, the page's own Wispr claim links (wisprflow.ai) go to the gate instead
    gateHref: null,             // on a page with no gate: where those clicks go instead, e.g. "/" (opens at its #wg-gate)
    title: "Unlock everything",
    lede: "Free. Drop your name and email to open the full list and claim Wispr Flow Pro for 3 months FREE.",
    perks: [],                  // ticks above the Wispr row, e.g. ["All 54 sources", "Notes on how to use each"]
    button: "Unlock for FREE",
    welcome: ["Unlimited access to everything here"],   // ticks in the pop-up, before the Wispr one
    note: "Speak your prompts and notes instead of typing them. It works in every app.",
    skip: "Explore",
    fine: "By continuing you're happy to get occasional resources from Shivam Meet. Unsubscribe anytime.",
    promo: "SHIVAMEETSWISPR",
    months: 3,
    sounds: true,
    base: (document.currentScript && document.currentScript.src.replace(/[^/]*$/, "")) || "wispr/",
  }, window.WISPR_GATE || {});

  const CLAIM = `https://wisprflow.ai/?promo_code=${encodeURIComponent(C.promo)}&months=${C.months}`;
  const PRO = `Wispr Flow Pro for ${C.months} months FREE`;
  const $ = (s, r = document) => r.querySelector(s);
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const A = f => C.base + f;

  // Wispr's fonts from the pack (Figtree UI, EB Garamond headline), via Google Fonts
  if (!document.querySelector("link[data-wg-fonts]")) {
    const l = el("link"); l.rel = "stylesheet"; l.dataset.wgFonts = "";
    l.href = "https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700&family=EB+Garamond:wght@500&display=swap";
    document.head.appendChild(l);
  }

  /* ---------- sound: the pack's dictation-start / dictation-stop, only after the visitor clicks ---------- */
  const SFX = { ctx: null, buf: {} };
  function sfxInit() {
    if (!C.sounds) return;
    if (SFX.ctx) { SFX.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    SFX.ctx = new AC();
    ["start", "stop"].forEach(n => fetch(A(`${n}.wav`)).then(r => r.arrayBuffer()).then(b => SFX.ctx.decodeAudioData(b)).then(d => SFX.buf[n] = d).catch(() => {}));
  }
  async function sfx(n) {
    for (let k = 0; k < 15 && SFX.ctx && !SFX.buf[n]; k++) await wait(40);
    const c = SFX.ctx, b = SFX.buf[n]; if (!c || !b) return;
    const s = c.createBufferSource(); s.buffer = b; s.connect(c.destination); s.start();
  }

  /* ---------- Flow Bar: idle dots -> talking bars -> settle ---------- */
  function flowBar(host, n) {
    host.innerHTML = "<i></i>".repeat(n);
    const bars = [...host.children], h = bars.map(() => 0), tgt = bars.map(() => 0);
    let mode = "idle", raf = 0, last = 0;
    const env = i => 0.55 + 0.45 * Math.sin(Math.PI * (i + .5) / n);
    function tick(t) {
      const max = host.clientHeight * (host.classList.contains("sm") ? .8 : .74), bw = bars[0].offsetWidth || 3;
      if (mode === "talk" && t - last > 95) { last = t; bars.forEach((_, i) => tgt[i] = Math.random() < .14 ? .12 : (.25 + .75 * Math.random()) * env(i)); }
      let moving = false;
      bars.forEach((b, i) => {
        const goal = mode === "talk" ? tgt[i] : 0;
        h[i] += (goal - h[i]) * (mode === "talk" ? .32 : .2);
        if (Math.abs(goal - h[i]) > .004) moving = true;
        b.style.height = Math.max(bw, bw + h[i] * (max - bw)) + "px";
      });
      raf = (mode === "talk" || moving) ? requestAnimationFrame(tick) : 0;
    }
    return {
      talk() { mode = "talk"; host.classList.add("live"); if (!raf) raf = requestAnimationFrame(tick); },
      idle() { mode = "idle"; host.classList.remove("live"); if (!raf) raf = requestAnimationFrame(tick); },
    };
  }

  /* ---------- build the pieces ---------- */
  const lockEls = C.lock ? [...document.querySelectorAll(C.lock)] : [];
  const lockEl = lockEls[0] || null;
  const gateAnchor = C.gateAt ? $(C.gateAt) : lockEl;

  if (C.offerAt && $(C.offerAt)) {
    const o = el("a", "wg-offer", `<img src="${A("logo-cream.svg")}" alt="Wispr Flow"><span>Plus: claim <b>${esc(PRO)}</b></span>`);
    o.href = gateAnchor ? "#wg-gate" : CLAIM; o.id = "wg-offer";
    if (!gateAnchor) { o.target = "_blank"; o.rel = "noopener"; }
    $(C.offerAt).insertAdjacentElement("afterend", o);
  }

  let gate = null;
  if (gateAnchor) {
    gate = el("section", "wg-gate"); gate.id = "wg-gate"; gate.hidden = true;
    gate.innerHTML = `<form class="wg-card" novalidate>
      <h2>${esc(C.title)}</h2>
      <p>${esc(C.lede)}</p>
      ${C.perks.map(p => `<div class="wg-perk">✓ ${esc(p)}</div>`).join("")}
      <div class="wg-wperk"><img src="${A("logo-cream.svg")}" alt="Wispr Flow"><span>Claim <b>${esc(PRO)}</b>. Speak your prompts instead of typing them.</span></div>
      <label for="wg-name">Name</label>
      <input id="wg-name" autocomplete="name" required maxlength="80" placeholder="Your name">
      <label for="wg-email">Email</label>
      <input id="wg-email" type="email" inputmode="email" autocomplete="email" required placeholder="you@college.edu">
      <input id="wg-website" class="wg-hp" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
      <button class="wg-btn" type="submit">${esc(C.button)}</button>
      <p class="wg-err" role="alert"></p>
      <p class="wg-fine">${esc(C.fine)}</p>
    </form>`;
    gateAnchor.insertAdjacentElement("afterend", gate);
  }

  const pop = el("div", "wg-pop", `<div class="wg-pcard" role="dialog" aria-modal="true" aria-labelledby="wg-say">
    <div class="wg-top"><img src="${A("logo-cream.svg")}" alt="Wispr Flow"><button class="wg-x" aria-label="Close">×</button></div>
    <div class="wg-stage"><div class="fbar"></div><img class="wg-psticker" src="${A("think-speak-done.webp")}" alt="" width="96"></div>
    <div class="wg-pill"><b></b><span>Listening…</span></div>
    <h2 class="wg-say" id="wg-say"></h2>
    <ul class="wg-list">${[...C.welcome, `Wispr Flow Pro for ${C.months} months, FREE`].map(t => `<li>${esc(t)}</li>`).join("")}</ul>
    <p class="wg-note">${esc(C.note)}</p>
    <a class="wg-cta" href="${CLAIM}" target="_blank" rel="noopener">Claim ${C.months} months of Wispr Flow Pro →</a>
    <div class="wg-code">Code <code>${esc(C.promo)}</code><button type="button">Copy</button></div>
    <button class="wg-skip" type="button">${esc(C.skip)}</button>
  </div>`);
  document.body.appendChild(pop);

  const dock = el("div", "wg-dock", `<a href="${CLAIM}" target="_blank" rel="noopener"><span class="fbar sm"></span><span>Your ${C.months} months of Pro</span><b>Claim free</b></a><button aria-label="Hide">×</button>`);
  document.body.appendChild(dock);

  const popBar = flowBar($(".fbar", pop), 19), dockBar = flowBar($(".fbar", dock), 7);

  /* ---------- states ---------- */
  let locked = false, pending = "";
  function sizePeek() {
    if (!lockEl || !C.peek || !locked) return;
    const t = $(C.peek); if (!t) return;
    lockEl.style.maxHeight = Math.round(t.getBoundingClientRect().top - lockEl.getBoundingClientRect().top + C.peekExtra) + "px";
  }
  addEventListener("resize", sizePeek, LSN);
  function setLocked(on) {
    locked = on;
    lockEls.forEach((e, i) => e.classList.toggle(i ? "wg-hidden" : "wg-locked", on));
    document.documentElement.classList.toggle("wg-is-locked", on); // lets the site hide its own copies of the code until signup
    if (lockEl) { if (on) requestAnimationFrame(sizePeek); else lockEl.style.maxHeight = ""; }
    if (gate) gate.hidden = !on;
    const o = $("#wg-offer");
    if (o && !on) Object.assign(o, { href: CLAIM, target: "_blank", rel: "noopener" });
  }

  let dockTimer = 0;
  function showDock() {
    try { if (sessionStorage.getItem("wg-dock") === "off") return; } catch {}
    dock.classList.add("in"); clearInterval(dockTimer);
    const pulse = () => { dockBar.talk(); setTimeout(() => dockBar.idle(), 1300); };
    setTimeout(pulse, 700); dockTimer = setInterval(pulse, 7000);
  }
  $("button", dock).onclick = () => { dock.classList.remove("in"); clearInterval(dockTimer); try { sessionStorage.setItem("wg-dock", "off"); } catch {} };

  let run = 0;
  async function celebrate(name) {
    const me = ++run, say = $(".wg-say", pop);
    say.innerHTML = `Hey ${esc(name.split(" ")[0])}, you're in.`.split(" ").map(w => `<span>${w}</span>`).join(" ");
    pop.querySelectorAll(".wg-list li,.wg-note,.wg-cta,.wg-code,.wg-psticker").forEach(e => e.classList.remove("on"));
    $(".wg-pill", pop).classList.remove("done"); $(".wg-pill span", pop).textContent = "Listening…";
    pop.classList.remove("out"); pop.classList.add("show");
    requestAnimationFrame(() => requestAnimationFrame(() => pop.classList.add("vis")));
    await wait(380); if (me !== run) return;
    popBar.talk();
    for (const s of say.querySelectorAll("span")) { await wait(210); s.classList.add("on"); }
    await wait(320); if (me !== run) return;
    popBar.idle(); sfx("stop");
    $(".wg-pill", pop).classList.add("done"); $(".wg-pill span", pop).textContent = "Transcribed by Wispr Flow";
    await wait(120); $(".wg-psticker", pop).classList.add("on");
    for (const li of pop.querySelectorAll(".wg-list li")) { await wait(230); li.classList.add("on"); }
    await wait(260); $(".wg-note", pop).classList.add("on");
    await wait(220); $(".wg-cta", pop).classList.add("on"); $(".wg-code", pop).classList.add("on");
  }
  function closePop() {
    if (!pop.classList.contains("show")) return;
    run++; popBar.idle(); pop.classList.add("out"); pop.classList.remove("vis");
    setTimeout(() => {
      pop.classList.remove("show", "out"); showDock();
      const t = pending && document.getElementById(pending); pending = "";
      if (t) t.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 320);
  }
  $(".wg-x", pop).onclick = closePop; $(".wg-skip", pop).onclick = closePop;
  pop.addEventListener("click", e => { if (e.target === pop) closePop(); });
  document.addEventListener("keydown", e => { if (e.key === "Escape") closePop(); }, LSN);
  $(".wg-code button", pop).onclick = function () {
    navigator.clipboard.writeText(C.promo).then(() => { this.textContent = "Copied ✓"; this.classList.add("ok"); setTimeout(() => { this.textContent = "Copy"; this.classList.remove("ok"); }, 1500); });
  };

  /* ---------- links into locked sections ---------- */
  function toGate() {
    $(".wg-card", gate).scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => $("#wg-name").focus({ preventScroll: true }), 500);
  }
  document.addEventListener("click", e => {
    const claim = C.gateClaims && locked && e.target.closest && e.target.closest('a[href*="wisprflow.ai"]');
    if (claim && !claim.closest(".wg-pop,.wg-dock,.wg-gate,.wg-offer") && (gate || C.gateHref)) {
      e.preventDefault(); e.stopPropagation();
      if (gate) toGate(); else location.href = C.gateHref + "#wg-gate";
      return;
    }
    const a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a || !locked || !gate) return;
    const id = a.getAttribute("href").slice(1); if (!id || id === "wg-gate") return;
    const t = document.getElementById(id);
    if (!t || !lockEls.some(l => l === t || l.contains(t))) return;
    e.preventDefault(); e.stopPropagation(); pending = id; toGate();
  }, { capture: true, signal: AC_.signal });

  /* ---------- submit ---------- */
  if (gate) $("form", gate).addEventListener("submit", async e => {
    e.preventDefault();
    const f = e.currentTarget, btn = $(".wg-btn", f), err = $(".wg-err", f);
    const name = $("#wg-name").value.trim(), email = $("#wg-email").value.trim();
    if (!name) { err.textContent = "Please add your name."; return; }
    if (!/^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(email)) { err.textContent = "That email doesn't look right."; return; }
    err.textContent = ""; btn.disabled = true;
    sfxInit(); sfx("start");
    btn.innerHTML = `<span class="fbar sm" aria-label="Unlocking"></span>`;
    const gb = flowBar($(".fbar", btn), 11); gb.talk();
    try {
      const [r] = await Promise.all([fetch("/api/unlock", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, email, website: $("#wg-website").value, source: (location.pathname + location.hash) + (document.referrer ? " via " + document.referrer : "") }) }), wait(700)]);
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "Something went wrong. Try again.");
      gb.idle(); setLocked(false);
      try { localStorage.setItem("wg-in", "1"); } catch {}
      (lockEl || document.body).scrollIntoView({ block: "start" });
      celebrate(d.name || name);
    } catch (x) {
      err.textContent = x.message; btn.disabled = false; btn.textContent = C.button;
    }
  });

  /* ---------- boot: ask the server whether this visitor already signed up ---------- */
  let known = false; try { known = localStorage.getItem("wg-in") === "1"; } catch {}
  if (!known) setLocked(true);
  fetch("/api/me", { credentials: "same-origin" }).then(r => r.json()).then(d => {
    if (AC_.dead) return;
    setLocked(!d.unlocked);
    if (d.unlocked) setTimeout(showDock, 900);
    else if (gate && location.hash === "#wg-gate") setTimeout(toGate, 400); // sent here from another page's claim link
    else try { localStorage.removeItem("wg-in"); } catch {}
  }).catch(() => { if (!AC_.dead) setLocked(false); }); // API unreachable: never hold the content hostage

  function destroy() {
    AC_.abort(); clearInterval(dockTimer); run++;
    AC_.dead = true;
    lockEls.forEach(e => { e.classList.remove("wg-locked", "wg-hidden"); e.style.maxHeight = ""; });
    document.documentElement.classList.remove("wg-is-locked");
    [pop, dock, gate, $("#wg-offer")].forEach(e => e && e.remove());
    if (window.WisprGate && window.WisprGate.destroy === destroy) delete window.WisprGate;
  }
  window.WisprGate = { celebrate, showDock, setLocked, destroy }; // handy for testing in the console
})();
