# DESIGN.md: Who Wants to Be a Humanities Giant

Visual and motion direction. Used only from the UI slices (SPEC.md section 11, slice 7 onward). It never overrides
SPEC.md or AGENTS.md.

Everything here is original. Do not copy code, images, logos, fonts or audio from any existing game show or fan clone.
References are for layout and timing ideas only.

## 1. Mood

A TV studio at night. Dark stage, one spotlight on the question, tension built through slow pacing and glow, not
clutter. Confident, a little dramatic, never childish.

- Feels like: stage lighting, a hot seat, held breath before a reveal.
- Does not feel like: a school quiz, a casino, a cartoon.

## 2. Colour (placeholders: change to your taste)

| Role       | Value                                           | Use                                     |
|------------|-------------------------------------------------|-----------------------------------------|
| Background | deep navy, near black (`#070a1f`)               | Page and stage                          |
| Stage glow | indigo/violet gradient (`#1b1464` to `#070a1f`) | Radial light behind the question        |
| Surface    | dark blue (`#101a4a`)                           | Answer buttons, panels                  |
| Accent     | gold (`#f5b63a`)                                | Money, selected state, ladder highlight |
| Selected   | orange (`#ff8a1f`)                              | Answer chosen but not locked            |
| Correct    | green (`#22c55e`)                               | Reveal: right answer                    |
| Wrong      | red (`#ef4444`)                                 | Reveal: wrong answer                    |
| Text       | off-white (`#eef1ff`)                           | Main text                               |
| Muted text | blue-grey (`#8b93c0`)                           | Labels, hints                           |

Define these as Tailwind theme tokens once. Never hard-code hex values in components.

## 3. Typography

- Display (question, money): _pick one bold, wide display font_
- Body (options, labels): _pick one clean sans_
- Money always uses tabular numbers and the naira sign.

## 4. Layout per screen

**Contestant / audience screen (landscape-first, works on phone portrait):**

- Top: subject label and a countdown ring.
- Centre: the question in a wide, angled panel with a glowing border.
- Below: four answer buttons in a 2 x 2 grid, each labelled A, B, C, D.
- Side (desktop) or collapsible (mobile): money ladder, current question highlighted in gold, milestones (Q5, Q10)
  marked.
- Lifelines: three icon buttons in a row. Spent ones are greyed with a strike.

**Waiting room:** dim stage, slow ambient glow, live list of joined names appearing one by one, the join code displayed
large.

**Host control screen:** plain and functional. Big clear buttons for Reveal, Next, End. It is not a show screen, so no
heavy animation.

**Results:** final winnings counting up, then a short recap.

## 5. Motion and timing (the "show" feel)

| Moment           | Behaviour                                                                                 |
|------------------|-------------------------------------------------------------------------------------------|
| Question appears | Panel slides/fades in, then the four options appear one at a time (A to D, short stagger) |
| Answer selected  | Button turns orange with a soft pulse                                                     |
| Lock in          | Brief freeze (no other button reacts), glow tightens                                      |
| Suspense pause   | Hold for a beat before reveal. Host-triggered, so no fixed delay in the UI                |
| Correct reveal   | Selected button flashes then turns green, ladder steps up                                 |
| Wrong reveal     | Selected button turns red, correct one turns green                                        |
| 50:50            | Two wrong options fade out                                                                |
| Countdown        | Ring drains. Last 5 seconds turn red and pulse                                            |
| Money gain       | Amount counts up in gold                                                                  |

Respect `prefers-reduced-motion`: replace animations with simple fades.

## 6. Sound (original or royalty-free only)

| Moment                     | Sound                    |
|----------------------------|--------------------------|
| Waiting room               | Low ambient loop         |
| Question shown             | Short stinger            |
| Countdown, final 5 seconds | Ticking                  |
| Lock in                    | Low hit                  |
| Correct                    | Bright rising sting      |
| Wrong                      | Low drop                 |
| Milestone reached          | Longer celebratory sting |

- Sound is off until the user interacts (browsers block autoplay). Provide a mute toggle on every screen.
- Keep a list in `public/audio/CREDITS.md` of each file's source and licence.

## 7. Reference screenshots

All images and the ones listed below in `design-reference/` folder.

- `question-screen.png`:
- `answer-reveal.png`:
- `reveal-answer.png`:
- `show-vibe.png`:
- `total-prize.png`:
- `reveal-wrong.png`:
- `selected-answer.png`:
- `prize-ladder.png`:

## 8. Rules for the UI slices

- Use Tailwind theme tokens, not raw colours.
- Animation lives in small reusable pieces. Components render state, they do not decide game rules.
- Accessible: visible focus states, sufficient contrast, answers never rely on colour alone (also show a tick or cross
  on reveal).