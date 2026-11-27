# DESIGN.md: Who Wants to Be a Humanities Giant (v2)

The visual, motion and sound direction. Used only for UI slices (SPEC.md section 11, slice 10). It never overrides SPEC.md or AGENTS.md. Where an installed skill disagrees with this file on palette, type or layout, this file wins; skills guide craft, not identity.

Everything here is original. No colours, shapes, logos, fonts or audio copied from any existing game show or fan clone.

## 1. Identity: "The Colossus"

A dark hall at night with one giant statue lit from above. Scale, stone and ink. The humanities (English, Economics, Government, Literature) live in libraries, lecture halls and monuments, so the show feels like a monumental reading room that has been turned into a stage.

- Feels like: a spotlight on carved stone, a printed page held up to a lamp, an oversized number looming over the question.
- Does not feel like: a casino, a neon quiz app, a school worksheet, or the original show's navy-and-gold stage.

Three signature moves, used consistently:
1. **One spotlight.** A warm cone of light from the top centre falls on the question. Everything else sits in shadow.
2. **The giant numeral.** The question number is set huge, low-contrast, behind the question text.
3. **Slab answers.** Answer options are flat rectangular slabs with a square letter block on the left (A, B, C, D), not hexagons or pills.

## 2. Colour tokens (starting values: tune by eye in the browser, then lock them)

Define once as Tailwind theme tokens. No raw hex values in components.

| Token | Value | Use |
|---|---|---|
| `ink` | `#12100E` | Page background (warm near-black) |
| `slab` | `#1E1B18` | Panels, answer slabs |
| `slab-raised` | `#2A2622` | Hover, raised surfaces |
| `rule` | `#3A352F` | Thin dividing lines |
| `bone` | `#F2EBDD` | Main text |
| `bone-muted` | `#A39B8B` | Secondary text, labels |
| `ember` | `#FF5A36` | Brand accent: selected, focus, the spotlight edge |
| `jade` | `#2FCB97` | Correct |
| `rose` | `#E5365D` | Wrong |
| `brass` | `#C9A15A` | Money amounts and milestones only (a muted brass, not bright gold) |

- Ember is the selected state, and it is also the brand colour. Rose is only for "wrong" and is always paired with a cross icon and the word "Wrong".
- Check every text and background pairing against WCAG AA (4.5:1 for body text) with a contrast checker before locking the tokens.
- Subject labels (English, Economics, Government, Literature) are set in small caps text only, with no per-subject colours.

## 3. Typography

- **Display** (question number, headlines, money): a high-contrast serif with character. Starting choice: Fraunces (variable). Used large, in caps for headlines, with tabular numbers for money.
- **Body and UI** (options, labels, buttons): a clean grotesk. Starting choice: Instrument Sans.
- Load both with `next/font` and give each a real fallback stack. Read the `next/font` page in the Next.js docs.
- Money is always the display serif with tabular numerals and the naira sign.
- Never more than two typefaces.

## 4. Texture and shape

- A very subtle film grain over `ink` (low opacity, static, no animation).
- Thin `rule` lines like book-page rules between sections.
- Corners: nearly square (2px radius). Slabs have a 3px `ember` left edge when selected.
- No gradients except the spotlight cone and a soft vignette.

## 5. Layout per screen

**Contestant and audience screen (mobile first, works at 360px):**
- Top: subject label (small caps), the countdown as a thin bar that drains (not a circle), and the amount at stake in brass.
- Centre: the giant numeral behind the question text, inside the spotlight cone.
- Below: four slabs stacked on mobile, 2 by 2 on wide screens, each with its letter block.
- Lifelines: three buttons above the slabs, used ones struck through with the text "Used".
- Ladder: a side panel on desktop, a collapsible drawer on mobile; milestones (Q5, Q10) in brass with "Guaranteed".

**Waiting room:** dark hall, one dim spotlight, the join code set huge in the display serif, names appearing one by one.

**Host screen:** plain and functional. Big buttons for Reveal, Next and End. No heavy animation.

**Final result:** the winnings count up in the display serif; the last question and its correct slab are shown if the game ended with a reveal.

## 6. Motion: two registers

**Register A: interface motion (agent-built, follows the installed animation skill):** short, purposeful, ease-out curves, transform and opacity only, press feedback on buttons, nothing that blocks the user. Respect `prefers-reduced-motion` everywhere by replacing movement with simple fades.

**Register B: show moments (written by hand with GSAP, not delegated):**

| Moment | Behaviour |
|---|---|
| Question appears | Spotlight eases in, the giant numeral fades up, the question block (all its text at once) fades in and rises 8px, starting when the numeral begins and finishing within 900ms. No text splitting. |
| Slab selected | Letter block fills `ember`, soft pulse on the edge |
| Lock in | A brief hold: the other slabs dim, the spotlight tightens |
| Suspense | The host controls the pause. The UI holds still and a low tone sustains |
| Correct | The slab flashes, turns `jade`, the ladder steps up, money counts up in brass |
| Wrong | The picked slab turns `rose`, the correct one lights `jade` |
| 50:50 | The two removed slabs slide down 12px into their muted 'Removed' look over 350ms |
| Countdown | The bar drains; the last 5 seconds pulse `rose` with a tick |
| Final result | Winnings count up; the headline reveals line by line |

## 7. Sound (original or royalty-free only)

| Moment | Sound |
|---|---|
| Waiting room | Low ambient hall tone, looped |
| Question shown | Short low stinger |
| Final 5 seconds | Soft ticking |
| Lock in | Heavy low hit |
| Correct | Bright rising sting |
| Wrong | Low drop |
| Milestone | Longer celebratory sting |

- Silent until the user's first tap (browsers block autoplay). A mute toggle on every screen, remembered per device.
- `public/audio/CREDITS.md` lists the source and licence of every file.

## 8. Accessibility (non-negotiable)

- Meaning is never carried by colour alone: correct, wrong, selected, removed and used always have an icon and text.
- Visible focus rings in `ember`. Tap targets at least 44px.
- Contrast AA or better on every pairing.
- `prefers-reduced-motion` honoured, sound off by default, and nothing flashes more than 3 times per second.

## 9. Rules for UI slices

- A UI slice may touch presentation files only. Never game logic, server actions, migrations or the safe public-state reader.
- Colours, fonts and spacing come from the theme tokens, never raw values.
- Components render state; they never decide game rules, and they never receive more data than they show (no answer, no hint truth, no vote rows).
- If a skill's instructions conflict with AGENTS.md, SPEC.md or this file, follow those and report the conflict.

## 10. Reference screenshots

Add your own in `design-reference/` and list them with a one-line note on what to take from each (layout, timing, lighting). They are for layout and timing only.

- `question-screen.png`:
- `reveal-answer.png`:
- `show-vibe.png`:
- `total-prize.png`:
- `answer-reveal.png`:
- `selected-answer.png`:
- `prize-ladder.png`:
- `full-round.png`:
- `question.png`:
- `entry.png`:
- `detailed-question-screen.png`: