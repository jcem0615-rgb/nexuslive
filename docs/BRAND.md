# Nexus Live — brand and logo

## The mark

An **N** drawn as a node graph: three white nodes joined by two risers and a
diagonal, with the top-right node replaced by a live indicator in signal pink.
A nexus is a point where connections meet, which is the product in one shape —
and at 48px it still reads as "N with a live dot".

Geometry, on a 512 × 512 canvas:

- Path `M146 372V140l220 232V140`, 32px stroke, round caps and joins.
- Nodes at (146, 140), (146, 372), (366, 372): r=34 white, r=12 inner.
- Live node at (366, 140): r=38 white, r=27 pink gradient.
- Squircle corner radius 116 (22.7%), matching an iOS app icon.

## Files

| File | What it's for |
|---|---|
| `public/logo.svg` | The full mark on its violet squircle. Source for every PNG. |
| `public/logo-mark.svg` | Transparent background, gradient strokes — for dark surfaces. |
| `public/logo-wordmark.svg` | Horizontal lockup, white text, for dark backgrounds. |
| `public/logo-wordmark-light.svg` | Same lockup with ink text, for light backgrounds. |
| `public/icons/icon-maskable.svg` | Glyph at 72% inside a full bleed, for Android's circular crop. |
| `public/og.svg` | 1200 × 630 social card. |
| `src/components/Logo.tsx` | `<Logo />` and `<Wordmark />`, inline SVG, same geometry. |

Everything under `public/icons/*.png`, `public/og.png` and `public/favicon.ico`
is generated. Edit the SVG, then:

```bash
npm run icons
```

## Colour

| Token | Hex | Used for |
|---|---|---|
| `nexus-500` | `#7036ff` | primary actions, the brand violet |
| `nexus-400` | `#8b63ff` | hover, gradient highlight |
| `nexus-700` | `#500fd4` | gradient shadow |
| `live` | `#ff2d6f` | the live state, and only the live state |
| `diamond` | `#38d6ff` | purchased diamonds, everywhere |
| `bean` | `#ffc53d` | beans, everywhere |
| `ink-900` | `#07060f` | page background |

Diamonds are always cyan and beans are always amber, in the wallet, the ledger,
the gift tray and the portal. The two balances are never interchangeable, so
they never share a colour.

Pink is reserved. If something is pink, it is live, or it is a destructive
action.

## Type

System UI stack (`ui-sans-serif, system-ui, -apple-system, …`), set in
`--font-sans`. No webfont, so nothing blocks first paint. Headings are
extrabold with tight tracking; numbers are always `tabular-nums` so balances do
not jitter as they change.

## Voice

Short, concrete, no exclamation marks. "Two balances. They do not mix." —
not "Manage your wallet!". Error messages say what to do next: "Not enough
diamonds. Top up to keep going."
