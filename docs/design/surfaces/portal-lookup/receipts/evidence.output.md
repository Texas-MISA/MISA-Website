# ui-ux-pro-max — raw lookups for My Attendance (`/portal/lookup`)

Run 2026-09-19 by `/design-brief portal-lookup`, step 3. Lookups only (`search.py … --domain`); never `--design-system` or `--persist`. Every query and its unedited output, in the order run; dispositions are in `evidence.md`.

### $ python .claude/skills/ui-ux-pro-max/scripts/search.py "definition list semantics" --domain web
```
## UI Pro Max Search Results
**Domain:** web | **Query:** definition list semantics
**Source:** app-interface.csv | **Found:** 0 results

No matches. This is not a match with an empty value -- the query did not hit the database. Retry with broader/different keywords before falling back to general defaults, and say explicitly that no database match was found if you do fall back.
**Closest known terms:** lists
```

### $ python .claude/skills/ui-ux-pro-max/scripts/search.py "horizontal scroll table columns mobile" --domain ux
```
## UI Pro Max Search Results
**Domain:** ux | **Query:** horizontal scroll table columns mobile
**Source:** ux-guidelines.csv | **Found:** 3 results

### Result 1
- **Category:** Responsive
- **Issue:** Horizontal Scroll
- **Platform:** Web
- **Description:** Avoid horizontal scrolling
- **Do:** Ensure content fits viewport width
- **Don't:** Content wider than viewport
- **Code Example Good:** max-w-full overflow-x-hidden
- **Code Example Bad:** Horizontal scrollbar on mobile
- **Severity:** High

### Result 2
- **Category:** Responsive
- **Issue:** Table Handling
- **Platform:** Web
- **Description:** Tables can overflow on mobile
- **Do:** Use horizontal scroll or card layout
- **Don't:** Wide tables breaking layout
- **Code Example Good:** overflow-x-auto wrapper
- **Code Example Bad:** Table overflows viewport
- **Severity:** Medium

### Result 3
- **Category:** Navigation
- **Issue:** Smooth Scroll
- **Platform:** Web
- **Description:** Anchor links should scroll smoothly to target section
- **Do:** Use scroll-behavior: smooth on html element
- **Don't:** Jump directly without transition
- **Code Example Good:** html { scroll-behavior: smooth; }
- **Code Example Bad:** <a href='#section'> without CSS
- **Severity:** High

```

### $ python .claude/skills/ui-ux-pro-max/scripts/search.py "stat metric display dashboard" --domain ux
```
## UI Pro Max Search Results
**Domain:** ux | **Query:** stat metric display dashboard
**Source:** ux-guidelines.csv | **Found:** 0 results

No matches. This is not a match with an empty value -- the query did not hit the database. Retry with broader/different keywords before falling back to general defaults, and say explicitly that no database match was found if you do fall back.
**Closest known terms:** state, states, status, stay, that, instant
```

### $ python .claude/skills/ui-ux-pro-max/scripts/search.py "status badge pill meaning" --domain ux
```
## UI Pro Max Search Results
**Domain:** ux | **Query:** status badge pill meaning
**Source:** ux-guidelines.csv | **Found:** 3 results

### Result 1
- **Category:** Accessibility
- **Issue:** Contextual Live Badge Updates
- **Platform:** Web
- **Description:** Async badge and count changes should announce a meaningful contextual status without moving focus
- **Do:** Use one appropriate atomic status message such as 3 items in cart
- **Don't:** Announce a bare number or make every badge a competing live region
- **Code Example Good:** <span role='status' aria-atomic='true'>3 items in cart</span>
- **Code Example Bad:** <span aria-live='polite'>3</span>
- **Severity:** High

### Result 2
- **Category:** Content
- **Issue:** Compact Label Overflow
- **Platform:** All
- **Description:** A badge chip or pill label should stay whole on one line when practical and disclose unavoidable truncation
- **Do:** Bound only unpredictable values; use nowrap with a shrinkable label; expose full text to keyboard pointer and touch users
- **Don't:** Let one compact label wrap to a second line or use a hover-only tooltip
- **Code Example Good:** Flexible label with min-width 0 and an operable full-value disclosure
- **Code Example Bad:** Fixed-width badge wraps to second line or clips with title-only recovery
- **Severity:** High

### Result 3
- **Category:** Forms
- **Issue:** Submit Feedback
- **Platform:** All
- **Description:** Confirm form submission status
- **Do:** Show loading then success/error state
- **Don't:** No feedback after submit
- **Code Example Good:** Loading -> Success message
- **Code Example Bad:** Button click with no response
- **Severity:** High

```

### $ python .claude/skills/ui-ux-pro-max/scripts/search.py "personal data privacy display" --domain ux
```
## UI Pro Max Search Results
**Domain:** ux | **Query:** personal data privacy display
**Source:** ux-guidelines.csv | **Found:** 2 results

### Result 1
- **Category:** Data Entry
- **Issue:** Bulk Actions
- **Platform:** Web
- **Description:** Editing one by one is tedious
- **Do:** Allow multi-select and bulk edit
- **Don't:** Single row actions only
- **Code Example Good:** Checkbox column + Action bar
- **Code Example Bad:** Repeated actions per row
- **Severity:** Low

### Result 2
- **Category:** Sustainability
- **Issue:** Auto-Play Video
- **Platform:** Web
- **Description:** Autoplaying media consumes data and creates motion barriers
- **Do:** Prefer click-to-play; provide pause and captions; stop off-screen and honor reduced motion
- **Don't:** Auto-play high-resolution loops without pause or captions
- **Code Example Good:** <video controls preload="none"><track kind="captions" /></video>
- **Code Example Bad:** autoplay loop
- **Severity:** Medium

```

### $ python .claude/skills/ui-ux-pro-max/scripts/search.py "page heading structure landmarks" --domain ux
```
## UI Pro Max Search Results
**Domain:** ux | **Query:** page heading structure landmarks
**Source:** ux-guidelines.csv | **Found:** 3 results

### Result 1
- **Category:** Performance
- **Issue:** Image Optimization
- **Platform:** All
- **Description:** Large images slow page load
- **Do:** Use appropriate size and format (WebP)
- **Don't:** Unoptimized full-size images
- **Code Example Good:** srcset with multiple sizes
- **Code Example Bad:** 4000px image for 400px display
- **Severity:** High

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
- **Category:** Accessibility
- **Issue:** Heading Hierarchy
- **Platform:** Web
- **Description:** Screen readers use headings for navigation
- **Do:** Use sequential heading levels h1-h6
- **Don't:** Skip heading levels or misuse for styling
- **Code Example Good:** h1 then h2 then h3
- **Code Example Bad:** h1 then h4
- **Severity:** Medium

```

### $ python .claude/skills/ui-ux-pro-max/scripts/search.py "result after search feedback" --domain ux
```
## UI Pro Max Search Results
**Domain:** ux | **Query:** result after search feedback
**Source:** ux-guidelines.csv | **Found:** 3 results

### Result 1
- **Category:** Search
- **Issue:** No Results
- **Platform:** Web
- **Description:** Dead ends frustrate users
- **Do:** Show 'No results' with suggestions
- **Don't:** Blank screen or '0 results'
- **Code Example Good:** Try searching for X instead
- **Code Example Bad:** No results found.
- **Severity:** Medium

### Result 2
- **Category:** Search
- **Issue:** Autocomplete
- **Platform:** Web
- **Description:** Help users find results faster
- **Do:** Show predictions as user types
- **Don't:** Require full type and enter
- **Code Example Good:** Debounced fetch + dropdown
- **Code Example Bad:** No suggestions
- **Severity:** Medium

### Result 3
- **Category:** Touch
- **Issue:** Haptic Feedback
- **Platform:** Mobile
- **Description:** Tactile feedback improves interaction feel
- **Do:** Use for confirmations and important actions
- **Don't:** Overuse vibration feedback
- **Code Example Good:** navigator.vibrate(10)
- **Code Example Bad:** Vibrate on every tap
- **Severity:** Low

```

