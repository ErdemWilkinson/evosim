# Evosim

An open-ended evolution simulation starting from a microorganism. Over time,
creatures gain new organs through mutation, reproduce, hunt/are hunted, and
accumulate an observable evolutionary history along their lineage trees.
There is no fixed "evolutionary tree" order — which organ appears when, and
which ones spread versus die out, depends entirely on the actual state of
the population/environment. An AI-assisted evolution simulation.

## Setup and running

```bash
npm install
npm run dev
```

Opens at `http://localhost:5173` in the browser (the address Vite shows).

### Gemini API key (optional)

The lineage analysis ("Analyze this lineage") feature uses the Google Gemini
API. The rest of the simulation works fine without it — the key is only
needed for this one feature.

If you want to use it, create a `.env` file at the project root and add your
own key like this:

```
GEMINI_API_KEY=your-own-key
```

The key is used only server-side (Vite dev-server middleware) and is never
sent to the browser.

## Other commands

```bash
npm run build    # production build (dist/)
npm run preview  # preview the build locally
```

## Core features

- **Open-ended organ system**: organs gained through mutation (20+ types
  including movement, sensing, feeding, defense, respiration, and
  planet-specific organs) become part of the genome and have a real,
  measurable mechanical effect.
- **Lineage tree**: a full-page view with zoom/pan support, showing each
  individual's parent/child relationships and organ-acquisition history.
- **World events**: climate waves, wind, earthquakes, meteors — both
  automatic and manually triggerable, genuinely affecting the
  population/food balance.
- **Deterministic planet generation**: an atmosphere/biomass summary derived
  from the map seed determines which planet-specific organs are possible on
  that planet.
- **Save/load + export/import**: automatic localStorage save, plus the
  ability to download/upload as a JSON file.
