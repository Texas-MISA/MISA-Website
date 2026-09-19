# ui-ux-pro-max — raw lookups for check-in (`/portal/attend`)

Run 2026-09-19 by `/design-brief portal-attend`, step 3. Lookups only (`search.py … --domain` / `--stack`); never `--design-system` or `--persist`. Every query and its unedited output, in the order run; dispositions are in `evidence.md`.

### $ python .claude/skills/ui-ux-pro-max/scripts/search.py "form validation error message" --domain ux
```
## UI Pro Max Search Results
**Domain:** ux | **Query:** form validation error message
**Source:** ux-guidelines.csv | **Found:** 3 results

### Result 1
- **Category:** Forms / Accessibility
- **Issue:** Focusable Error Summary
- **Platform:** Web
- **Description:** An error summary for failed validation complements inline field errors and must be easy to find by keyboard and screen reader users
- **Do:** Place it at the top of the form; move focus to its heading or container after failed submit; link each item to its invalid field; retain inline errors
- **Don't:** Replace inline errors with a visual-only summary or move focus on every blur
- **Code Example Good:** <div role="alert" tabindex="-1" aria-labelledby="error-title"><h2 id="error-title">There is a problem</h2><a href="#email">Enter an email address</a></div>
- **Code Example Bad:** Toast only with no field links or focus target
- **Severity:** High

### Result 2
- **Category:** Accessibility
- **Issue:** Error Messages
- **Platform:** All
- **Description:** Error messages must be announced
- **Do:** Use aria-live or role=alert for errors
- **Don't:** Visual-only error indication
- **Code Example Good:** role='alert'
- **Code Example Bad:** Red border only
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

### $ python .claude/skills/ui-ux-pro-max/scripts/search.py "checkbox label touch target" --domain ux
```
## UI Pro Max Search Results
**Domain:** ux | **Query:** checkbox label touch target
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

### $ python .claude/skills/ui-ux-pro-max/scripts/search.py "submit button loading state" --domain ux
```
## UI Pro Max Search Results
**Domain:** ux | **Query:** submit button loading state
**Source:** ux-guidelines.csv | **Found:** 3 results

### Result 1
- **Category:** Forms
- **Issue:** Submit Feedback
- **Platform:** All
- **Description:** Confirm form submission status
- **Do:** Show loading then success/error state
- **Don't:** No feedback after submit
- **Code Example Good:** Loading -> Success message
- **Code Example Bad:** Button click with no response
- **Severity:** High

### Result 2
- **Category:** Navigation
- **Issue:** Back Button
- **Platform:** Mobile
- **Description:** Users expect back to work predictably
- **Do:** Preserve navigation history properly
- **Don't:** Break browser/app back button behavior
- **Code Example Good:** history.pushState()
- **Code Example Bad:** location.replace()
- **Severity:** High

### Result 3
- **Category:** Feedback
- **Issue:** Loading Indicators
- **Platform:** All
- **Description:** Loading feedback should match the expected wait and avoid flashing for near-instant work
- **Do:** Follow platform and component guidance; preserve layout focus and accessible busy status
- **Don't:** Apply one timing threshold to every operation or leave long waits unexplained
- **Code Example Good:** Stable skeleton or progress with aria-busy
- **Code Example Bad:** Flickering spinner or frozen UI
- **Severity:** High

```

### $ python .claude/skills/ui-ux-pro-max/scripts/search.py "success confirmation feedback" --domain ux
```
## UI Pro Max Search Results
**Domain:** ux | **Query:** success confirmation feedback
**Source:** ux-guidelines.csv | **Found:** 3 results

### Result 1
- **Category:** Interaction
- **Issue:** Success Feedback
- **Platform:** All
- **Description:** Confirm successful actions to users
- **Do:** Show success message or visual change
- **Don't:** No confirmation of completed action
- **Code Example Good:** Toast notification or checkmark
- **Code Example Bad:** Action completes silently
- **Severity:** Medium

### Result 2
- **Category:** Feedback
- **Issue:** Confirmation Messages
- **Platform:** All
- **Description:** Confirm successful actions
- **Do:** Brief success message
- **Don't:** Silent success
- **Code Example Good:** Saved successfully toast
- **Code Example Bad:** No confirmation
- **Severity:** Medium

### Result 3
- **Category:** Interaction
- **Issue:** Confirmation Dialogs
- **Platform:** All
- **Description:** Prevent accidental destructive actions
- **Do:** Confirm before delete/irreversible actions
- **Don't:** Delete without confirmation
- **Code Example Good:** Are you sure modal
- **Code Example Bad:** Direct delete on click
- **Severity:** High

```

### $ python .claude/skills/ui-ux-pro-max/scripts/search.py "color not only indicator" --domain ux
```
## UI Pro Max Search Results
**Domain:** ux | **Query:** color not only indicator
**Source:** ux-guidelines.csv | **Found:** 3 results

### Result 1
- **Category:** Accessibility
- **Issue:** Color Only
- **Platform:** All
- **Description:** Don't convey information by color alone
- **Do:** Use icons/text in addition to color
- **Don't:** Red/green only for error/success
- **Code Example Good:** Red text + error icon
- **Code Example Bad:** Red border only for error
- **Severity:** High

### Result 2
- **Category:** Security / Accessibility
- **Issue:** Accessible Authentication (Minimum)
- **Platform:** All
- **Description:** WCAG 2.2 AA says authentication must not depend only on a cognitive function test unless an exception applies
- **Do:** Allow password managers and paste; offer passkeys OAuth or another non-cognitive method
- **Don't:** Block paste or require manual OTP transcription with no alternative
- **Code Example Good:** autocomplete="current-password" and paste allowed
- **Code Example Bad:** onpaste preventDefault
- **Severity:** Critical

### Result 3
- **Category:** Accessibility
- **Issue:** Color Contrast
- **Platform:** All
- **Description:** Text must be readable against background
- **Do:** Minimum 4.5:1 ratio for normal text
- **Don't:** Low contrast text
- **Code Example Good:** #333 on white (7:1)
- **Code Example Bad:** #999 on white (2.8:1)
- **Severity:** High

```

### $ python .claude/skills/ui-ux-pro-max/scripts/search.py "screen reader announce status message" --domain ux
```
## UI Pro Max Search Results
**Domain:** ux | **Query:** screen reader announce status message
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
- **Category:** Accessibility
- **Issue:** Contextual Live Badge Updates
- **Platform:** Web
- **Description:** Async badge and count changes should announce a meaningful contextual status without moving focus
- **Do:** Use one appropriate atomic status message such as 3 items in cart
- **Don't:** Announce a bare number or make every badge a competing live region
- **Code Example Good:** <span role='status' aria-atomic='true'>3 items in cart</span>
- **Code Example Bad:** <span aria-live='polite'>3</span>
- **Severity:** High

### Result 3
- **Category:** Forms / Accessibility
- **Issue:** Focusable Error Summary
- **Platform:** Web
- **Description:** An error summary for failed validation complements inline field errors and must be easy to find by keyboard and screen reader users
- **Do:** Place it at the top of the form; move focus to its heading or container after failed submit; link each item to its invalid field; retain inline errors
- **Don't:** Replace inline errors with a visual-only summary or move focus on every blur
- **Code Example Good:** <div role="alert" tabindex="-1" aria-labelledby="error-title"><h2 id="error-title">There is a problem</h2><a href="#email">Enter an email address</a></div>
- **Code Example Bad:** Toast only with no field links or focus target
- **Severity:** High

```

### $ python .claude/skills/ui-ux-pro-max/scripts/search.py "mobile keyboard autocomplete input" --domain ux
```
## UI Pro Max Search Results
**Domain:** ux | **Query:** mobile keyboard autocomplete input
**Source:** ux-guidelines.csv | **Found:** 3 results

### Result 1
- **Category:** Forms
- **Issue:** Mobile Keyboards
- **Platform:** Mobile
- **Description:** Show appropriate keyboard for input type
- **Do:** Use inputmode attribute
- **Don't:** Default keyboard for all inputs
- **Code Example Good:** inputmode='numeric'
- **Code Example Bad:** Text keyboard for numbers
- **Severity:** Medium

### Result 2
- **Category:** Forms
- **Issue:** Input Types
- **Platform:** All
- **Description:** Use appropriate input types
- **Do:** Use email tel number url etc
- **Don't:** Text input for everything
- **Code Example Good:** type='email'
- **Code Example Bad:** type='text' for email
- **Severity:** Medium

### Result 3
- **Category:** Forms
- **Issue:** Input Labels
- **Platform:** All
- **Description:** Every input needs a visible label
- **Do:** Always show label above or beside input
- **Don't:** Placeholder as only label
- **Code Example Good:** <label>Email</label><input>
- **Code Example Bad:** placeholder='Email' only
- **Severity:** High

```

### $ python .claude/skills/ui-ux-pro-max/scripts/search.py "server action form pending" --stack nextjs
```
## UI Pro Max Stack Guidelines
**Stack:** nextjs | **Query:** server action form pending
**Source:** stacks/nextjs.csv | **Found:** 3 results

### Result 1
- **Category:** DataFetching
- **Guideline:** Use Server Actions for mutations
- **Description:** Server Actions for form submissions
- **Do:** action={serverAction} in forms
- **Don't:** API route for every mutation
- **Code Good:** <form action={createPost}>
- **Code Bad:** <form onSubmit={callApiRoute}>
- **Severity:** Medium
- **Docs URL:** https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations
- **Applies To:** nextjs 16.2
- **Status:** active
- **Verified At:** 2026-08-13

### Result 2
- **Category:** Security
- **Guideline:** Validate Server Action input
- **Description:** Server Actions are public endpoints, so they need validation and authorization.
- **Do:** Validate and authorize in Server Action
- **Don't:** Trust Server Action input
- **Code Good:** Auth check + validation in action
- **Code Bad:** Direct database call without check
- **Severity:** High
- **Docs URL:** https://nextjs.org/docs/app/guides/data-security
- **Applies To:** nextjs 16.2
- **Status:** active
- **Verified At:** 2026-08-13

### Result 3
- **Category:** Caching
- **Guideline:** Use updateTag for read-your-own-writes
- **Description:** Use updateTag from Server Actions when the UI must reflect a mutation immediately.
- **Do:** Call updateTag after a successful mutation in a Server Action
- **Don't:** Use updateTag outside Server Actions
- **Code Good:** updateTag('cart')
- **Code Bad:** revalidateTag('cart') // when immediate refresh is required
- **Severity:** High
- **Docs URL:** https://nextjs.org/docs/app/api-reference/functions/updateTag
- **Applies To:** nextjs 16.2
- **Status:** active
- **Verified At:** 2026-08-13

```

