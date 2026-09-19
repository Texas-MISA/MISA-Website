# ui-ux-pro-max — raw lookups for the leaderboard (`/portal/leaderboard`)

Run 2026-09-19 by `/design-brief portal-leaderboard`, step 3. Lookups only (`search.py … --domain`); never `--design-system` or `--persist`. Every query and its unedited output, in the order run; dispositions are in `evidence.md`.

### $ python .claude/skills/ui-ux-pro-max/scripts/search.py "data table mobile responsive" --domain ux
```
## UI Pro Max Search Results
**Domain:** ux | **Query:** data table mobile responsive
**Source:** ux-guidelines.csv | **Found:** 3 results

### Result 1
- **Category:** Responsive
- **Issue:** Table Handling
- **Platform:** Web
- **Description:** Tables can overflow on mobile
- **Do:** Use horizontal scroll or card layout
- **Don't:** Wide tables breaking layout
- **Code Example Good:** overflow-x-auto wrapper
- **Code Example Bad:** Table overflows viewport
- **Severity:** Medium

### Result 2
- **Category:** Responsive
- **Issue:** Mobile First
- **Platform:** Web
- **Description:** Design for mobile then enhance for larger
- **Do:** Start with mobile styles then add breakpoints
- **Don't:** Desktop-first causing mobile issues
- **Code Example Good:** Default mobile + md: lg: xl:
- **Code Example Bad:** Desktop default + max-width queries
- **Severity:** Medium

### Result 3
- **Category:** Responsive
- **Issue:** Viewport Meta
- **Platform:** Web
- **Description:** Set viewport for mobile devices
- **Do:** Use width=device-width initial-scale=1
- **Don't:** Missing or incorrect viewport
- **Code Example Good:** <meta name='viewport'...>
- **Code Example Bad:** No viewport meta tag
- **Severity:** High

```

### $ python .claude/skills/ui-ux-pro-max/scripts/search.py "sticky table header" --domain ux
```
## UI Pro Max Search Results
**Domain:** ux | **Query:** sticky table header
**Source:** ux-guidelines.csv | **Found:** 2 results

### Result 1
- **Category:** Responsive
- **Issue:** Table Handling
- **Platform:** Web
- **Description:** Tables can overflow on mobile
- **Do:** Use horizontal scroll or card layout
- **Don't:** Wide tables breaking layout
- **Code Example Good:** overflow-x-auto wrapper
- **Code Example Bad:** Table overflows viewport
- **Severity:** Medium

### Result 2
- **Category:** Navigation
- **Issue:** Sticky Navigation
- **Platform:** Web
- **Description:** Fixed nav should not obscure content
- **Do:** Add padding-top to body equal to nav height
- **Don't:** Let nav overlap first section content
- **Code Example Good:** pt-20 (if nav is h-20)
- **Code Example Bad:** No padding compensation
- **Severity:** Medium

```

### $ python .claude/skills/ui-ux-pro-max/scripts/search.py "number alignment tabular figures" --domain ux
```
## UI Pro Max Search Results
**Domain:** ux | **Query:** number alignment tabular figures
**Source:** ux-guidelines.csv | **Found:** 1 results

### Result 1
- **Category:** Content
- **Issue:** Number Formatting
- **Platform:** All
- **Description:** Format large numbers for readability
- **Do:** Use thousand separators or abbreviations
- **Don't:** Long unformatted numbers
- **Code Example Good:** 1.2K or 1,234
- **Code Example Bad:** 1234567
- **Severity:** Low

```

### $ python .claude/skills/ui-ux-pro-max/scripts/search.py "font size readability distance" --domain ux
```
## UI Pro Max Search Results
**Domain:** ux | **Query:** font size readability distance
**Source:** ux-guidelines.csv | **Found:** 3 results

### Result 1
- **Category:** Responsive
- **Issue:** Readable Font Size
- **Platform:** All
- **Description:** Text must be readable on all devices
- **Do:** Minimum 16px body text on mobile
- **Don't:** Tiny text on mobile
- **Code Example Good:** text-base or larger
- **Code Example Bad:** text-xs for body text
- **Severity:** High

### Result 2
- **Category:** Typography
- **Issue:** Font Size Scale
- **Platform:** All
- **Description:** Consistent type hierarchy aids scanning
- **Do:** Use consistent modular scale
- **Don't:** Random font sizes
- **Code Example Good:** Type scale (12 14 16 18 24 32)
- **Code Example Bad:** Arbitrary sizes
- **Severity:** Medium

### Result 3
- **Category:** Animation
- **Issue:** Duration Timing
- **Platform:** All
- **Description:** Motion duration depends on distance complexity platform and user context
- **Do:** Use shared motion tokens and test that feedback stays responsive
- **Don't:** Present 150-300ms or any cutoff as a universal requirement
- **Code Example Good:** transition-colors duration-200
- **Code Example Bad:** One duration copied to every transition
- **Severity:** Medium

```

### $ python .claude/skills/ui-ux-pro-max/scripts/search.py "leaderboard ranking gamification" --domain ux
```
## UI Pro Max Search Results
**Domain:** ux | **Query:** leaderboard ranking gamification
**Source:** ux-guidelines.csv | **Found:** 0 results

No matches. This is not a match with an empty value -- the query did not hit the database. Retry with broader/different keywords before falling back to general defaults, and say explicitly that no database match was found if you do fall back.
**Closest known terms:** tracking, notifications
```

### $ python .claude/skills/ui-ux-pro-max/scripts/search.py "long text wrap truncation" --domain ux
```
## UI Pro Max Search Results
**Domain:** ux | **Query:** long text wrap truncation
**Source:** ux-guidelines.csv | **Found:** 3 results

### Result 1
- **Category:** Content
- **Issue:** Truncation
- **Platform:** All
- **Description:** Handle long content gracefully
- **Do:** Truncate with ellipsis and expand option
- **Don't:** Overflow or broken layout
- **Code Example Good:** line-clamp-2 with expand
- **Code Example Bad:** Overflow or cut off
- **Severity:** Medium

### Result 2
- **Category:** Content
- **Issue:** Essential Text Truncation
- **Platform:** All
- **Description:** Headings actions errors safety text and distinguishing names need complete access
- **Do:** Wrap stack resize or provide a visible full-detail path
- **Don't:** Clamp essential meaning only to make cards uniform
- **Code Example Good:** Action label wraps or opens full details
- **Code Example Bad:** Primary action shown only as an unexplained ellipsis
- **Severity:** Critical

### Result 3
- **Category:** Typography
- **Issue:** Line Length
- **Platform:** Web
- **Description:** Long lines are hard to read
- **Do:** Limit to 65-75 characters per line
- **Don't:** Full-width text on large screens
- **Code Example Good:** max-w-prose
- **Code Example Bad:** Full viewport width text
- **Severity:** Medium

```

### $ python .claude/skills/ui-ux-pro-max/scripts/search.py "table caption semantics screen reader" --domain ux
```
## UI Pro Max Search Results
**Domain:** ux | **Query:** table caption semantics screen reader
**Source:** ux-guidelines.csv | **Found:** 3 results

### Result 1
- **Category:** Accessibility
- **Issue:** Screen Reader
- **Platform:** All
- **Description:** Content should make sense when read aloud
- **Do:** Use semantic HTML and ARIA properly
- **Don't:** Div soup with no semantics
- **Code Example Good:** <nav> <main> <article>
- **Code Example Bad:** <div> for everything
- **Severity:** Medium

### Result 2
- **Category:** Forms / Accessibility
- **Issue:** Focusable Error Summary
- **Platform:** Web
- **Description:** An error summary for failed validation complements inline field errors and must be easy to find by keyboard and screen reader users
- **Do:** Place it at the top of the form; move focus to its heading or container after failed submit; link each item to its invalid field; retain inline errors
- **Don't:** Replace inline errors with a visual-only summary or move focus on every blur
- **Code Example Good:** <div role="alert" tabindex="-1" aria-labelledby="error-title"><h2 id="error-title">There is a problem</h2><a href="#email">Enter an email address</a></div>
- **Code Example Bad:** Toast only with no field links or focus target
- **Severity:** High

### Result 3
- **Category:** Responsive
- **Issue:** Table Handling
- **Platform:** Web
- **Description:** Tables can overflow on mobile
- **Do:** Use horizontal scroll or card layout
- **Don't:** Wide tables breaking layout
- **Code Example Good:** overflow-x-auto wrapper
- **Code Example Bad:** Table overflows viewport
- **Severity:** Medium

```

### $ python .claude/skills/ui-ux-pro-max/scripts/search.py "empty state" --domain ux
```
## UI Pro Max Search Results
**Domain:** ux | **Query:** empty state
**Source:** ux-guidelines.csv | **Found:** 3 results

### Result 1
- **Category:** Feedback
- **Issue:** Empty States
- **Platform:** All
- **Description:** Guide users when no content exists
- **Do:** Show helpful message and action
- **Don't:** Blank empty screens
- **Code Example Good:** No items yet. Create one!
- **Code Example Bad:** Empty white space
- **Severity:** Medium

### Result 2
- **Category:** Navigation
- **Issue:** Active State
- **Platform:** All
- **Description:** Current page/section should be visually indicated
- **Do:** Highlight active nav item with color/underline
- **Don't:** No visual feedback on current location
- **Code Example Good:** text-primary border-b-2
- **Code Example Bad:** All links same style
- **Severity:** Medium

### Result 3
- **Category:** Navigation
- **Issue:** Deep Linking
- **Platform:** All
- **Description:** URLs should reflect current state for sharing
- **Do:** Update URL on state/view changes
- **Don't:** Static URLs for dynamic content
- **Code Example Good:** Use query params or hash
- **Code Example Bad:** Single URL for all states
- **Severity:** Medium

```

