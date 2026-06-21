# CopelandOS Mobile Idea Capture

Capture ideas from your iPhone using Siri, Shortcuts, or the mobile web interface. Ideas go into the inbox immediately and are classified automatically — no action is taken until you review and approve.

## Method 1: iOS Shortcut ("Capture Idea")

### Create the Shortcut

1. Open the **Shortcuts** app on your iPhone
2. Tap **+** to create a new shortcut
3. Name it **"Capture Idea"**
4. Add the following actions:

#### Step 1: Dictate Text
- Add action: **Dictate Text**
- Language: English (United States)
- This becomes the idea text

#### Step 2: Get Contents of URL
- Add action: **Get Contents of URL**
- URL: `https://your-copelandos-worker.workers.dev/api/capture/idea`
- Method: **POST**
- Request body: **JSON**
- Add JSON keys:
  - `text` → Dictated Text (from Step 1)
  - `source` → `"siri"`
  - `tags` → `["mobile"]`
  - `urgency` → `"medium"` (optional — can be "low", "medium", or "high")

#### Step 3: Show Result (optional)
- Add action: **Show Result**
- Text: Contents of URL (so you can see the confirmation)

### Example JSON body

```json
{
  "text": "Shortcut variable: Dictated Text",
  "source": "siri",
  "tags": ["mobile"],
  "urgency": "medium"
}
```

### Use Siri to trigger it

- Say: **"Hey Siri, Capture Idea"**
- Siri will prompt you to dictate your idea
- The idea is sent to `/api/capture/idea` and stored in the inbox

### Security note

The Shortcut **only captures ideas**. It does not execute any action on your computer, send emails, deploy code, or control any software. The API returns a classification and suggested action for human review.

---

## Method 2: Explicit POST from Shortcuts (no dictation)

You can pre-fill the text in the shortcut:

- Add action: **Text** → type your idea
- Then: **Get Contents of URL** → POST to `/api/capture/idea` with `text` = Text variable

---

## Method 3: Mobile Web Capture

If Siri shortcuts feel unreliable, use the dashboard directly from your iPhone browser:

1. Open `https://your-copelandos-worker.workers.dev` (or your Pages URL) in Safari
2. The dashboard is mobile-first — swipe to the **Idea Inbox** panel
3. Use the capture form to type or paste your idea
4. Tap **Capture** to submit

---

## Idea Sources

The `source` field accepts:

| Value | When to use |
|---|---|
| `siri` | Captured via Hey Siri |
| `shortcuts` | Captured via iOS Shortcut |
| `mobile-web` | Captured via iPhone browser |
| `dashboard` | Captured via desktop dashboard |
| `manual` | Default / any other method |

---

## Testing from Your Phone

1. Open the Shortcut in Shortcuts app
2. Tap the play button (▶)
3. Dictate a test idea: "Test idea — remember to write the catalase lab notes"
4. Check the response — it should show `ok: true` with classification data
5. Open the dashboard and check the **Idea Inbox** panel

---

## Fallback: If Siri is Unreliable

Siri shortcut triggers can sometimes fail due to iOS updates or permissions. Use these alternatives:

- **Widget**: Add the Shortcut as a home screen widget
- **Back tap**: Assign the Shortcut to iPhone back tap (Settings → Accessibility → Touch → Back Tap)
- **Share sheet**: Run the Shortcut from the Share sheet in any app
- **Mobile web**: Bookmark the dashboard and use the capture form

---

## What Happens After Capture

1. Idea is stored in the inbox with a safe ID
2. Classifier runs: category, skill, risk level, suggested action
3. Idea appears in the dashboard Idea Inbox
4. You review and triage manually: `/api/ideas/:id/triage`
5. You choose to convert, generate a Cursor prompt, or dismiss

**The system never acts on an idea without your review.**
