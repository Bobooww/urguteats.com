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
