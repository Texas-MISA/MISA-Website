# ui-ux-pro-max — raw lookups for the portal hub (`/portal`)

Run 2026-09-19 by `/design-brief portal-hub`, step 3. Lookups only (`search.py … --domain` / `--stack`); never `--design-system` or `--persist`. Every query and its unedited output, in the order run; dispositions are in `evidence.md`.

### $ python .claude/skills/ui-ux-pro-max/scripts/search.py "touch target size mobile" --domain ux
```
## UI Pro Max Search Results
**Domain:** ux | **Query:** touch target size mobile
**Source:** ux-guidelines.csv | **Found:** 3 results

### Result 1
- **Category:** Touch
- **Issue:** Touch Target Size
- **Platform:** Mobile
- **Description:** Touch target guidance depends on platform and web context
- **Do:** Use 44pt on iOS and 48dp on Android; for web use the separate WCAG Target Size rule
- **Don't:** Treat one unit or minimum as universal across platforms
- **Code Example Good:** iOS 44pt; Android 48dp; Web 24 CSS px plus WCAG exceptions
- **Code Example Bad:** w-6 h-6 buttons
- **Severity:** High

### Result 2
- **Category:** Touch
- **Issue:** Touch Spacing
- **Platform:** Mobile
- **Description:** Adjacent touch targets need adequate spacing
- **Do:** Minimum 8px gap between touch targets
- **Don't:** Tightly packed clickable elements
- **Code Example Good:** gap-2 between buttons
- **Code Example Bad:** gap-0 or gap-1
- **Severity:** Medium

### Result 3
- **Category:** Responsive
- **Issue:** Touch Friendly
- **Platform:** Web
- **Description:** Mobile layouts need touch-sized targets
- **Do:** Increase touch targets on mobile
- **Don't:** Same tiny buttons on mobile
- **Code Example Good:** Larger buttons on mobile
- **Code Example Bad:** Desktop-sized targets on mobile
- **Severity:** High

```

### $ python .claude/skills/ui-ux-pro-max/scripts/search.py "clickable card whole row link" --domain ux
```
## UI Pro Max Search Results
**Domain:** ux | **Query:** clickable card whole row link
**Source:** ux-guidelines.csv | **Found:** 1 results

### Result 1
- **Category:** Content
- **Issue:** Compact Label Overflow
- **Platform:** All
- **Description:** A badge chip or pill label should stay whole on one line when practical and disclose unavoidable truncation
- **Do:** Bound only unpredictable values; use nowrap with a shrinkable label; expose full text to keyboard pointer and touch users
- **Don't:** Let one compact label wrap to a second line or use a hover-only tooltip
- **Code Example Good:** Flexible label with min-width 0 and an operable full-value disclosure
- **Code Example Bad:** Fixed-width badge wraps to second line or clips with title-only recovery
- **Severity:** High

```

### $ python .claude/skills/ui-ux-pro-max/scripts/search.py "entrance animation delay content" --domain ux
```
## UI Pro Max Search Results
**Domain:** ux | **Query:** entrance animation delay content
**Source:** ux-guidelines.csv | **Found:** 3 results

### Result 1
- **Category:** Touch
- **Issue:** Tap Delay
- **Platform:** Mobile
- **Description:** 300ms tap delay feels laggy
- **Do:** Use touch-action CSS or fastclick
- **Don't:** Default mobile tap handling
- **Code Example Good:** touch-action: manipulation
- **Code Example Bad:** No touch optimization
- **Severity:** Medium

### Result 2
- **Category:** Animation
- **Issue:** Auto-Rotating Content Controls
- **Platform:** All
- **Description:** Auto-rotating content needs user control
- **Do:** Provide previous next and play/pause; stop on focus or hover and when reduced motion is requested
- **Don't:** Auto-advance slides without a stop control
- **Code Example Good:** button aria-label="Pause carousel"
- **Code Example Bad:** timer-only carousel
- **Severity:** High

### Result 3
- **Category:** Animation
- **Issue:** Continuous Animation
- **Platform:** All
- **Description:** Infinite animations are distracting
- **Do:** Use for loading indicators only
- **Don't:** Use for decorative elements
- **Code Example Good:** animate-spin on loader
- **Code Example Bad:** animate-bounce on icons
- **Severity:** Medium

```

### $ python .claude/skills/ui-ux-pro-max/scripts/search.py "focus visible keyboard navigation" --domain ux
```
## UI Pro Max Search Results
**Domain:** ux | **Query:** focus visible keyboard navigation
**Source:** ux-guidelines.csv | **Found:** 3 results

### Result 1
- **Category:** Accessibility
- **Issue:** Keyboard Navigation
- **Platform:** Web
- **Description:** Web users need complete keyboard navigation with visible focus on every operable control
- **Do:** Keep tab order aligned with visual order and test every action without a pointer
- **Don't:** Keyboard traps or illogical tab order
- **Code Example Good:** tabIndex for custom order
- **Code Example Bad:** Unreachable elements
- **Severity:** High

### Result 2
- **Category:** Interaction
- **Issue:** Focus States
- **Platform:** All
- **Description:** Keyboard focus, including controls inside a modal, needs a visible indicator
- **Do:** Use a visible focus ring on every interactive control, including modal controls
- **Don't:** Remove focus outline without replacement
- **Code Example Good:** focus:ring-2 focus:ring-blue-500
- **Code Example Bad:** outline-none without alternative
- **Severity:** High

### Result 3
- **Category:** Accessibility
- **Issue:** Focus Not Obscured (Enhanced)
- **Platform:** Web
- **Description:** WCAG 2.2 AAA requires keyboard focus to remain fully visible
- **Do:** Keep the entire focused component unobscured by author-created content
- **Don't:** Present this enhanced AAA criterion as an AA requirement or allow persistent UI to hide any part of focus
- **Code Example Good:** close persistent overlay before focus moves behind it
- **Code Example Bad:** sticky footer covers half the focused button
- **Severity:** Medium

```

### $ python .claude/skills/ui-ux-pro-max/scripts/search.py "link prefetch navigation" --stack nextjs
```
## UI Pro Max Stack Guidelines
**Stack:** nextjs | **Query:** link prefetch navigation
**Source:** stacks/nextjs.csv | **Found:** 3 results

### Result 1
- **Category:** Link
- **Guideline:** Prefetch strategically
- **Description:** Control prefetching behavior
- **Do:** prefetch={false} for low-priority
- **Don't:** Prefetch all links
- **Code Good:** <Link prefetch={false}>
- **Code Bad:** Default prefetch on every link
- **Severity:** Low
- **Docs URL:** 
- **Applies To:** nextjs 16.2
- **Status:** active
- **Verified At:** 2026-08-13

### Result 2
- **Category:** Link
- **Guideline:** Use next/link for navigation
- **Description:** Client-side navigation with prefetching
- **Do:** <Link href=""> for internal links
- **Don't:** <a> for internal navigation
- **Code Good:** <Link href="/about">About</Link>
- **Code Bad:** <a href="/about">About</a>
- **Severity:** High
- **Docs URL:** https://nextjs.org/docs/app/api-reference/components/link
- **Applies To:** nextjs 16.2
- **Status:** active
- **Verified At:** 2026-08-13

### Result 3
- **Category:** Link
- **Guideline:** Use scroll option appropriately
- **Description:** Control scroll behavior on navigation
- **Do:** scroll={false} for tabs pagination
- **Don't:** Always scroll to top
- **Code Good:** <Link scroll={false}>
- **Code Bad:** Manual scroll management
- **Severity:** Low
- **Docs URL:** 
- **Applies To:** nextjs 16.2
- **Status:** active
- **Verified At:** 2026-08-13

```

### $ python .claude/skills/ui-ux-pro-max/scripts/search.py "navigation menu list mobile" --domain ux
```
## UI Pro Max Search Results
**Domain:** ux | **Query:** navigation menu list mobile
**Source:** ux-guidelines.csv | **Found:** 3 results

### Result 1
- **Category:** Navigation
- **Issue:** Back Button
- **Platform:** Mobile
- **Description:** Users expect back to work predictably
- **Do:** Preserve navigation history properly
- **Don't:** Break browser/app back button behavior
- **Code Example Good:** history.pushState()
- **Code Example Bad:** location.replace()
- **Severity:** High

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

### Result 3
- **Category:** Forms
- **Issue:** Mobile Keyboards
- **Platform:** Mobile
- **Description:** Show appropriate keyboard for input type
- **Do:** Use inputmode attribute
- **Don't:** Default keyboard for all inputs
- **Code Example Good:** inputmode='numeric'
- **Code Example Bad:** Text keyboard for numbers
- **Severity:** Medium

```

### $ python .claude/skills/ui-ux-pro-max/scripts/search.py "link accessible name purpose" --domain web
```
## UI Pro Max Search Results
**Domain:** web | **Query:** link accessible name purpose
**Source:** app-interface.csv | **Found:** 3 results

### Result 1
- **Category:** Accessibility
- **Issue:** Decorative Icons
- **Platform:** iOS/Android/React Native
- **Description:** Decorative icons should be hidden from screen readers
- **Do:** Mark decorative icons as not accessible
- **Don't:** Have screen reader read every icon
- **Code Example Good:** <Icon accessible={false} importantForAccessibility="no" />
- **Code Example Bad:** <Icon />
- **Severity:** Medium

### Result 2
- **Category:** Accessibility
- **Issue:** Icon Button Labels
- **Platform:** iOS/Android/React Native
- **Description:** Icon-only buttons must expose an accessible label
- **Do:** Set accessibilityLabel or label prop on icon buttons
- **Don't:** Icon buttons without accessible names
- **Code Example Good:** <Pressable accessibilityLabel="Close"><XIcon /></Pressable>
- **Code Example Bad:** <Pressable><XIcon /></Pressable>
- **Severity:** Critical

### Result 3
- **Category:** Accessibility
- **Issue:** Dragging Alternatives
- **Platform:** iOS/Android/React Native
- **Description:** React Native drag and reorder operations need a non-drag path selected for the active native runtime
- **Do:** Provide named Move up/down buttons or a position menu beside drag handles; route iOS and Android behavior through the runtime platform adapter
- **Don't:** Make drag, swipe, or a web-only pointer handler the only way to reorder native content
- **Code Example Good:** <Button title="Move up" onPress={() => moveItem(index, index - 1)} />
- **Code Example Bad:** <DragHandle /> only
- **Severity:** High

```

### $ python .claude/skills/ui-ux-pro-max/scripts/search.py "card link nested interactive" --domain web
```
## UI Pro Max Search Results
**Domain:** web | **Query:** card link nested interactive
**Source:** app-interface.csv | **Found:** 1 results

### Result 1
- **Category:** Accessibility
- **Issue:** Role & Traits
- **Platform:** iOS/Android/React Native
- **Description:** Interactive elements must expose correct roles/traits
- **Do:** Use accessibilityRole/button/link/checkbox etc.
- **Don't:** Rely on generic views with no roles
- **Code Example Good:** <Pressable accessibilityRole="button">Submit</Pressable>
- **Code Example Bad:** <View onTouchStart={submit}>Submit</View>
- **Severity:** High

```

### $ python .claude/skills/ui-ux-pro-max/scripts/search.py "content visible without javascript animation" --domain ux
```
## UI Pro Max Search Results
**Domain:** ux | **Query:** content visible without javascript animation
**Source:** ux-guidelines.csv | **Found:** 3 results

### Result 1
- **Category:** Animation
- **Issue:** Auto-Rotating Content Controls
- **Platform:** All
- **Description:** Auto-rotating content needs user control
- **Do:** Provide previous next and play/pause; stop on focus or hover and when reduced motion is requested
- **Don't:** Auto-advance slides without a stop control
- **Code Example Good:** button aria-label="Pause carousel"
- **Code Example Bad:** timer-only carousel
- **Severity:** High

### Result 2
- **Category:** Performance
- **Issue:** Bundle Size
- **Platform:** Web
- **Description:** Large JavaScript slows interaction
- **Do:** Monitor and minimize bundle size
- **Don't:** Ignore bundle size growth
- **Code Example Good:** Bundle analyzer
- **Code Example Bad:** No size monitoring
- **Severity:** Medium

### Result 3
- **Category:** Typography
- **Issue:** Font Loading
- **Platform:** Web
- **Description:** Fonts should load without layout shift
- **Do:** Reserve space with fallback font
- **Don't:** Layout shift when fonts load
- **Code Example Good:** font-display: swap + similar fallback
- **Code Example Bad:** No fallback font
- **Severity:** Medium

```

### $ python .claude/skills/ui-ux-pro-max/scripts/search.py "primary action above the fold" --domain ux
```
## UI Pro Max Search Results
**Domain:** ux | **Query:** primary action above the fold
**Source:** ux-guidelines.csv | **Found:** 0 results

No matches. This is not a match with an empty value -- the query did not hit the database. Retry with broader/different keywords before falling back to general defaults, and say explicitly that no database match was found if you do fall back.
**Closest known terms:** actions, section
```

### $ python .claude/skills/ui-ux-pro-max/scripts/search.py "hover state touch devices" --domain ux
```
## UI Pro Max Search Results
**Domain:** ux | **Query:** hover state touch devices
**Source:** ux-guidelines.csv | **Found:** 3 results

### Result 1
- **Category:** Animation
- **Issue:** Hover vs Tap
- **Platform:** All
- **Description:** Hover effects don't work on touch devices
- **Do:** Use click/tap for primary interactions
- **Don't:** Rely only on hover for important actions
- **Code Example Good:** onClick handler
- **Code Example Bad:** onMouseEnter only
- **Severity:** High

### Result 2
- **Category:** Touch
- **Issue:** Touch Spacing
- **Platform:** Mobile
- **Description:** Adjacent touch targets need adequate spacing
- **Do:** Minimum 8px gap between touch targets
- **Don't:** Tightly packed clickable elements
- **Code Example Good:** gap-2 between buttons
- **Code Example Bad:** gap-0 or gap-1
- **Severity:** Medium

### Result 3
- **Category:** Touch
- **Issue:** Touch Target Size
- **Platform:** Mobile
- **Description:** Touch target guidance depends on platform and web context
- **Do:** Use 44pt on iOS and 48dp on Android; for web use the separate WCAG Target Size rule
- **Don't:** Treat one unit or minimum as universal across platforms
- **Code Example Good:** iOS 44pt; Android 48dp; Web 24 CSS px plus WCAG exceptions
- **Code Example Bad:** w-6 h-6 buttons
- **Severity:** High

```

