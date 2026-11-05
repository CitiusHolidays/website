## Task: Citius Journal, Direction A (2026-11-05)

Linked from `FRONTEND-HANDOFF.md` by the coordinator. Local evidence only. Nothing has been committed, deployed or written to Sanity.

### Brief

- **Outcome.** Redesign the public blog (`/blog`, `/blog/[slug]`) as the **Citius Journal**, an editorial travel magazine for Citius Holidays.
  - Audience: pilgrims, and corporate or MICE buyers.
  - Writers: Directors, who post infrequently.
- **Constraints**
  - Few stories, so the index has to look complete with 1 to 6 posts. Sections render only when they have content. No "latest" cadence.
  - Bylines are field-driven: name, then role and office when set. Do not assume every author is a Director (live author "Divyanshu Sharma" has no role).
  - Covers often have the headline baked into the artwork. Never overlay HTML text on a cover, and never crop a cover to a fixed ratio.
  - No eyebrows (rule from `DESIGN.md`).
  - Staff Workspace and Account are untouched.
  - `globals.css` is not edited.
- **Font approval (user, 2026-11-05).** "We can do whatever looks good." This is the explicit product approval for a Journal-only typeface, which `DESIGN.md` §Durable typography requires. It is scoped through `--font-journal` and changes no other surface.
- **Before baseline**
  - Live site, observed by the coordinator: numbered items, "-" date on the lead post, DD/MM/YYYY dates, blank area until the fade-in triggers, empty navy hero on first paint, 16px body, role shown as "Author", no JSON-LD.
  - Local screenshots: `scratchpad/journal/before-*.png`. On the local article the body never appears in a full-page capture, because it waits for `whileInView`.

### Accepted direction

- **Composition: a magazine contents page.** TasteSkill dealt `page-is-the-object`. I kept its idea (the artefact is the printed journal: masthead, lead story, contents, colophon). I rejected its stationery devices (scallops, rotated cards, curtain footer) because the Journal sits inside the shared public header and footer.
  - The masthead stays on `public-night` because the shared header is transparent with white text at the top.
  - Lead story is typographic: a large serif title, the excerpt, the byline, then the meta line. The cover is a "plate" at its native proportions.
  - "More from the Journal" is a list with text on the left and a right-aligned plate.
  - "Earlier stories" archive appears only when there are more than 12 stories.
  - The "Talk to the team" band uses the existing `PublicContactCta`.
- **Type.** Newsreader (variable, with an optical-size axis, normal and italic) for the masthead, titles and body. Inter stays for meta and UI. The shared chrome stays Poppins/Inter.
  - Why: a reading serif suits a journal and holds at 20px body and at 120px display sizes.
  - Rejected: TasteSkill's dealt Bebas Neue/EB Garamond, which fights the Poppins brand voice.
  - Tells risk noted: "serif as premium shortcut". Here the serif is justified by the artefact and by long reading.
- **Colour.** Existing public tokens only: paper ground, ink text, night bands, blue links, orange-ink markers. Running text is full ink.
- **Motion.** None on reading content. No entrance or scroll gating. Feedback only: colour on links, a 1-unit arrow nudge gated by `fine-hover` with `motion-reduce:transition-none`, and the existing CTA press scale of 0.98. Follows `docs/TRANSITION_POLICY.md`.
- **Targets.** Back links are at least 44px tall (`min-h-11`). Story entries use a stretched link, so there is one tab stop per story.

### Pass 0: Brief and contract (2026-11-05)

- **Skills:** `frontend-aio` (`~/.agents/skills/frontend-aio/SKILL.md`), plus `references/{skill-sets,context-and-findings,routing §1 §10,taste-skill,design-workflow}.md`.
- **Scope:** `src/app/(public)/blog/**`, `src/components/blog/**`, `src/app/sitemap.js`, `citius-blog/schemaTypes/**`.
- **Findings from verifying the coordinator's list (observed in source):**
  - Body is 16px muted text, confirmed.
  - The author block came before the article, with the bio before the body, confirmed.
  - The gradient title used `#9B9B9B`, confirmed.
  - The cover and body sat behind `whileInView`, confirmed.
  - The article page was entirely a client component, confirmed.
  - Inline image alt was "Blog image", confirmed.
  - The index showed only 12 posts with no archive, confirmed.
  - Categories were not clickable, confirmed.
  - The nav said "Blog", confirmed.
  - There was no JSON-LD, confirmed.
  - `/blog` was missing from the sitemap, confirmed.
  - Reading time was `ceil(blocks/40)`, confirmed.
  - `DESIGN.md` and `docs/PUBLIC_VISUAL_IDENTITY.md` cite the deleted `src/app/publicVisualIdentity.contract.test.ts` (removed in 9e09ad25), confirmed. This is reported, not fixed: out of scope.
  - "Hotspot crop unused": partly true. The old code passed the image object, so the crop rect applied, but nothing used fixed-ratio hotspot crops.

### Pass 1: Inspiration: not applicable, beyond the TasteSkill library deal

There was no network asset search. The study references printed on the direction sheet were used as principles only.

### Pass 2: Taste and design direction (2026-11-05)

- **Skills:** `design-taste-frontend` page run (SKILL.md and `references/type.md`; headings of `tells.md`, `layout.md`, `colour.md` and `copy.md`), using `draw.mjs --sector hospitality --tone editorial --keep palette --have photography --options 3`. Directions dealt: `page-is-the-object`, `uneven-photographs`, `name-as-monument`. I chose the first (seed 1829972794).
- **Decisions:** as recorded in the Accepted direction.
- **House rules applied:** no eyebrows, no index numbers (removed 01 to 06), no hairline rows, no gradients.
- **Exceptions:**
  - Plates keep the existing `.public-media-edge` radius and shadow token.
  - CMS titles can run to 3 or 4 lines on a phone, which breaks the 2-line rule. The text is editor-owned.
- **Not run:** `inspect.mjs` and `lint.mjs` were not run. I used Playwright screenshots and metrics instead.

### Pass 3: Layout (better-layout)

- One left edge per page:
  - Index: masthead and content share `max-w-7xl` padding. A misalignment of 80px against 112px was found and fixed.
  - Article: header, cover and "More" share `max-w-5xl`. The body is a centred 39rem column.
- Sections render only when they have posts. With one story the index shows the masthead, the lead and the CTA.
- At 390px there is no horizontal overflow, and none at a 20px root font size either.

### Pass 4: Typography and colour (better-typography, better-colors)

- **Body (measured):** Newsreader at 20px on desktop and 18px on a phone, line height 1.6, full ink.
  - About 67 characters per line at 1440px and 42 at 390px.
  - Before: 16px muted.
- **Dates:** "2 August 2026", in Asia/Kolkata time.
- **Reading time:** words ÷ 220, minimum 1 minute. The live posts come out at 1 to 3 minutes.
- **Title:** solid white.
- **Meta and secondary copy:** `text-public-muted` on paper, `white/75` and above on night.

### Pass 5: Accessibility (better-accessibility, WCAG 2.2 AA)

- **Keyboard walk (Playwright, reduced motion):**
  - Index: 6 story links, each with a visible 2px orange-ink ring around the whole entry, then the CTA.
  - Article: breadcrumb, back link, 2 "More" links, CTA.
  - Evidence: `after-focus-contents-1440.png`.
- **Semantics:**
  - A single `h1` per page. A body `h1` renders as `h2`, and an opening heading that repeats the title is dropped.
  - Breadcrumb `nav`.
  - The shared chrome supplies `<main>`, so the Journal does not add a second one.
- **Alt text:**
  - Article cover: editor alt, then caption, then title.
  - Index plates: editor alt, else empty, because the title link names the story.
  - Inline images: alt, then caption, then title, with a `figcaption`.

### Pass 6: Writing (better-writing)

- **Masthead line:** "Field notes from the directors and planners of Citius Holidays…" It addresses both audiences.
- **CTA:** "Talk to the team". The office cities come from the site metadata.
- **Empty state:** "The first story is on its way".
- **Labels:** removed "Read the latest story", "Recent stories" and the story count, which created cadence pressure.

### Pass 7: Motion (animate, TRANSITION_POLICY)

Scroll and entrance motion is removed from reading content, by decision. Reduced-motion captures (`after-reduced-*.png`) match the normal captures.

### Pass 8: Implement

- **Files**
  - New `src/components/blog/`: `journalContent.js` (pure helpers), `journalFont.js`, `JournalByline.js`, `JournalMeta.js`, `JournalPlate.js`, `JournalPortableText.js`, `JournalJsonLd.js`, `JournalTalkToTeam.js`.
  - Pages are now server components. Both `page.client.js` files were deleted.
  - Also changed: `src/app/sitemap.js`, and `citius-blog/schemaTypes/{post,author,blockContent}.js`.
- **Schema fields (all optional, with Studio warnings):**
  - `post.excerpt`.
  - `post.mainImage.alt`.
  - `post.publishedAt` (warning only).
  - `post.relatedTrail`: a trail slug, linked only when `getTrailBySlug` finds a published or comingSoon trail.
  - `blockContent` image `alt` and `caption`.
  - `author.role` and `author.office`, offered as a list: Mumbai & Thane, Bengaluru, Kolkata.
  - `author.image.alt`.
  - Validated with `sanity schema validate`: 0 errors, 0 warnings.
- **Tests:** `src/components/blog/journalContent.test.js` (26) and `src/app/sitemap.test.js` (2).
- **Nav label: blocked.** Renaming "Blog" to "Journal" in `Header.js` wraps "Spiritual Trails" and "Let's Talk" onto two lines at every desktop width, because the header is capped at 1200px. I measured this at 1280, 1366, 1440 and 1600, then reverted the label.
  - Measured fix: `whitespace-nowrap` on the header nav controls (`SpiritualTrailsDropdown`, `PublicContactCta` in the header). Injected-CSS test at 1280px: single line, no overflow.
  - Owner: header code, outside this write scope.

### Pass 9: Verify (final source, dev server on :3417)

- **Commands**
  - `bun test` on the blog helpers, the sitemap and the cache contract: 35 pass, 0 fail.
  - `tsc` (native): 0 errors.
  - `ultracite check` on my files: clean.
  - `oxlint`: clean.
  - React Doctor (`--scope changed`): no issues.
- **Rendered checks**
  - JSON-LD `BlogPosting` and `BreadcrumbList` are present.
  - `/sitemap.xml` contains `/blog`.
  - First paint shows the title and cover with no gating.
  - Screenshots: `after-{index,article}-{1440,390}-{fold,full}.png`.
- **Unverified**
  - Rendering of the bio, related trail, standfirst, categories and archive: no live data exercises them. They are covered by unit-level helpers only.
  - The production build.
  - The Studio UI itself.

### Pass 10: Review

- Self-critique against the direction: the masthead and lead now read as a magazine opening, and the covers are no longer cropped.
- **Open: lead-title height.** On a phone the lead title is 4 lines. Owner: content. A shorter title or an editor-written excerpt helps.
- **Open: overlapping widget.** The site-wide "Plan with Concierge" chip overlaps the plates. Owner: public chrome.
- **Observation:** body copy outside the Journal computes to the system font, not Inter. This is pre-existing and site-wide.
