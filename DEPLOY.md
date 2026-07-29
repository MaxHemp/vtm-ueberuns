# Deployen — Schritt für Schritt

Diese Seite braucht **keinen Build**. Kein Node, kein npm, kein Kommandozeilen-
Werkzeug. Die Dateien so, wie sie hier liegen, sind das fertige Ergebnis.

Voreingestellte Adresse: **`ueber-uns.versicherungstech-magazin.de`**
Wenn du eine andere willst, siehe Abschnitt 4 unten.

---

## 1. Dateien zu GitHub laden (ohne Terminal)

1. Auf [github.com/new](https://github.com/new) ein neues Repository anlegen.
   Name zum Beispiel `vtm-ueber-uns`. Privat ist in Ordnung.
   **Kein** Häkchen bei „Add a README file" — das Repo muss leer starten.
2. Im leeren Repo auf **„uploading an existing file"** klicken
   (der Link steht mitten auf der Seite).
3. Den **Inhalt** dieses Ordners ins Browserfenster ziehen — also `index.html`,
   `assets`, `README.md` und alles andere. Nicht den Ordner selbst, sondern
   was darin liegt.
4. Unten auf **Commit changes** klicken. Fertig.

### Die drei Dateien mit dem Punkt am Anfang

`.nojekyll`, `.gitignore` und `.github` werden vom Datei-Explorer oft
ausgeblendet und landen dann nicht im Upload. Ohne `.nojekyll` ignoriert
GitHub Pages die Datei `_headers`.

- **macOS:** im Finder `Cmd` + `Shift` + `.` drücken, dann sind sie sichtbar.
- **Windows:** Explorer → Reiter „Ansicht" → Haken bei „Ausgeblendete Elemente".

Alternativ genügt es, sie später über **Add file → Create new file** direkt auf
GitHub anzulegen: Dateiname `.nojekyll`, Inhalt leer.

---

## 2. Veröffentlichen

Zwei Wege. Beide lesen dieses Repo, du musst nichts weiter vorbereiten.

### Weg 1: Vercel (empfohlen)

1. Auf [vercel.com](https://vercel.com) mit dem GitHub-Konto anmelden.
2. **Add New → Project**, das Repo auswählen, **Import**.
3. Framework Preset auf **Other** stellen. Build Command und Output Directory
   leer lassen.
4. **Deploy.** Nach etwa 20 Sekunden läuft die Seite unter einer
   `.vercel.app`-Adresse.

Die `vercel.json` wird automatisch gelesen: Caching für Schriften und Bilder,
Security-Header.

### Weg 2: GitHub Pages

1. Im Repo auf **Settings → Pages**.
2. Bei *Source* **Deploy from a branch** wählen, Branch `main`, Ordner `/ (root)`.
3. **Save.** Nach ein bis zwei Minuten ist die Seite unter
   `deinname.github.io/vtm-ueber-uns/` erreichbar.

Unterschied zu Vercel: GitHub Pages kann **keine eigenen HTTP-Header**.
`vercel.json` und `_headers` werden ignoriert. Die Seite funktioniert
trotzdem vollständig, aber ohne Caching-Steuerung und ohne Security-Header.

---

## 3. Eigene Domain anhängen

Die Datei `CNAME` in diesem Ordner enthält bereits
`ueber-uns.versicherungstech-magazin.de`. GitHub Pages liest sie automatisch.
Bei Vercel trägst du die Adresse unter **Settings → Domains** ein.

Danach beim DNS-Anbieter **einen** Eintrag anlegen:

| | Vercel | GitHub Pages |
|---|---|---|
| Typ | CNAME | CNAME |
| Name | `ueber-uns` | `ueber-uns` |
| Wert | `cname.vercel-dns.com` | `deinname.github.io` |

> **Wichtig:** Nur diesen einen Eintrag anlegen. Die Records für `@` und `www`
> zeigen auf Ghost und dürfen nicht angefasst werden — sonst ist das Magazin
> offline.

Das Zertifikat kommt bei beiden Anbietern automatisch, meist innerhalb weniger
Minuten. Bei GitHub Pages danach noch **Enforce HTTPS** aktivieren.

---

## 4. Andere Adresse verwenden

Ist die Subdomain eine andere, müssen fünf Stellen angepasst werden. Am
einfachsten mit Suchen-und-Ersetzen über den ganzen Ordner:

**Suchen:** `ueber-uns.versicherungstech-magazin.de`
**Ersetzen durch:** deine Adresse

Betroffen sind `index.html`, `sitemap.xml`, `robots.txt` und `CNAME`.

Falls die Seite später doch unter einem Pfad statt einer Subdomain laufen soll
(also `.../ueber-uns/` statt `ueber-uns....`), sag Bescheid — dafür braucht es
einen anderen Aufbau, siehe Abschnitt „In Ghost einbetten" im `README.md`.

---

## 5. Nach dem ersten Aufruf prüfen

- Erscheint der Kopfbereich mit Überschrift, Vorspann und dunklem Panel?
- Ordnet sich rechts daneben das Knotennetz? (Nur ab 820 px Fensterbreite und
  nur, wenn im Betriebssystem keine reduzierte Bewegung eingestellt ist.)
- Laufen die Kennzahlen bei „Reichweite & Community" hoch?
- Funktioniert die Newsletter-Anmeldung? Siehe `README.md`, Abschnitt 5 —
  das ist der Punkt, der am ehesten noch Anpassung braucht.

Zum Ausprobieren der 3D-Szene in der Browser-Konsole:

```js
__vtmScene.setOrder(0, true)   // reines Rauschen
__vtmScene.setOrder(1, true)   // volle Ordnung
```

---

## 6. Später etwas ändern

Kleine Textänderungen gehen direkt auf GitHub: Datei anklicken, auf das
Stift-Symbol, ändern, **Commit changes**. Vercel und GitHub Pages
veröffentlichen die Änderung von selbst, meist innerhalb einer Minute.
