## What this adds

<!-- One or two sentences. -->

## How to try it

1. Download `obsidian-pteroext-<sha>` from this PR's **CI** run (Checks → CI → Artifacts) and unzip it once; inside is the `.pteroext`.
2. `php artisan p:extension:install obsidian-x.y.z.pteroext --replace --enable`, then reload the browser.
3. <!-- Where to click to see the change. -->

## Checklist

- [ ] CI is green (typecheck, tests, build, pack)
- [ ] New screens are listed in `extension.json` and registered in `src/theme.tsx`
- [ ] Works in dark and light, and at phone width
