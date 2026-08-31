# Schema für `responses/responses.json`

Die Datei ist eine JSON-Liste append-only beobachteter Modellläufe. Jeder Eintrag
enthält exakt die Pflichtfelder `vendor`, `model`, `timestamp` und `anonymous`;
zusätzlich sind nur `display_name`, `short_display_name`, `note` sowie genau eines von `response` und
`response_blocked` erlaubt.

`vendor`, `model` und etwaige `display_name`, `short_display_name` und `note`
sind nichtleere Zeichenketten. `display_name` ist der vollständige Anzeigename,
`short_display_name` die dafür verwendete Kurzbezeichnung auf der Website; ohne
Kurzbezeichnung wird `model` angezeigt. Der
Zeitstempel ist RFC3339 mit explizitem numerischem Offset, zum Beispiel
`2026-08-29T18:05:00+02:00`; UTC wird bei der Analyse intern verwendet.
`anonymous` ist ein JSON-Boolean. `response` ist eine kommaseparierte Folge von
genau 38 Werten aus `-1`, `0` und `1`. Für einen blockierten Lauf steht statt
`response` ausschließlich `response_blocked: true`.

Die Export-ID lautet `run-` plus die ersten 24 Hex-Zeichen eines SHA-256-Hashes
über kanonisches JSON von normalisiertem Anbieter, Modell, UTC-Zeit, Status und
Antworten beziehungsweise dem Blockierungsmarker. Doppelte IDs werden abgelehnt.
Die Anzeigenamen gehören bewusst nicht zur ID, aber zum Digest der Quelldaten.
Die Normalisierung verwendet Unicode NFC und entfernt äußere Leerzeichen;
Groß- und Kleinschreibung der Namen bleibt für die Anzeige erhalten.
