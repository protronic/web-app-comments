# Einzeln freigegebene Dateien, Sidecars und Benachrichtigungen

Stand: Sidecar-MVP (`.{name}.jsco`) mit @‑Erwähnungen und Dashboard-Filter **Ich**.

Dieses Dokument beschreibt **bekannte Grenzen** beim Kommentieren **einzeln freigegebener Dateien** (nicht Ordner- oder Space-Freigaben) und was bei **Benachrichtigungen** heute möglich ist.

---

## Kurzfassung

| Thema | Ordner-Freigabe / Project Space | Einzeln freigegebene Datei |
|-------|----------------------------------|----------------------------|
| Kommentare lesen/schreiben | In der Regel stabil | Eingeschränkt; Sidecar braucht eigene Rechte |
| Dashboard / Filter **Ich** | Zuverlässiger | Tag-Metadaten fehlen oft bei Mountpoints (Workaround im Code) |
| @mention für Empfänger | Möglich, wenn Sidecar lesbar | Oft problematisch ohne Sidecar-Freigabe |
| Glocke (Server-Notification) | Ja (Freigabe-Event) | **Nein** für Erwähnungen |
| In-App-Toast (@mention) | Best effort (Polling/SSE) | Best effort; braucht lesbare Sidecar |

**Empfehlung:** Diskussionen auf **Ordner-Freigaben** oder **Project Spaces** legen, nicht auf einzelne Datei-Freigaben.

---

## Warum einzeln freigegebene Dateien problematisch sind

### Sidecar-Dateien sind separate Ressourcen

Kommentare liegen nicht in der Datei selbst, sondern in einer **Sibling-Datei**:

```
/projects/Plan.md          ← Original
/projects/.Plan.md.jsco    ← Kommentare (JSON)
```

OpenCloud kennt Sidecars **nicht** als Sonderfall. Beim Speichern werden Freigaben der Ausgangsdatei per Graph API auf die `.jsco` **kopiert** (`syncSidecarPermissions`). Das ist **best effort**:

- Funktioniert bei **direkten Datei-Freigaben** (Empfänger explizit auf der Datei).
- **Nicht** bei rein vererbten Ordner-Rechten ohne direkte Datei-Permission in der Graph-API.
- Sidecar-Freigaben können **hinterher** angelegt werden; alte Sidecars vor dem Fix sind ggf. ohne Empfänger-Rechte.

### Mountpoints und Metadaten

Empfänger sehen geteilte Inhalte oft als **Mountpoint** (`driveType: mountpoint`). WebDAV liefert dort häufig **keine Tags** (`Kommentiert`), obwohl die Tag-Suche die Datei findet.

**Symptom (behoben):** Dashboard und Mention-Polling filterten Treffer fälschlich wieder heraus, weil `entry.target.tags` leer war.

**Restrisiko:** Andere Metadaten (Pfad-Auflösung, Links) können bei Mountpoints abweichen.

### Pfade in Sidecar-Snapshots

Sidecars speichern den Ziel-Pfad zum Zeitpunkt des Speicherns. Verschieben/Umbenennen oder abweichende Mountpoint-Pfade können die Auflösung erschweren. Die App liest Sidecars primär **relativ zum aktuellen Ressourcennamen** (`/.{name}.jsco`).

---

## Benachrichtigungen

### Was funktioniert

- **Freigabe-Benachrichtigung (Glocke):** OpenCloud-Server legt OCS-Notifications an („X hat Y geteilt“). Das betrifft die **Freigabe**, nicht den Kommentarinhalt.

### Was nicht (oder nur eingeschränkt) funktioniert

| Kanal | @mention | Hinweis |
|-------|----------|---------|
| **Glocke / Notification Center** | Nein | OCS `notifications` API erlaubt auf test.oc nur `list`, `get`, `delete` — kein `create` aus der Extension |
| **In-App-Toast** | Best effort | Extension pollt (20 s) und reagiert auf SSE (`file-touched`, `postprocessing-finished`); kein Ersatz für die Glocke |
| **Toast beim Öffnen der Sidebar** | Entfernt | War irreführend (man sieht die Mention ohnehin) |

Erwähnungs-Toasts setzen voraus, dass der Empfänger die `.jsco` **lesen** darf und das Dashboard/Polling den Thread findet.

Details und Roadmap: [notifications-plan.md](./notifications-plan.md).

---

## UI-Hinweis in der Extension

Beim Öffnen der Kommentar-Sidebar für **einzeln freigegebene Dateien** zeigt die App:

1. einen **Warn-Banner** in der Sidebar,
2. einen **Hinweis direkt über dem Kommentarfeld**,
3. beim ersten Kommentar oder der ersten Antwort pro Datei einen **Toast** mit Empfehlung zu Ordner-Freigabe oder Project Space,
4. einmal pro Datei pro Browser-Sitzung beim Öffnen der Sidebar einen **Toast** (falls noch nicht beim Speichern gezeigt).

Erkennung (Heuristik):

- Mountpoint mit **Share-Root** auf Dateiebene, oder Mountpoint-Name entspricht dem Dateinamen (Einzeldatei-Freigabe).
- Datei im eigenen Space mit **direkten** `shareTypes` (nicht nur „mounted“/vererbt).
- Fallback: Graph-API `listPermissions`, wenn die Sidebar-Ressource keine `shareTypes` liefert (typisch in der Dateivorschau).

---

## Empfehlungen für Betrieb und Tests

1. **Project Space** anlegen und dort Dateien ablegen statt Einzeldatei-Freigaben aus dem Home-Verzeichnis.
2. Alternativ **Ordner freigeben** und Dateien darin ablegen — Sidecars liegen im selben Ordner und erben typischerweise mit.
3. Nach dem Kommentieren als Besitzer: Empfänger-Konto testen (Sidebar + Dashboard **Ich**).
4. Für @mention-Tests: `sessionStorage.removeItem('comments-mentioned-notified')` und Hard-Reload.
5. Langfristig: **native Comments-API** serverseitig (siehe [native-comments-api.md](./native-comments-api.md)).

---

## Relevante Code-Stellen

| Bereich | Datei |
|---------|--------|
| Sidecar-Freigaben sync | `src/utils/sidecarPermissions.ts` |
| Dashboard Tag-Filter | `src/storage/WebdavSidecarDashboardStorage.ts` |
| Mention-Polling/SSE | `src/composables/useCommentNotifications.ts` |
| Einzeldatei-Hinweis | `src/utils/individuallySharedFile.ts`, `src/composables/useIndividualShareCommentHint.ts` |
