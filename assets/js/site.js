/* ==========================================================================
   VTM — Über uns
   Bewegungsschicht. Eine einzige Motion-Engine: GSAP mit ScrollTrigger.

   Module:
     1. Aufbau und Sicherheitsnetz (ohne GSAP ist alles sofort sichtbar)
     2. Lesefortschritt
     3. Hero: Austritt + Ansteuerung der 3D-Szene
     4. Reveal der Abschnitte (gestaffelt, gebatcht)
     5. Scrollspy für das Inhaltsverzeichnis
     6. Zähler der Reichweiten-Kennzahlen
     7. Lichtkegel auf Karten (nur bei präzisem Zeiger)
     8. Lazy-Start der Signalachse
     9. Newsletter-Formular

   Grundsätze:
   - Kein einziger scroll-Event-Listener. ScrollTrigger batcht selbst.
   - Animiert werden ausschließlich transform und opacity.
   - prefers-reduced-motion schaltet jede Bewegung ab, Inhalte bleiben.
   - Die Signalachse ist reine Zugabe: fällt sie aus, fehlt nichts Inhaltliches.
   ========================================================================== */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var prefersReduced = function () { return reduceMotion.matches; };
  var gsap = window.gsap;
  var ScrollTrigger = window.ScrollTrigger;
  var hasMotion = !!(gsap && ScrollTrigger) && !prefersReduced();

  var reveals = Array.prototype.slice.call(document.querySelectorAll('.reveal'));
  var pageProgress = 0;
  var activeSection = -1;

  function revealAll() {
    reveals.forEach(function (el) {
      el.style.opacity = '1';
      el.style.transform = 'none';
    });
  }

  /* ------------------------------------------------------------------------
     9. Newsletter-Formular (Funktionsdefinition, Aufruf am Ende)
     ---------------------------------------------------------------------- */
  function initForm() {
    var form = document.getElementById('newsletter-form');
    if (!form) return;

    var input = document.getElementById('vtm-newsletter-mail');
    var error = document.getElementById('vtm-newsletter-error');
    var status = document.getElementById('vtm-newsletter-status');
    var button = document.getElementById('newsletter-submit');
    var label = button.querySelector('.newsletter__submit-label');
    var endpoint = form.getAttribute('data-endpoint');
    var fallback = form.getAttribute('data-fallback');
    var defaultLabel = label.textContent;

    // Bewusst permissiv: die echte Prüfung macht der Double-Opt-in-Versand.
    var EMAIL = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;

    function showError(message) {
      error.textContent = message;
      error.classList.add('is-visible');
      input.setAttribute('aria-invalid', 'true');
    }
    function clearError() {
      error.textContent = '';
      error.classList.remove('is-visible');
      input.removeAttribute('aria-invalid');
    }
    function setLoading(on) {
      if (on) {
        button.setAttribute('data-state', 'loading');
        button.disabled = true;
        label.textContent = 'Wird gesendet …';
        var spinner = document.createElement('span');
        spinner.className = 'spinner';
        spinner.setAttribute('aria-hidden', 'true');
        button.insertBefore(spinner, label);
      } else {
        button.removeAttribute('data-state');
        button.disabled = false;
        label.textContent = defaultLabel;
        var old = button.querySelector('.spinner');
        if (old) old.remove();
      }
    }

    input.addEventListener('input', function () {
      if (input.getAttribute('aria-invalid') === 'true' && EMAIL.test(input.value.trim())) clearError();
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var email = input.value.trim();
      status.textContent = '';

      if (!email) { showError('Bitte geben Sie Ihre E-Mail-Adresse ein.'); input.focus(); return; }
      if (!EMAIL.test(email)) {
        showError('Diese E-Mail-Adresse sieht nicht vollständig aus, bitte prüfen Sie sie.');
        input.focus();
        return;
      }
      clearError();

      if (!endpoint) {
        if (fallback) window.location.href = fallback;
        return;
      }

      setLoading(true);
      var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      var timer = controller ? setTimeout(function () { controller.abort(); }, 12000) : null;

      fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email, emailType: 'subscribe', labels: [] }),
        signal: controller ? controller.signal : undefined
      })
        .then(function (res) {
          if (!res.ok) throw new Error('HTTP ' + res.status);
          setLoading(false);
          form.reset();
          status.textContent = 'Fast geschafft: Wir haben Ihnen einen Bestätigungslink geschickt.';
        })
        .catch(function () {
          setLoading(false);
          status.textContent = '';
          showError('Das hat gerade nicht geklappt. Bitte erneut versuchen oder direkt über das Anmeldeformular.');
          if (fallback && !document.getElementById('newsletter-fallback')) {
            var link = document.createElement('a');
            link.id = 'newsletter-fallback';
            link.className = 'link-arrow';
            link.href = fallback;
            link.rel = 'noopener';
            link.innerHTML = 'Zum Anmeldeformular <span aria-hidden="true">&rarr;</span>';
            form.appendChild(link);
          }
        })
        .finally(function () { if (timer) clearTimeout(timer); });
    });
  }

  function initYear() {
    var year = document.getElementById('year');
    if (year) year.textContent = new Date().getFullYear();
  }

  /* ------------------------------------------------------------------------
     1. Aufbau und Sicherheitsnetz
     ---------------------------------------------------------------------- */
  if (!hasMotion) {
    // Kein GSAP geladen oder Nutzer will keine Bewegung: alles zeigen,
    // Zähler auf Endwert lassen (die stehen bereits im HTML) und aussteigen.
    document.documentElement.classList.remove('pre-intro');
    revealAll();
    initForm();
    initYear();
    return;
  }

  gsap.registerPlugin(ScrollTrigger);
  gsap.defaults({ ease: 'power3.out', duration: 0.8 });

  // Reihenfolge ist hier kritisch: erst die Startwerte als Inline-Stil setzen,
  // dann den CSS-Vorzustand abnehmen, erst danach Tweens erzeugen. Andernfalls
  // erbt ein gescrubbter Tween die 0 aus .pre-intro als Startwert.
  gsap.set(reveals, { opacity: 0, y: 24 });
  document.documentElement.classList.remove('pre-intro');

  // Falls die Seite unsichtbar gerendert wird (Druck, Screenshot-Dienst),
  // sofort alles zeigen.
  window.addEventListener('beforeprint', revealAll);

  /* ------------------------------------------------------------------------
     2. Lesefortschritt
     ---------------------------------------------------------------------- */
  (function progress() {
    var bar = document.querySelector('.reading-progress__bar');
    if (!bar) return;
    gsap.fromTo(bar, { scaleX: 0 }, {
      scaleX: 1,
      ease: 'none',
      scrollTrigger: {
        trigger: document.documentElement,
        start: 'top top',
        end: 'bottom bottom',
        scrub: 0.25,
        // Derselbe Fortschritt zeichnet die Signalachse fort. Ein Wert, zwei
        // Anzeigen: der Balken oben und die Achse rechts erzaehlen dasselbe.
        onUpdate: function (self) {
          pageProgress = self.progress;
          if (scene) scene.setProgress(self.progress);
        }
      }
    });
  })();

  /* ------------------------------------------------------------------------
     3. Hero
     Der Austritt ist gescrubbt, nicht getriggert: der Nutzer steuert ihn.
     Derselbe Fortschritt fährt die Ordnung der 3D-Szene hoch, damit Text
     und Szene dieselbe Geste erzählen.
     ---------------------------------------------------------------------- */
  var scene = null;

  (function hero() {
    var heroEl = document.querySelector('.hero');
    var inner = document.getElementById('hero-inner');
    if (!heroEl) return;

    if (inner) gsap.set(inner, { opacity: 1, y: 0 });

    if (inner && window.matchMedia('(min-width: 900px)').matches) {
      gsap.to(inner, {
        y: 44,
        opacity: 0.22,
        ease: 'none',
        scrollTrigger: {
          trigger: heroEl,
          start: 'top top',
          end: '+=660',
          scrub: 0.4
        }
      });
    }

    // Einlauf: eine Geste, klar gestaffelt, nach rund 1,5 s ist Ruhe.
    var intro = gsap.timeline({ delay: 0.08 });
    intro.from('.hero .kicker', { y: 14, opacity: 0, duration: 0.42 })
      .from('.hero__title', { y: 26, opacity: 0, duration: 0.62 }, '-=0.30')
      .from('.hero__lead', { y: 18, opacity: 0, duration: 0.50 }, '-=0.44')
      .from('.hero__tags .tag', { y: 12, opacity: 0, duration: 0.36, stagger: 0.05 }, '-=0.34')
      .from('.hero__toc', { y: 16, opacity: 0, duration: 0.42 }, '-=0.26')
      .from('.principles', { y: 28, opacity: 0, duration: 0.62 }, '-=0.52')
      .from('.principles__list li', { x: -10, opacity: 0, duration: 0.36, stagger: 0.05 }, '-=0.40');

    // Zwangsvollendung. Wenn der Einlauf aus irgendeinem Grund haengt --
    // gedrosselter Tab, sehr langsames Geraet, ein Fehler weiter unten --
    // steht der Kopfbereich nach 4 s trotzdem vollstaendig da.
    setTimeout(function () {
      if (intro.progress() < 1) intro.progress(1);
    }, 4000);
  })();

  /* ------------------------------------------------------------------------
     4. Reveal der Abschnitte
     ---------------------------------------------------------------------- */
  (function revealSections() {
    if (!reveals.length) return;

    // Ein Trigger pro Element statt ScrollTrigger.batch: batch stützt sich auf
    // einen IntersectionObserver und lässt Elemente aus, über die hinweg
    // gesprungen wird (Deep-Link auf einen Anker, Reload mit wiederhergestellter
    // Scrollposition, Sprung aus dem Inhaltsverzeichnis).
    var pending = reveals.slice();
    var perParent = new Map();

    function show(el, delay) {
      var at = pending.indexOf(el);
      if (at === -1) return;
      pending.splice(at, 1);
      gsap.to(el, {
        opacity: 1,
        y: 0,
        duration: 0.78,
        delay: delay || 0,
        overwrite: true,
        clearProps: 'transform'
      });
    }

    reveals.forEach(function (el) {
      var parent = el.parentElement;
      var i = perParent.get(parent) || 0;
      perParent.set(parent, i + 1);
      var delay = Math.min(i, 5) * 0.07;
      ScrollTrigger.create({
        trigger: el,
        start: 'top 90%',
        once: true,
        onEnter: function () { show(el, delay); }
      });
    });

    // Sicherheitsnetz gegen Sprünge: alles, was den Auslösepunkt bereits
    // passiert hat, wird nachgezogen. Sobald nichts mehr aussteht, kostet die
    // Prüfung nichts, weil pending leer ist.
    // Sprünge (Deep-Link, Reload mit Scrollposition, programmatisches
    // scrollTo) lösen kein verlässliches Enter-Ereignis pro Element aus.
    // Deshalb hängt ein zweiter Trigger über dem gesamten Dokument, der bei
    // jedem Scroll-Update nachzieht, was seinen Auslösepunkt schon passiert
    // hat. Sobald nichts mehr aussteht, kostet die Prüfung nichts.
    function catchUp() {
      if (!pending.length) return;
      var vh = window.innerHeight || 0;
      pending.slice().forEach(function (el) {
        if (el.getBoundingClientRect().top < vh * 0.95) show(el, 0);
      });
    }
    ScrollTrigger.create({
      trigger: document.body,
      start: 'top top',
      end: 'bottom bottom',
      onUpdate: catchUp,
      onRefresh: catchUp
    });
    window.addEventListener('load', catchUp);
    catchUp();
  })();

  /* ------------------------------------------------------------------------
     5. Scrollspy
     ---------------------------------------------------------------------- */
  (function scrollspy() {
    var links = Array.prototype.slice.call(document.querySelectorAll('.toc__link'));
    if (!links.length) return;
    var current = null;

    function activate(link) {
      if (link === current) return;
      if (current) {
        current.classList.remove('is-current');
        current.removeAttribute('aria-current');
      }
      current = link;
      if (current) {
        current.classList.add('is-current');
        current.setAttribute('aria-current', 'true');
      }
    }

    links.forEach(function (link, i) {
      var section = document.getElementById(link.getAttribute('href').slice(1));
      if (!section) return;
      ScrollTrigger.create({
        trigger: section,
        start: 'top 34%',
        end: 'bottom 34%',
        onToggle: function (self) {
          if (!self.isActive) return;
          activate(link);
          activeSection = i;
          if (scene) scene.setActive(i);
        }
      });
    });
  })();

  /* ------------------------------------------------------------------------
     6. Zähler
     ---------------------------------------------------------------------- */
  (function counters() {
    var nodes = Array.prototype.slice.call(document.querySelectorAll('[data-count-to]'));
    if (!nodes.length) return;
    var fmt = new Intl.NumberFormat('de-DE');

    nodes.forEach(function (el) {
      var target = Number(el.getAttribute('data-count-to'));
      var suffix = el.getAttribute('data-count-suffix') || '';
      if (!target || !isFinite(target)) return;
      var proxy = { v: 0 };
      gsap.to(proxy, {
        v: target,
        duration: 1.5,
        ease: 'power4.out',
        scrollTrigger: { trigger: el, start: 'top 85%', once: true },
        onUpdate: function () {
          el.textContent = fmt.format(Math.round(proxy.v)) + suffix;
        },
        onComplete: function () {
          el.textContent = fmt.format(target) + suffix;
        }
      });
    });
  })();

  /* ------------------------------------------------------------------------
     7. Lichtkegel auf Karten
     Der Cursor verrät, welche Karte gerade gelesen wird. Nur bei präzisem
     Zeiger, ein rAF pro Bewegung, geschrieben werden nur CSS-Variablen.
     ---------------------------------------------------------------------- */
  (function spotlight() {
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    var cards = Array.prototype.slice.call(document.querySelectorAll('.card, .pillar, .principle'));
    if (!cards.length) return;

    cards.forEach(function (card) {
      var pending = null;
      card.addEventListener('pointermove', function (e) {
        if (pending) return;
        pending = requestAnimationFrame(function () {
          pending = null;
          var r = card.getBoundingClientRect();
          card.style.setProperty('--mx', ((e.clientX - r.left) / r.width * 100).toFixed(1) + '%');
          card.style.setProperty('--my', ((e.clientY - r.top) / r.height * 100).toFixed(1) + '%');
        });
      }, { passive: true });
      card.addEventListener('pointerleave', function () {
        card.style.removeProperty('--mx');
        card.style.removeProperty('--my');
      });
    });
  })();

  /* ------------------------------------------------------------------------
     8. WebGL-Szene, verzögert und mit Bedingungen
     Das Modul wiegt gebündelt rund 130 KB gzip. Es wird deshalb nur geladen,
     wenn es sich lohnt: kein Reduced-Motion, Viewport ab 820 px, kein
     Datensparmodus, kein 2G, mindestens 4 GB Gerätespeicher (sofern der
     Browser das verrät), WebGL vorhanden.
     ---------------------------------------------------------------------- */
  (function signalAxis() {
    var canvas = document.getElementById('signal-axis');
    if (!canvas) return;

    var conn = navigator.connection || {};
    // Unter 1100 px gibt es keine Randspalte, dort blendet CSS die Achse aus.
    var wide = window.matchMedia('(min-width: 1100px)').matches;
    var memoryOk = !navigator.deviceMemory || navigator.deviceMemory >= 4;
    if (!wide || conn.saveData || !memoryOk) return;
    if (/2g|slow-2g/.test(conn.effectiveType || '')) return;

    try {
      var probe = document.createElement('canvas');
      if (!(probe.getContext('webgl2') || probe.getContext('webgl'))) return;
    } catch (err) { return; }

    var idle = window.requestIdleCallback || function (cb) { return setTimeout(cb, 250); };

    idle(function () {
      import('./axis-scene.js').then(function (mod) {
        scene = mod.createAxisScene(canvas, { quality: 'high' });
        window.__vtmAxis = scene; // Handle zum Nachjustieren in der Konsole
        scene.setProgress(pageProgress, true);
        scene.setActive(activeSection);
        scene.start();
        gsap.fromTo(canvas, { opacity: 0 }, { opacity: 1, duration: 1.1, ease: 'power2.out' });

        window.addEventListener('resize', function () { scene.resize(); }, { passive: true });

        // Auf den dunklen Flaechen (Kontakt, Fussbereich) waere eine
        // kobaltfarbene Achse unsichtbar. Dort wechselt sie auf Messing.
        Array.prototype.forEach.call(
          document.querySelectorAll('.section--dark, .site-footer'),
          function (el) {
            ScrollTrigger.create({
              trigger: el,
              start: 'top 55%',
              end: 'bottom 45%',
              onToggle: function (self) { scene.setDark(self.isActive); }
            });
          }
        );

        document.addEventListener('pointermove', function (e) {
          scene.setPointer(
            e.clientX / window.innerWidth * 2 - 1,
            e.clientY / window.innerHeight * 2 - 1
          );
        }, { passive: true });

        document.addEventListener('visibilitychange', function () {
          if (document.hidden) scene.stop(); else scene.start();
        });

        reduceMotion.addEventListener('change', function (e) {
          if (e.matches) { scene.stop(); canvas.style.opacity = '0'; }
        });
      }).catch(function () {
        // Kein Drama: die Seite funktioniert ohne die Achse vollstaendig.
      });
    }, { timeout: 1200 });
  })();

  initForm();
  initYear();
})();
