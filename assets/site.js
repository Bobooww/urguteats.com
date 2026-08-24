/* URGUT TABLE · shared behaviour: open-now status, motion, video governance. */
(function () {
  "use strict";

  var reduceMotion =
    window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
    /[?&]nomotion/.test(window.location.search);

  /* ---------- open-now status (America/New_York) ---------- */

  function nyMinutes() {
    var parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      hour: "numeric",
      minute: "numeric",
      hourCycle: "h23"
    }).formatToParts(new Date());
    var h = 0, m = 0;
    parts.forEach(function (p) {
      if (p.type === "hour") h = Number(p.value);
      if (p.type === "minute") m = Number(p.value);
    });
    return h * 60 + m;
  }

  function refreshStatuses() {
    var now = nyMinutes();
    document.querySelectorAll("[data-open][data-close]").forEach(function (el) {
      var open = Number(el.getAttribute("data-open"));
      var close = Number(el.getAttribute("data-close"));
      var until = el.getAttribute("data-until") || "";
      var from = el.getAttribute("data-from") || "";
      var isOpen = now >= open && now < close;
      el.classList.toggle("open", isOpen);
      var label = el.querySelector("span");
      if (label) {
        label.textContent = isOpen
          ? "Open now · until " + until
          : "Closed now · opens " + from;
      }
    });
  }
  refreshStatuses();
  setInterval(refreshStatuses, 60000);

  /* ---------- ambient video governance ---------- */

  var videos = Array.prototype.slice.call(document.querySelectorAll("video[data-ambient]"));
  if (reduceMotion) {
    videos.forEach(function (v) {
      v.removeAttribute("autoplay");
      v.pause();
    });
  } else if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var v = entry.target;
        if (entry.isIntersecting) {
          var p = v.play();
          if (p && p.catch) p.catch(function () {});
        } else {
          v.pause();
        }
      });
    }, { threshold: 0.2 });
    videos.forEach(function (v) { io.observe(v); });
  }

  /* ---------- location gate ---------- */

  var LOC_KEY = "ut-location";
  var LOCATIONS = {
    "afsona": { name: "Afsona", tel: "+17186333006", phone: "(718) 633-3006" },
    "osh-markazi": { name: "Osh Markazi", tel: "+17185214343", phone: "(718) 521-4343" },
    "sariq-bola": { name: "Sariq Bola", tel: "+13476683199", phone: "(347) 668-3199" }
  };
  var gate = document.getElementById("gate");
  var headCta = document.getElementById("headCta");
  var headChip = document.getElementById("headChip");
  var lastFocus = null;

  function chosen() {
    try { return localStorage.getItem(LOC_KEY); } catch (e) { return null; }
  }
  function personalize() {
    var id = chosen();
    var loc = id && LOCATIONS[id];
    if (!headCta) return;
    if (loc) {
      headCta.textContent = "Call " + loc.name;
      headCta.setAttribute("href", "tel:" + loc.tel);
      if (headChip) {
        headChip.classList.add("on");
        var label = headChip.querySelector("span");
        if (label) label.textContent = loc.name;
      }
    } else {
      headCta.textContent = "Choose a location";
      headCta.setAttribute("href", "#locations");
      if (headChip) headChip.classList.remove("on");
    }
  }
  function openGate() {
    if (!gate) return;
    lastFocus = document.activeElement;
    gate.hidden = false;
    gate.classList.remove("closing");
    refreshStatuses();
    var first = gate.querySelector(".gate-card");
    if (first) first.focus();
    document.body.style.overflow = "hidden";
  }
  function closeGate() {
    if (!gate || gate.hidden) return;
    gate.classList.add("closing");
    document.body.style.overflow = "";
    setTimeout(function () {
      gate.hidden = true;
      gate.classList.remove("closing");
    }, 460);
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  function chooseLocation(id, card) {
    try { localStorage.setItem(LOC_KEY, id); } catch (e) {}
    personalize();
    if (card) card.classList.add("chosen");
    setTimeout(function () {
      closeGate();
      var row = document.getElementById("loc-" + id);
      if (row) {
        row.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
        row.classList.remove("flash");
        void row.offsetWidth;
        row.classList.add("flash");
      }
    }, reduceMotion ? 0 : 520);
  }

  if (gate) {
    gate.addEventListener("click", function (e) {
      var card = e.target.closest(".gate-card");
      if (card) { chooseLocation(card.getAttribute("data-loc"), card); return; }
      if (e.target.closest(".gate__skip") || e.target === gate) closeGate();
    });
    gate.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { closeGate(); return; }
      if (e.key === "Tab") {
        var items = gate.querySelectorAll("button, [href]");
        var first = items[0], last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
    document.querySelectorAll("[data-open-gate]").forEach(function (el) {
      el.addEventListener("click", function (e) {
        e.preventDefault();
        openGate();
      });
    });
    if (!chosen()) {
      var seen = null;
      try { seen = sessionStorage.getItem("ut-gate-seen"); } catch (e) {}
      if (!seen) {
        try { sessionStorage.setItem("ut-gate-seen", "1"); } catch (e) {}
        openGate();
      }
    }
  }
  personalize();

  /* ---------- lightbox for the food grid ---------- */

  var lightbox = document.getElementById("lightbox");
  var cells = Array.prototype.slice.call(document.querySelectorAll(".bento__cell"));
  var lbIndex = 0;

  function lbRender() {
    var cell = cells[lbIndex];
    if (!cell || !lightbox) return;
    var media = cell.querySelector("img, video");
    var caption = cell.querySelector("figcaption");
    var fig = lightbox.querySelector("figure");
    var slot = fig.querySelector(".lightbox__media");
    slot.innerHTML = "";
    var clone = media.cloneNode(true);
    clone.removeAttribute("loading");
    if (clone.tagName === "VIDEO") {
      clone.muted = true;
      clone.loop = true;
      clone.autoplay = true;
      clone.setAttribute("playsinline", "");
    }
    slot.appendChild(clone);
    fig.querySelector("figcaption").textContent = caption ? caption.textContent : "";
    if (clone.tagName === "VIDEO" && !reduceMotion) {
      var p = clone.play();
      if (p && p.catch) p.catch(function () {});
    }
  }
  function lbOpen(i) {
    if (!lightbox) return;
    lbIndex = i;
    lastFocus = document.activeElement;
    lightbox.hidden = false;
    document.body.style.overflow = "hidden";
    lbRender();
    lightbox.querySelector(".lightbox__btn--close").focus();
  }
  function lbClose() {
    if (!lightbox) return;
    lightbox.hidden = true;
    document.body.style.overflow = "";
    lightbox.querySelector(".lightbox__media").innerHTML = "";
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  function lbStep(d) {
    lbIndex = (lbIndex + d + cells.length) % cells.length;
    lbRender();
  }

  if (lightbox && cells.length) {
    cells.forEach(function (cell, i) {
      cell.setAttribute("tabindex", "0");
      cell.setAttribute("role", "button");
      var cap = cell.querySelector("figcaption");
      cell.setAttribute("aria-label", "View larger: " + (cap ? cap.textContent : "photo"));
      cell.addEventListener("click", function () { lbOpen(i); });
      cell.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); lbOpen(i); }
      });
    });
    lightbox.addEventListener("click", function (e) {
      if (e.target.closest(".lightbox__btn--close") || e.target === lightbox) lbClose();
      if (e.target.closest(".lightbox__btn--prev")) lbStep(-1);
      if (e.target.closest(".lightbox__btn--next")) lbStep(1);
    });
    lightbox.addEventListener("keydown", function (e) {
      if (e.key === "Escape") lbClose();
      if (e.key === "ArrowLeft") lbStep(-1);
      if (e.key === "ArrowRight") lbStep(1);
      if (e.key === "Tab") {
        var btns = lightbox.querySelectorAll(".lightbox__btn");
        var first = btns[0], last = btns[btns.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
  }

  /* ---------- header state ---------- */

  var head = document.querySelector(".site-head");

  /* ---------- motion (GSAP is optional; page reads fine without it) ---------- */

  if (reduceMotion || typeof gsap === "undefined") {
    if (head) head.classList.add("scrolled");
    return;
  }

  gsap.registerPlugin(ScrollTrigger);

  if (head) {
    ScrollTrigger.create({
      start: 40,
      onUpdate: function (self) {
        head.classList.toggle("scrolled", self.scroll() > 40);
      }
    });
    head.classList.toggle("scrolled", window.scrollY > 40);
  }

  /* Hero entrance: hierarchy, headline first, then support, then visual. */
  var heroCopy = document.querySelector("[data-hero-copy]");
  var heroFrame = document.querySelector("[data-hero-frame]");
  if (heroCopy) {
    var tl = gsap.timeline({ defaults: { ease: "power3.out" } });
    tl.from(heroCopy.children, {
      y: 34,
      opacity: 0,
      duration: 0.9,
      stagger: 0.12
    });
    if (heroFrame) {
      tl.from(heroFrame, { opacity: 0, scale: 1.04, duration: 1.1 }, 0.25);
    }
  }

  /* Scroll reveals: sections announce themselves once. */
  gsap.utils.toArray("[data-reveal]").forEach(function (el) {
    gsap.from(el, {
      y: 36,
      opacity: 0,
      duration: 0.9,
      ease: "power3.out",
      scrollTrigger: { trigger: el, start: "top 84%", once: true }
    });
  });

  gsap.utils.toArray("[data-reveal-group]").forEach(function (group) {
    gsap.from(group.children, {
      y: 30,
      opacity: 0,
      duration: 0.75,
      ease: "power3.out",
      stagger: 0.09,
      scrollTrigger: { trigger: group, start: "top 82%", once: true }
    });
  });

  /* Scrollspy: light the nav item for the section in view. */
  var navLinks = Array.prototype.slice.call(document.querySelectorAll(".site-head nav a[href^='#']"));
  navLinks.forEach(function (link) {
    var target = document.querySelector(link.getAttribute("href"));
    if (!target) return;
    ScrollTrigger.create({
      trigger: target,
      start: "top 45%",
      end: "bottom 45%",
      onToggle: function (self) { link.classList.toggle("active", self.isActive); }
    });
  });

  /* Heritage parallax: the Registan drifts slower than the page. */
  var heritageBg = document.querySelector(".heritage__bg");
  if (heritageBg) {
    gsap.fromTo(heritageBg, { yPercent: -8 }, {
      yPercent: 8,
      ease: "none",
      scrollTrigger: {
        trigger: ".heritage",
        start: "top bottom",
        end: "bottom top",
        scrub: true
      }
    });
  }
})();
