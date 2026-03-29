# Sephiroth Trading Platform

Sephiroth ist ein produktionsnahes Trading Research und Agent Operations System mit Fokus auf belastbare Forschung, Kapitalerhalt und kontrollierte Execution.

## Stand heute

- React/Vite Frontend mit lazy geladenen Routen
- echte Backtesting- und Walk-Forward-Edge-Functions
- Strategy Parsing und Agent Analysis
- Agent Tournament mit Risk Kernel
- Champion/Challenger, Lifecycle und Drift-Monitoring
- Scheduler-/Orchestrator-Loop
- Regime-Erkennung und Meta-Allokation
- Paper Trading
- Live Execution als sichere Dry-Run-/Simulation-Schicht
- Production-Readiness-Checks in Skripten und UI

## Start

```bash
npm install
npm run dev
```

## Checks

```bash
npm run build
npm run check:smoke
npm run check:prod
npm run check:vercel
```

## Vercel Deploy

Sephiroth ist jetzt fuer einen Vercel-Deploy vorbereitet.

1. Repository bei Vercel importieren.
2. Build Command auf `npm run build` lassen.
3. Output Directory `dist` verwenden.
4. In Vercel unter Environment Variables mindestens `VITE_SUPABASE_URL` und `VITE_SUPABASE_ANON_KEY` setzen.
5. Danach zuerst Frontend deployen und anschliessend Supabase-Migrationen und Edge Functions in der Zielumgebung verifizieren.

Fuer eine schnelle Vorpruefung lokal:

```bash
npm run check:vercel
```

## Produktionsnahe Reihenfolge

1. `.env` aus `.env.example` ableiten und mindestens `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` setzen.
2. Alle Migrationen in `supabase/migrations/` anwenden.
3. Alle Functions in `supabase/functions/` deployen.
4. Secrets setzen: mindestens `SUPABASE_SERVICE_ROLE_KEY`.
5. Fuer spaetere Testnet-/Live-Ausfuehrung `BINANCE_API_KEY`, `BINANCE_API_SECRET`, `BINANCE_TESTNET=true` und optionale Ops-Secrets setzen.
6. Erst Paper Trading, dann Dry-Run Execution, dann Testnet, erst danach echtes Live.

## Operative Gates vor Live-Kapital

- Monitoring ohne kritische Alerts
- mindestens ein erfolgreicher Orchestrator-/Scheduler-Zyklus
- aktuelle Regime- und Meta-Allokationsdaten
- persistierte Champion/Challenger- und Lifecycle-Entscheidung
- Dry-Run und anschliessend Testnet-Execution erfolgreich validiert

## Testnet Gate

Vor Binance Testnet sollte Sephiroth mindestens folgendes sauber anzeigen:

- Research-Basis und persistiertes Tournament vorhanden
- Paper-Historie mit mehreren Trades statt nur leerer Dummy-Portfolios
- Dry-Run-Execution ohne aktuelle Blocker
- Scheduler-/Orchestrator-Loop und Meta-Allokation vorhanden
- keine kritischen Alerts offen
- Binance Testnet Keys nur serverseitig in Supabase Secrets

Wenn `BINANCE_API_KEY`, `BINANCE_API_SECRET` und `BINANCE_TESTNET=true` serverseitig gesetzt sind, meldet die Execution-Schicht den Modus `testnet-dry-run`.

## Noch offen fuer echtes Production-Live

- echter Cron/Scheduler ausserhalb der UI
- verifizierte Testnet-/Live-Brokerausfuehrung
- Security- und Ops-Abnahme mit echten Secrets
- laengere End-to-End-Tests unter realer Last
