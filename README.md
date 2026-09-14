# vps-cron-ui

A dashboard for [vps-cron](../../Rust/vps-cron)'s status server: what is scheduled, what is running, and what failed last night. It is a static single-page app, so there is no second daemon to keep alive next to the scheduler, and nothing to rebuild when a job changes.

The status server is read-only, so this is too. Editing jobs is still `jobs.toml` plus a restart, and running one by hand is still `vps-cron run <name>`.

## What it shows

| Page          | Contents                                                                                                                        |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `/`           | Health, plus one card per job: schedule, next occurrence, last outcome, totals. Filters for failing, running and disabled jobs. |
| `/job/{name}` | One job in full, with its run history and the captured output of each run.                                                      |
| `/history`    | The whole history, newest first, filtered by outcome.                                                                           |

Every page polls on an interval picked in the header (1 s to 1 min, or paused). A failed poll keeps the last values on screen and marks them stale rather than blanking the board, since a network blip is not news.

Every value that changes in place morphs rather than snapping, through [torph](https://torph.lochie.me): countdowns, durations, run counters, outcomes, summaries. It is the polling made legible, since on a board that redraws itself every few seconds the useful signal is which number just moved. Values that never change once drawn are left alone: a run already in the history is keyed and immutable, so only its relative time morphs. Torph honours `prefers-reduced-motion` by default, and keeps a plain copy of each value in the accessibility tree.

Schedules stay on screen exactly as `jobs.toml` writes them, with the reading in the tooltip: `0 15 * * * *` is "every hour, at 15 minutes past", and `0 30 4 * * 1` is "every Sunday at 04:30", since the `cron` crate numbers Sunday as 1. An expression the describer cannot read with certainty gets no description rather than a guess.

One consequence worth knowing when editing the components: a morphing value is laid out on one unbroken line, so it cannot wrap. Free-form text that can be arbitrarily long, a `shell_file` path or a run summary, is therefore cut to a bounded length and faded out at the edge, with the whole value in a `title`.

## Where the API is

The status server answers at the root of `cron.tomplanche.com`: `/health`, `/jobs`, `/jobs/{name}` and `/runs`, with no auth and no CORS headers. `/` and anything else there is a 404, which is where this dashboard goes.

Serving it from that same root is what keeps the whole thing simple. The page and the API are then one origin, so nothing has to be configured and CORS never enters the picture. That is what the empty default in `.env` means:

```
VITE_API_BASE=""
```

It is also why the app's own pages are `/job/{name}` and `/history`, in the singular: a hard reload of `/jobs/atkuzu-daily` would otherwise hit the API and be served JSON instead of the app.

`VITE_API_BASE` says where to fetch the API when it is somewhere else, in dev and in the build alike. A bare host is read as an origin, so `cron.tomplanche.com` and `https://cron.tomplanche.com` mean the same thing. One thing has to be true for that to work from a browser: the API has to answer with `Access-Control-Allow-Origin` for whatever origin this site is served from. It does not today, so the request leaves, the server answers it, and the browser throws the answer away before the page sees it. `curl` is no guide here, since none of this applies to it. The dashboard says as much on screen when it happens, rather than blaming the network.

Adding the header is one block in Caddy, next to whatever already reverse proxies the domain:

```
@dashboard header Origin https://the-dashboard-origin
handle @dashboard {
    header Access-Control-Allow-Origin "{http.request.header.Origin}"
    header Vary Origin
    reverse_proxy 127.0.0.1:8787
}
```

Echoing the origin rather than `*` keeps the allowance to the one site, and `Vary: Origin` keeps a cache from handing that response to everyone else.

## Developing

```
pnpm install
pnpm dev
```

It reads the same `.env` the build does. With `VITE_API_BASE` empty, the dev server proxies `/health`, `/jobs` and `/runs` to `https://cron.tomplanche.com`, so dev looks like production and needs no tunnel. `VPS_CRON_ORIGIN` changes what it targets, for a local scheduler or a tunnelled one:

```
ssh -N -L 8787:127.0.0.1:8787 your-vps
VPS_CRON_ORIGIN=http://127.0.0.1:8787 pnpm dev
```

`pnpm preview` proxies the same way, so the production build can be checked against real data before it goes anywhere.

## Building and serving

```
pnpm build
```

The result is `build/`: about 50 KB of JavaScript and CSS over the wire, no webfonts, no external requests. `.env` is read at build time, not at runtime, so the machine that runs `pnpm build` is the one that needs it set.

Copy `build/` to the VPS and give Caddy the root of the domain, leaving the API's own paths pointed at the scheduler:

```
cron.tomplanche.com {
    @api path /health /jobs /jobs/* /runs /runs/*
    handle @api {
        reverse_proxy 127.0.0.1:8787
    }

    handle {
        root * /srv/vps-cron-ui
        try_files {path} /index.html
        file_server {
            precompressed br gzip
        }
    }
}
```

Every existing consumer of the API keeps working: the paths it answers are unchanged, and the dashboard only fills in the 404 at the root. The `try_files` fallback is what makes `/job/{name}` survive a reload, since there is no file at that path.

Worth knowing: the status server is public and unauthenticated, so everything it returns, including the captured output of every run, is readable by anyone who knows the address. A `basic_auth` block in Caddy fixes that for the dashboard, but it also locks out whatever else already reads those endpoints.

## Tooling

Same setup as [atkuzu](../atkuzu): `oxfmt` formats, `oxlint` covers the plain TypeScript, and ESLint is scoped to `.svelte` files.

```
pnpm format        # oxfmt --write .
pnpm lint          # oxlint . && eslint .
pnpm check         # svelte-check
```

## Layout

| Path                        | Contents                                                                 |
| --------------------------- | ------------------------------------------------------------------------ |
| `src/lib/api.ts`            | The status server's endpoints and payloads, typed after the Rust structs |
| `src/lib/format.ts`         | Relative times, durations, outcome colours                               |
| `src/lib/poll.svelte.ts`    | The polling primitive and the page clock                                 |
| `src/lib/refresh.svelte.ts` | The refresh interval, shared by every page                               |
| `src/lib/components/`       | Tags, job cards, run lists                                               |
| `src/routes/`               | The three pages                                                          |
