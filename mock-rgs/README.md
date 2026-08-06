# Forest Gang mock RGS

Local stand-in for the RGS backend. All paths below are relative to the repo root.

## Run

```bash
pnpm mock-rgs          # or: node ./mock-rgs/server.mjs
```

It listens on two ports at once:

| Port | Protocol | Use for |
| ---- | -------- | ------- |
| 8788 | http     | local dev — **this is the one you want** |
| 8787 | https    | self-signed cert; only needed when the game is served over https |

Health checks:

- `http://localhost:8788/health`
- `https://localhost:8787/health` (browser will warn about the self-signed cert)

Override with `PORT` / `HTTP_PORT` if either is taken.

## Run the UI

```bash
pnpm run dev --filter=forest-gang
```

Then open:

```txt
http://localhost:3001/?sessionID=test&rgs_url=localhost:8788&lang=en&device=desktop
```

Use `rgs_url=localhost:8788`, not 8787. `rgsFetcher` talks plain HTTP to a
localhost RGS whenever the page itself is on insecure `http://` (see
`packages/rgs-fetcher/src/rgsFetcher.ts`), so pointing it at the HTTPS-only
port 8787 fails to connect. Port 8787 is for the case where the game is
served over https — accept the cert warning at
`https://localhost:8787/health` once before loading the game.

Modes:

- BASE = normal spins
- BONUS = Deal It buy
- SUPER = All In buy

Replay example:

```txt
http://localhost:3001/?replay=true&rgs_url=localhost:8788&game=0_0_forest_gang&version=1&mode=BONUS&event=1&amount=1000000
```
