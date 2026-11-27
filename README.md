# AMBER Sky

Weather map for drone crews over Ukraine: wind by altitude 10–1000 m, cloud base, icing, and a GO / CAUTION / NO-GO verdict for a specific drone class, with its flight range in the current wind. Built on EU space data (Copernicus ERA5, Galileo).

12th CASSINI Hackathon · team AMBER//404 · challenge 2 «Space-enabled crisis response and civil resilience».

- Spec: [docs/SPEC.md](docs/SPEC.md)
- Agent rules: [AGENTS.md](AGENTS.md)
- Agent pipeline: [docs/PIPELINE.md](docs/PIPELINE.md)

```bash
make setup   # install web + pipeline deps
make check   # lint, types, tests, build, schema checks
make dev     # local web on http://localhost:5173
```
