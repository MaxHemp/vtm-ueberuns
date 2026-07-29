# VersicherungsTech Magazin — Seite „Über uns“

Statische Seite, fertig zum Deployen. Kein Build-Schritt, keine Abhängigkeiten,
kein Node, kein npm. Ordner hochladen, fertig.

---

## 1. Schnellstart

**Lokal ansehen** (irgendein statischer Server, `file://` reicht wegen der
Webfont-CORS-Regeln nicht):

```bash
cd vtm-ueber-uns
python3 -m http.server 8080
# → http://localhost:8080
```

**Deployen** — Ordnerinhalt an das Ziel kopieren:

| Ziel | Vorgehen | Config-Datei |
|---|---|---|
| Netlify / Cloudflare Pages | Ordner als Site droppen oder Repo verbinden, Publish-Directory = Projektwurzel | `_headers` |
| Vercel | `vercel --prod` in diesem Ordner | `vercel.json` |
| Klassisches Webhosting (Apache) | per FTP/rsync nach `/ueber-uns/` | `.htaccess` |
| Nginx / andere | Header und Caching aus `_headers` übernehmen | — |

Die Seite ist so gebaut, dass sie unter `https://www.versicherungstech-magazin.de/ueber-uns/`
liegt. Alle internen Verweise sind relativ, alle Verweise auf das Magazin absolut —
der Ordner läuft also auch unter einem anderen Pfad, du müsstest dann nur die
Canonical-URL anpassen (siehe Checkliste unten).

---

## 2. Was drin ist

```
vtm-ueber-uns/
├── index.html              Die Seite
├── assets/
│   ├── css/
│   │   ├── design-system.css   VTM Brand & Design System 4.2 (Tokens, Base, Komponenten)
│   │   └── site.css            Seitenspezifisches Layout
│   ├── js/site.js              12 KB Bewegungsschicht (GSAP-basiert)
│   ├── js/hero-scene.js        518 KB three.js-Szene, tree-shaked, lazy
│   ├── vendor/gsap.min.js      71 KB
│   ├── vendor/ScrollTrigger.min.js  43 KB
│   ├── fonts/                  7 × WOFF2, latin-Subset, selbst gehostet
│   └── img/                    WebP + Fallback, alle Größen vorgerechnet
├── favicon.ico / favicon-32.png / apple-touch-icon.png / icon-192.png / icon-512.png
├── site.webmanifest
├── robots.txt / sitemap.xml
└── _headers / vercel.json / .htaccess
```

Gemessenes Gewicht (unkomprimiert, Chromium, 1440 px):

- **Erstaufruf: rund 250 KB** (HTML, beide Stylesheets, JS, sieben Webfonts,
  die sichtbaren Bilder)
- **Komplette Seite nach Vollscroll: rund 290 KB**

Mit gzip/brotli auf HTML, CSS und JS — das machen alle in Abschnitt 1
genannten Ziele automatisch — liegt der Erstaufruf real bei rund 190 KB.

---

## 3. Der Weg vom Design-Export hierher

Das gelieferte ZIP war kein Website-Export, sondern ein Design-Compiler-Format:
`<x-dc>`-Wurzelelement, React-Runtime (`support.js`, 69 KB), Template-Bindings
(`{{ showReach }}`), Bedingungs-Tags (`<sc-if>`), nicht standardkonforme
`style-hover`-Attribute und rund 500 Inline-Styles. Das rendert nur im
Design-Tool, nicht im Browser eines Lesers.

Daraus wurde:

- **Semantisches HTML.** Alle Inline-Styles in benannte CSS-Klassen überführt,
  `<sc-if>`-Bedingungen aufgelöst (beide Abschnitte standen auf `true`),
  Template-Bindings entfernt, `lang="de"` gesetzt, Landmarks (`main`, `footer`,
  `nav` mit `aria-label` für das Inhaltsverzeichnis) ergänzt.
- **Eigenes JavaScript.** Die React-Runtime ist ersetzt durch ein
  IntersectionObserver-basiertes Skript. Die Vorlage lief eine
  `requestAnimationFrame`-Dauerschleife plus 400-ms-Watchdog-Intervall — das
  hält die CPU auch dann wach, wenn nichts passiert.

---

## 4. Was gegenüber der Vorlage verbessert wurde

**Barrierefreiheit**

- Alle klickbaren Ziele ≥ 44 × 44 px (Footer-Links lagen darunter)
- Kontrast: `--text-muted` (#6e7888) erreichte auf Weiß nur **4,46 : 1** und
  verfehlte damit WCAG 2.2 AA. Betroffen war jede `.meta`- und `.kicker`-Zeile
  bei ~13 px. Angehoben auf **#666f80 = 5,06 : 1**. Gleiches Muster bei
  `--research` (4,45 → 5,10). Beides ist in `design-system.css` oben als
  bewusste Abweichung vom DS 4.2 dokumentiert — die Primitivfarben bleiben
  unangetastet.
- Formular mit sichtbarem Label (`sr-only`, aber vorhanden), `aria-describedby`,
  `aria-invalid`, Fehlermeldung direkt am Feld, `role="status"` für Rückmeldung
- Ohne JavaScript ist die Seite vollständig lesbar (die Reveal-Animation greift
  nur, wenn `<html>` die Klasse `js` trägt)
- `prefers-reduced-motion` schaltet Parallax, Reveal, Zähler und Hover-Bewegung ab

**Performance**

- Zwei Portraits wogen 2,4 MB und 1,7 MB. Alle Bilder sind jetzt auf 4:5
  zugeschnitten, in den tatsächlich benötigten Größen vorgerechnet und als
  WebP mit JPEG/PNG-Fallback ausgeliefert. Bildgewicht: ~7 MB → ~1 MB.
- `width`/`height` auf jedem `<img>` → kein Layout-Shift
- `loading="lazy"` unterhalb des Falzes, `decoding="async"` durchgehend
- Webfonts selbst gehostet statt `@import` von Google Fonts: der `@import` in
  der Vorlage blockiert das Rendering und lädt vier Familien in acht
  Schnitten. Hier sind es sieben WOFF2-Dateien (132 KB, latin-Subset),
  `font-display: swap`, die beiden kritischen per `<link rel="preload">`.
  Source Serif 4 wurde entfernt — auf dieser Seite kommt kein Serifentext vor.
- Scroll-Effekte über IntersectionObserver und rAF-gedrosselte Scroll-Handler
  statt Dauerschleife; Parallax rechnet nur in den ersten 900 px und nur ab
  900 px Viewport-Breite

**Datenschutz**

- Null Requests an Dritte. Keine Google Fonts, keine CDNs, keine Tracker.
  Damit entfällt das bekannte Google-Fonts-Thema (LG München I, 3 O 17493/20)
  für diese Seite vollständig.

**Sicherheit**

- CSP mit `default-src 'self'`, Inline-Skripte per SHA-256-Hash freigegeben
  (kein `unsafe-inline`), dazu `nosniff`, `X-Frame-Options`, `Referrer-Policy`
  und `Permissions-Policy` — in allen drei Config-Dateien hinterlegt

**SEO / Social**

- Description, Canonical, Robots-Direktiven, Open Graph, Twitter Card
- JSON-LD: `NewsMediaOrganization` (mit `foundingDate`, `employee`,
  `publishingPrinciples`), `AboutPage`, `BreadcrumbList`
- OG-Karte 1200 × 630 im Markendesign generiert
- Favicons in allen relevanten Größen, Web-App-Manifest, `sitemap.xml`, `robots.txt`

**Inhalt / Handwerk**

- Die Kopfzeile trägt nur noch Markenzeichen, Wortmarke und einen
  Newsletter-Anker. Die Rubriken-Navigation der Vorlage (sechs mal `href="#"`)
  ist entfallen, weil die Seite in eine Website eingebettet wird, die ihre
  eigene Navigation mitbringt. Zwei Navigationsebenen übereinander wären
  verwirrend. Damit entfielen auch das mobile Menü und der Skip-Link.
  Höhe der Leiste: 56 px mobil, 64 px ab Tablet.
- Der Footer verlinkt auf Impressum, Datenschutzerklärung, AGB, Kooperationen,
  Presse, LinkedIn und RSS.
- Deutsche Anführungszeichen korrigiert: `„Sponsored Content"` → `„Sponsored Content“`
- Newsletter-Formular funktioniert statt nur `e.preventDefault()`

---

## 4b. Gestalterischer Feinschliff (zweiter Durchgang)

Design Read: **Redesign-preserve einer Über-uns-Seite für ein B2B-Fachmedium,
Publikum Vorstände und IT-Verantwortliche der Assekuranz, Sprache
Swiss-editorial, Basis ist das bestehende VTM Design System 4.2.**
Dials: `VARIANCE 6 / MOTION 5 / DENSITY 5`, also die Werte der Vorlage
gematcht statt einen fremden Baseline-Look aufzusetzen.

**Geändert:**

- **Weniger Eyebrows.** Die kleinen Mono-Versalzeilen über den Überschriften
  standen über sieben von sieben Abschnitten und erzeugten genau die
  gleichförmige Rhythmik, an der man KI-gebaute Seiten erkennt. Vier davon
  sind weg (Mission, Team, Netzwerk, Kontakt), weil die Überschrift darunter
  dasselbe schon sagte. Geblieben sind drei, die echte Information tragen:
  der Datenstand über den Kennzahlen, „Redaktionelle Grundsätze" und das
  „Über uns" im Hero.
- **Mission ohne Kartenkästen.** Die drei gleich großen Karten nebeneinander
  sind das generischste Feature-Muster im Web. Der Abschnitt ist jetzt eine
  von Haarlinien getrennte Liste mit Ziffer, Titel, Text und einem rechts
  gesetzten Kategorie-Label. Karten bleiben den Stellen vorbehalten, wo ein
  Container wirklich etwas umschließt: Personen und Partner mit Logo.
- **Grundsätze als 2×2-Raster.** Vorher hatten Mission und Grundsätze
  dasselbe Layout (klebende Überschrift links, Inhalt rechts). Zwei
  Abschnitte mit identischer Bauform auf einer Seite von sieben lesen sich
  wie eine Vorlage. Die Grundsätze bekommen jetzt eine volle Kopfzeile und
  vier Blöcke im Raster.
- **Kein einziger `scroll`-Listener mehr.** Lesefortschritt und
  Hero-Bewegung laufen als CSS-Scroll-Timeline (`animation-timeline: scroll()`),
  der Scrollspy über einen `IntersectionObserver` mit schmalem Beobachtungsband.
  Das rechnet der Compositor, nicht der Main-Thread. Browser ohne Support für
  Scroll-Timelines zeigen die Seite ohne Parallax und ohne Fortschrittsbalken,
  sonst unverändert.
- **Kopfzeile flach gehalten.** 56/64 px statt der ursprünglichen 76 px. Eine
  Leiste, die nur Logo und einen Anker trägt, braucht keine Bauhöhe.

**Bewusst nicht geändert, mit Begründung:**

- **Gedankenstriche bleiben.** Die Regel gegen Halbgeviert- und
  Geviertstriche zielt auf englische Marketing-Texte, wo der Strich ein
  typisches KI-Muster ist. Im Deutschen ist der Gedankenstrich die korrekte
  Interpunktion, und der Text ist deiner, nicht meiner. Geviertstriche (—)
  kommen auf der Seite nicht vor, das habe ich geprüft: null. Die neun
  Halbgeviertstriche (–) sind alle grammatikalisch richtig gesetzt.
- **Inter als Fließschrift.** Wird als Standardwahl kritisch gesehen, ist
  hier aber im DS 4.2 gesetzt. Markenvorgabe schlägt Geschmacksregel.
- **Hero-Längen.** Die Regel „Vorspann maximal 20 Wörter" gilt für
  Conversion-Landingpages. Das hier ist eine Über-uns-Seite, der Vorspann hat
  48 Wörter und ist dein Text. Nicht angetastet.
- **Kein Dark Mode.** Das DS 4.2 definiert keine Dunkel-Tokens. Eine
  Dunkelpalette für deine Marke zu erfinden ist keine Entscheidung, die ich
  ungefragt treffe. Wenn du sie willst, sag Bescheid, dann leite ich sie
  sauber aus den Primitiven ab.

**Kleine Texteingriffe, damit du sie kennst:** in vier Sätzen der Mission-
und Grundsätze-Blöcke habe ich beim Umbau je einen Gedankenstrich durch
Komma oder „oder" ersetzt („belegen oder eine Entscheidung besser machen"
statt „belegen – oder …"). Rein stilistisch, inhaltlich identisch. Falls du
deine Fassung zurück willst: vier Stellen in der `index.html`.

---

## 4c. Interaktionsschicht (dritter Durchgang)

### Das visuelle Konzept: „Signal im Rauschen"

Das Magazin behauptet in seinem Text, Signal von Rauschen zu trennen. Der
Kopfbereich tut es jetzt: ein Netz aus 230 Knoten steht beim Laden als
ungeordnete Punktwolke im Raum. Beim Scrollen wandern die Knoten auf fünf
konzentrische Ringe, und die Verbindungen zwischen ihnen werden kurz genug,
um sichtbar zu werden. Aus Rauschen wird Struktur.

Die Ringneigung greift die Orbits auf, die im Design System 4.2 schon als
CSS-Element vorhanden sind, die Farben sind Kobalt, Elektrisch-Blau und acht
Messingknoten als Akzent. Es ist also keine aufgesetzte 3D-Deko, sondern das
bestehende Markenmotiv in drei Dimensionen.

### Technik

- **three.js**, auf das Nötige heruntergebrochen (`esbuild --bundle`):
  518 KB roh, 130 KB gzip. Beide Zustände, Rauschen und Ordnung, liegen als
  Attribute im Buffer; der Vertex-Shader mischt sie über eine einzige Uniform.
  Es gibt keine Nachbarschaftssuche pro Bild und keine Geometrie-Updates auf
  der CPU. Pro Frame werden eine Handvoll Uniforms geschrieben, sonst nichts.
- **Geladen wird nur, wenn es sich lohnt:** kein `prefers-reduced-motion`,
  Viewport ab 820 px, kein Datensparmodus, kein 2G, mindestens 4 GB
  Gerätespeicher (sofern der Browser das verrät), WebGL vorhanden. Der Import
  läuft über `requestIdleCallback`, also nach dem ersten Rendern. Ohne Szene
  bleiben die CSS-Orbits stehen und es fehlt nichts.
- **Pausiert**, sobald der Kopfbereich aus dem Sichtfeld ist oder der Tab in
  den Hintergrund geht.
- **GSAP mit ScrollTrigger** als einzige Bewegungs-Engine: Einlauf des
  Kopfbereichs, gescrubbter Austritt, Reveal der Abschnitte, Scrollspy,
  Lesefortschritt, Zähler. Derselbe Scroll-Fortschritt, der den Kopftext
  zurücktreten lässt, fährt die Ordnung der Szene hoch: Text und Szene
  erzählen dieselbe Geste.
- **Kein einziger `scroll`-Event-Listener.** Alles läuft über ScrollTrigger.
- **Lichtkegel** auf Karten und Säulen: der Zeiger schreibt zwei
  CSS-Variablen, den Rest macht ein `radial-gradient`. Nur bei präzisem
  Zeiger, ein `requestAnimationFrame` pro Bewegung.

### Gewicht

| | roh | gzip |
|---|---|---|
| Seite ohne 3D-Modul | rund 420 KB | rund 150 KB |
| mit 3D-Modul | rund 938 KB | rund 280 KB |

Das 3D-Modul ist der mit Abstand größte Posten. Es lädt verzögert und nur auf
Geräten, die es tragen; die Seite ist vorher vollständig lesbar und bedienbar.
Wenn dir das zu teuer ist, ist es genau eine Zeile in `site.js`: den Block
`scene3d` auskommentieren, dann bleiben die CSS-Orbits.

### Drei Fehler, die dabei gefunden und behoben wurden

1. **Shader-Präzision.** `uOrder` war im Vertex-Shader `highp`, im
   Fragment-Shader `mediump`. Das WebGL-Programm wurde dadurch komplett
   ungültig, die Szene hätte gar nicht gerendert.
2. **Falscher Längenmaßstab.** Die Linien blendeten anhand des Abstands zum
   Weltursprung aus statt anhand der echten Kantenlänge. Dadurch waren die
   äußeren Ringe im geordneten Zustand blass. Jetzt kennt jedes Vertex seinen
   Partner und der Shader rechnet die echte Länge in jedem Mischzustand.
3. **Bildratenabhängige Glättung.** Die Interpolation lief pro Frame statt pro
   Zeit: bei 30 fps kroch sie, bei 144 fps sprang sie. Jetzt zeitbasiert.

### Was ich nicht prüfen konnte

Diese Build-Umgebung hat nur einen Software-Renderer mit rund 1 Bild pro
Sekunde. Die Szene läuft dort fehlerfrei, aber **wie sie aussieht, habe ich
nicht gesehen.** Belegt ist die Mathematik: mit exakt der Erzeugungslogik aus
dem Modul nachgerechnet sind im Rauschzustand 0 % der 262 Kanten sichtbar
(Median-Länge 12,7 Einheiten), im geordneten Zustand 91 % (Median 0,78). Der
Effekt trägt also. Ob Punktdichte, Deckkraft und Kameraposition im echten
Browser gut wirken, musst du beurteilen. Wenn das Netz zu präsent oder zu
blass ist: `uSize` und die Alpha-Werte in `hero-scene.src.js` sind die
Stellschrauben, danach neu bündeln (siehe unten).

### Szene neu bauen

Der Quelltext liegt unter `assets/js/hero-scene.src.js`, ausgeliefert wird das
gebündelte `hero-scene.js`.

```bash
npm i -D esbuild three
npx esbuild assets/js/hero-scene.src.js --bundle --format=esm --minify \
  --target=es2019 --outfile=assets/js/hero-scene.js
```

---

## 5. Newsletter anbinden

Das Formular postet an den Endpunkt aus dem `data-endpoint`-Attribut in
`index.html`:

```html
<form id="newsletter-form"
      data-endpoint="https://www.versicherungstech-magazin.de/members/api/send-magic-link/"
      data-fallback="https://www.versicherungstech-magazin.de/#/portal/signup">
```

Voreingestellt ist die **Ghost-Members-API** (Magic Link / Double Opt-in).
Gesendet wird `{ email, emailType: "subscribe", labels: [] }`.

**Wichtig:** Wenn die Seite nicht unter `versicherungstech-magazin.de` liegt,
ist das ein Cross-Origin-Request. Ghost muss die Domain dann in den CORS-Regeln
erlauben, sonst greift der Fallback. Das ist eingeplant: Bei einem Fehler
erscheint eine Meldung plus ein Link auf das Ghost-Portal, der Nutzer landet
also trotzdem bei der Anmeldung. Bitte einmal live gegentesten.

Anderer Anbieter (Brevo, Mailchimp, CleverReach)? Nur `data-endpoint` tauschen
und ggf. in `site.js` den `body` der `fetch`-Anfrage anpassen — die Stelle ist
kommentiert. Der Endpunkt muss dann auch in die `connect-src`-Direktive der CSP
in `_headers` / `.htaccess`.

---

## 6. Vor dem Livegang — Checkliste

**Muss:**

- [ ] **LinkedIn-Profile der fünf Teammitglieder.** Aktuell stehen dort
      Suchlinks (`/search/results/all/?keywords=…`), weil mir die echten
      Profil-URLs nicht vorlagen. Funktionieren, sehen aber unfertig aus.
      In `index.html` nach `link-arrow` suchen.
- [ ] **Canonical-URL prüfen.** Steht auf `/ueber-uns/`. Falls Ghost einen
      anderen Slug vergibt, an vier Stellen anpassen: `<link rel="canonical">`,
      `og:url`, die drei URLs im JSON-LD, `sitemap.xml`.
- [ ] **Newsletter-Anmeldung live testen** (siehe Abschnitt 5).
- [ ] **Datenstand der Reichweiten-Zahlen korrigieren.** Die vier Kennzahlen
      wurden aktualisiert (20.000 LinkedIn-Follower, 1.200 Newsletter-Abos,
      35.000 Podcast-Downloads/Monat, 2.000 Website-Nutzer/Monat), das
      Datum steht aber unverändert auf **28.02.2026** — an zwei Stellen:
      in der Zeile „VTM Reichweite / Datenstand 28.02.2026" über der
      Kachelreihe und im Hinweiskasten darunter. Ein korrektes Datum lag mir
      nicht vor, deshalb habe ich nichts erfunden. Bitte vor dem Livegang
      setzen — sonst steht auf derselben Seite, die „Zahlen nennen Quelle,
      Zeitraum und Stichprobe" als Grundsatz führt, ein falscher Zeitraum.
- [ ] **Öffnungsrate und C-Level-Anteil** („über 50 %", zweimal auf der Seite)
      gegen den neuen Datenstand prüfen.

**Solltest du prüfen:**

- [ ] **Impressumspflicht.** Der Footer verlinkt auf das Impressum des
      Magazins. Ob zusätzlich die verantwortliche Gesellschaft direkt im Footer
      genannt werden soll, ist eine Entscheidung, die ich dir nicht abnehmen
      wollte — ich habe nichts erfunden, was nicht in der Vorlage stand.
- [ ] **Portraitrechte** für die fünf Team- und sechs Host-Bilder.
- [ ] Die drei Partnerlogos (InsurLab, FRIDA, InsurTech Werft) und das
      Insurance-Monday-Logo stammen aus dem Export — Nutzungsfreigabe klären.
- [ ] `sitemap.xml` enthält nur diese Seite. Wenn Ghost eine eigene Sitemap
      ausliefert, diese Datei besser löschen und die Seite dort eintragen
      lassen, sonst gibt es zwei konkurrierende Sitemaps.

---

## 7. Bilder neu erzeugen

Die Ableitungen sind vorgerechnet, du brauchst dafür im Normalfall nichts.
Wenn ein Portrait getauscht wird: neues Bild in möglichst hoher Auflösung
ablegen und die Ableitungen im gleichen Schema erzeugen
(`<slug>-320.webp/.jpg`, optional `-640`). Zuschnitt ist 4:5, Kopfbereich mit
10 % Beschnitt oben — so sitzen alle fünf Gesichter auf derselben Höhe.

Hinweis zur Qualität: Vier der Portraits liegen nur in 400 × 400 px vor
(Passler, Härle, Oberhofer, Dahmen). Daraus lässt sich maximal ein
320 × 400-Zuschnitt gewinnen — auf einem Retina-Display sind diese vier
minimal weicher als das von Hempel, das in 941 × 1671 px vorlag. Wenn du an
die Originale kommst, lohnt sich der Austausch.

---

## 8. Getestet

Chromium, geprüft bei 375 / 768 / 1280 / 1600 px:

- kein horizontaler Overflow
- keine Konsolenfehler
- alle Bilder laden, alle mit `alt` und Dimensionen
- Überschriftenhierarchie lückenlos (ein `h1`, dann `h2`/`h3`)
- keine doppelten IDs, keine toten Sprungmarken
- alle Eingabefelder mit Label verknüpft
- Scrollspy, Zähler-Animation und Formularvalidierung verhalten sich wie erwartet
- Kontrastwerte durchgehend ≥ 4,5 : 1

Nicht getestet: Safari und Firefox, dafür stand keine Umgebung zur Verfügung.
Es wird nichts verwendet, das dort Probleme machen sollte. Ein kurzer Blick
auf beide vor dem Livegang wäre trotzdem sinnvoll.
