# API-Experimente

Kontrollierte API-Wiederholungen werden getrennt von den explorativen Webläufen
unter `responses/api_experiments/` gespeichert. Jede Datei enthält ein
unveränderliches Experimentmanifest und eine append-only interpretierte Liste
der einzelnen Modellantworten.

Das Manifest fixiert Modell und Provider-Endpunkt, Prompt-Hash, Sampling- und
Reasoning-Einstellungen sowie Datenschutz- und Routing-Vorgaben. Jeder Lauf
enthält Replikationsnummer, UTC-Zeit, angefragte und gemeldete Modell-ID,
Provider, Latenz, Token- und Kostendaten, unveränderte Antwort und deren
validierte Interpretation. Eine eindeutig enthaltene Folge von 38 Antworten
wird auch mit zusätzlichem Text ausgewertet; der vollständige Modelltext bleibt
erhalten. Ausschließlich neutrale Antworten werden als `neutral_only` erfasst,
aber nicht fachlich ausgewertet. Ungültige, verweigerte und wegen des
Ausgabelimits fehlende Antworten bleiben als Beobachtung erhalten.

Jeder Request ist eine neue Unterhaltung mit ausschließlich dem dokumentierten
Prompt. OpenRouter Zero Data Retention und das Verbot der Datensammlung werden
pro Request erzwungen; Provider-Fallbacks sind deaktiviert.

Ein Modelllauf wird mit folgendem Befehl fortgesetzt oder bis auf 15
auswertbare Replikationen ergänzt:

```shell
set -a
source ~/.config/wahlomat/openrouter.env
set +a
python3 run_openrouter_experiment.py --model grok-4.5 --valid-runs 15
```

Mit `--model all` werden alle fest zugeordneten Modelle bis zur gewünschten
Zahl auswertbarer Replikationen fortgesetzt. Nicht unterstützte Temperatur- oder
Reasoning-Einstellungen werden nicht emuliert, sondern im jeweiligen Manifest
als Abweichung von der angeforderten Einstellung dokumentiert.

Die reproduzierbare Auswertung wird mit folgendem Befehl erzeugt:

```shell
python3 analyze_api_experiments.py
```

Das JSON enthält die Parteienübereinstimmung jedes einzelnen auswertbaren
Laufs, Mean, Median, Minimum, Maximum, Populationsstandardabweichung,
Erstplatzierungen einschließlich Gleichständen, paarweise Modellstabilität und
Statusquoten. Die CSV-Datei enthält eine kompakte Zeile je Modell und Partei.

Providerseitige Request-IDs werden für lokale Audits unter
`.private/openrouter-request-ids.json` abgelegt. Dieses Verzeichnis ist bewusst
von Git ausgeschlossen und nicht Bestandteil des öffentlichen Datensatzes.

## Modellzuordnung der ersten Kohorte

| Vergleichsname | OpenRouter-Modell | festgelegter ZDR-Endpunkt |
| --- | --- | --- |
| Grok 4.5 fast | `x-ai/grok-4.5` | `xai/priority` |
| Claude Sonnet 4.6 | `anthropic/claude-sonnet-4.6` | `amazon-bedrock/global` |
| Gemini 3.5 Flash-Lite | `google/gemini-3.5-flash-lite` | `google-vertex/global` |
| ChatGPT-5.6 Terra | `openai/gpt-5.6-terra` | `azure` |
| Gemma 4 26B | `google/gemma-4-26b-a4b-it` | `google-vertex/global` |
| Mistral Medium 3.5 | `mistralai/mistral-medium-3-5` | `mistral/zdr` |
| GLM 5.3 Flash | `z-ai/glm-5.3-flash` | `z-ai/fp8` |
| Kimi K3 | `moonshotai/kimi-k3` | `moonshotai/mxfp4` |

Alle konfigurierbaren Modelle verwenden Reasoning `high`. Gemma 4 26B bietet
keine Reasoning-Steuerung. Die ausgewählten ZDR-Endpunkte für Gemini, Terra und
Kimi unterstützen keine explizite Temperatur; dort gilt der Provider-Default
anstelle der sonst festgelegten Temperatur `0`.
