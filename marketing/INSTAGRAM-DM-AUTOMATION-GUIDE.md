# Tektone — Instagram Comment → Auto-DM Automation

**Goal:** when someone comments on a Tektone Instagram post/Reel, automatically send them a DM (e.g. a link or welcome), and have the resulting conversation land in **Chatwoot** (`chat.tektone.com.br`) for an agent to continue.

This is the "ManyChat pattern" built on Meta's official API, using your own stack (n8n + Chatwoot).

---

## 0. How it actually works (and the key constraint)

Meta's mechanism for "comment → DM" is **Private Replies**: your app receives a `comments` webhook, then calls the Graph API to send **one** DM to the commenter, addressed by `comment_id`.

```
IG user comments on a post
        │
        ▼  (Meta sends a webhook)
   Your webhook endpoint  ──►  Graph API: POST /{ig-user-id}/messages
        │                       { recipient:{comment_id}, message:{text} }
        ▼                              │
   (optional keyword filter)          ▼
                                  DM delivered to commenter
                                       │
                                       ▼
                              conversation appears in Chatwoot
```

**Hard limits (Meta-enforced — design around them):**
- **Private reply:** exactly **one** auto-DM per comment, within **7 days** of the comment.
- **24-hour window:** after the user replies to your DM, you have a rolling 24h to keep messaging (outside that, only approved message tags).
- **Rate limit:** ~**200 messages/hour**.
- **No spam:** repeated/irrelevant DMs get the app flagged.

**⚠️ The architecture gotcha:** a single Meta app sends **all** Instagram webhook fields (`comments`, `messages`, …) to **one** callback URL. So you can't point `comments` at n8n *and* `messages` at Chatwoot from the same app. See **Phase 4** for the fix.

---

## 1. Prerequisites

- [ ] Instagram **Business or Creator** account
- [ ] That IG account **linked to a Facebook Page** (IG app → Settings → Account type and tools, and Page → Linked accounts)
- [ ] **Meta Business Manager** (business.facebook.com)
- [ ] **Meta Developer** account (developers.facebook.com)
- [ ] A **privacy policy URL** (required for App Review) — e.g. `https://tektone.com.br/privacidade`
- [ ] Access to: `chat.tektone.com.br/super_admin` · `auto.tektone.com.br` (n8n)

**Your fixed values:**
| Thing | Value |
|---|---|
| Chatwoot IG webhook | `https://chat.tektone.com.br/webhooks/instagram` |
| Chatwoot FB webhook | `https://chat.tektone.com.br/webhooks/facebook` |
| n8n webhook (you create) | `https://auto.tektone.com.br/webhook/ig-comment-dm` |
| Graph API version | `v21.0` (or latest stable) |
| Verify tokens | invent two random strings, e.g. `tk_ig_verify_9f3a…`, `tk_fb_verify_2b7c…` |

---

## 2. Phase 1 — Create the Meta App

1. developers.facebook.com → **My Apps → Create App** → type **Business**.
2. **Add products:**
   - **Instagram** (Instagram Graph API / "Instagram with Facebook Login")
   - **Webhooks**
   - **Facebook Login** (for the Chatwoot connect flow)
   - **Messenger** (if you also want Messenger DMs in Chatwoot)
3. **App settings → Basic:** copy **App ID** and **App Secret**. Add App Domain `tektone.com.br`, Privacy Policy URL.
4. **Permissions you'll request** (App Review needed for live use):
   - `instagram_basic`
   - `instagram_manage_comments`  ← the comment webhook + reading comments
   - `instagram_manage_messages`  ← sending the DM / private reply
   - `pages_manage_metadata`, `pages_read_engagement`, `business_management`
5. Add your own IG/FB as a **Tester/Role** so everything works **before** App Review (in Dev mode it only works for app roles).

---

## 3. Phase 2 — Connect Instagram to Chatwoot (DM inbox)

This makes Instagram **DMs** show up in Chatwoot so agents can reply.

**A. Global app config** (Super Admin):
- `chat.tektone.com.br/super_admin` → **App Config → Facebook** (the screen you found):
  - **Facebook App ID** = your App ID
  - **Facebook App Secret** = your App Secret
  - **Facebook Verify Token** = `tk_fb_verify_…` (your random string)
  - **Instagram Verify Token** = `tk_ig_verify_…` (your random string)
  - **Facebook API Version** = `v17.0` *(leave as-is unless you know you need newer)*
  - Submit.

**B. Register the webhook in the Meta app** (Webhooks product → Instagram):
- Callback URL: `https://chat.tektone.com.br/webhooks/instagram`
- Verify token: the **Instagram Verify Token** above
- Subscribe to fields: **`messages`** (and `message_reactions`, `messaging_postbacks` if available)
- *(Do **not** subscribe `comments` here yet — that goes to n8n; see Phase 4.)*

**C. Connect the channel in Chatwoot:**
- Log into a Chatwoot **account** (not super_admin) → **Settings → Inboxes → Add Inbox → Instagram** → "Continue with Facebook" → authorize → pick the Page/IG account.
- Send yourself a test DM on Instagram → it should appear in the Chatwoot inbox.

---

## 4. Phase 3 — Comment→DM automation in n8n  (the core ask)

n8n (`auto.tektone.com.br`) is your automation engine. There's an official template: **"Send Instagram auto DMs to post commenters using Meta Graph API"** (n8n.io/workflows/15206) — use it as a base.

**Build the workflow:**

1. **Webhook (Trigger) node**
   - Method: handle both `GET` (Meta verification) and `POST` (events).
   - Path: `ig-comment-dm` → public URL `https://auto.tektone.com.br/webhook/ig-comment-dm`
   - **Verification branch (GET):** if `query['hub.mode']==='subscribe'` and `query['hub.verify_token']` matches your token → respond with `query['hub.challenge']` (status 200, raw).

2. **Parse the comment event (POST)** — Meta sends:
   ```json
   { "entry":[{ "changes":[{ "field":"comments",
     "value":{ "id":"<comment_id>", "text":"<comment text>",
               "from":{ "id":"<igsid>", "username":"<user>" },
               "media":{ "id":"<media_id>" } } }] }] }
   ```

3. **(Optional) Filter node** — only DM when the comment matches a keyword (e.g. contains `LINK` / `EU QUERO`). Skip your own replies (`from.id === your IG id`).

4. **HTTP Request node — send the private reply (the DM):**
   - `POST https://graph.facebook.com/v21.0/{IG_USER_ID}/messages`
   - Headers: `Authorization: Bearer {PAGE_ACCESS_TOKEN}`
   - Body (JSON):
     ```json
     { "recipient": { "comment_id": "{{$json.comment_id}}" },
       "message":   { "text": "Oi! Aqui está o que você pediu: https://tektone.com.br 👇" } }
     ```
   - `IG_USER_ID` = your Instagram professional account ID; `PAGE_ACCESS_TOKEN` = long-lived page token (store in n8n credentials, not inline).

5. **(Recommended) Forward DMs to Chatwoot** — see Phase 4.

---

## 5. Phase 4 — Reconciling the two webhooks (important)

One Meta app = **one** Instagram callback URL for **all** fields. You want `comments` → n8n and `messages` → Chatwoot. Pick one:

**Option A — n8n is the single endpoint (recommended).**
- Point the Meta **Instagram webhook** at n8n: `https://auto.tektone.com.br/webhook/ig-comment-dm`
- Subscribe to **both** `comments` and `messages`.
- In n8n: `IF field === comments` → do the auto-DM; `ELSE` (messages) → **HTTP Request** forwarding the raw body to `https://chat.tektone.com.br/webhooks/instagram` (so Chatwoot still gets DMs).
- One source of truth, full control. Slightly more n8n wiring.

**Option B — Two Meta apps.**
- App #1 → Chatwoot (`messages` → `/webhooks/instagram`).
- App #2 → n8n (`comments` → auto-DM).
- Both connected to the same IG account. More dashboards, two App Reviews.

**Option C — ManyChat for comments + Chatwoot for DMs.**
- Fastest to launch (ManyChat is pre-approved by Meta for comment→DM), but it's external/paid and your comment data lives there. Chatwoot still handles ongoing DMs.

> **My recommendation:** **Option A.** You already run n8n; it keeps everything in your stack and gives you keyword routing, logging, and the Chatwoot hand-off in one place.

---

## 6. Phase 5 — App Review (go live for the public)

In Dev mode, the automation only works for accounts added as **app roles/testers**. For real followers you must pass **App Review** for `instagram_manage_messages` + `instagram_manage_comments`:
- Provide a **screencast** showing the comment→DM flow end-to-end.
- A clear **use-case description** ("We send a one-time helpful reply to users who comment on our posts and continue support in our inbox").
- **Privacy policy URL** live on `tektone.com.br`.
- Review typically takes a few days; iterate on feedback.

---

## 7. Test checklist

- [ ] Webhook verification (GET) returns the challenge → Meta shows "Verified".
- [ ] Comment on a post (as a test user) → DM arrives within seconds.
- [ ] DM reply from the user → conversation shows up in Chatwoot.
- [ ] Keyword filter works (only triggers on the keyword, if used).
- [ ] No duplicate DMs (respect the one-per-comment rule).

---

## 8. Quick reference

| Item | Value |
|---|---|
| Send DM (private reply) | `POST graph.facebook.com/v21.0/{IG_USER_ID}/messages` body `{recipient:{comment_id}, message:{text}}` |
| Comment webhook field | `comments` |
| DM webhook field | `messages` |
| Chatwoot IG webhook | `https://chat.tektone.com.br/webhooks/instagram` |
| n8n webhook | `https://auto.tektone.com.br/webhook/ig-comment-dm` |
| Limits | 1 private reply/comment · 7-day reply window · 24h messaging window · ~200 msg/h |

**Sources:** Chatwoot [Instagram channel setup](https://developers.chatwoot.com/self-hosted/configuration/features/integrations/instagram-channel-setup) · Meta [Instagram messaging API](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/messaging-api/) · [Instagram webhooks](https://developers.facebook.com/docs/instagram-platform/webhooks/) · n8n [auto-DM template #15206](https://n8n.io/workflows/15206-send-instagram-auto-dms-to-post-commenters-using-meta-graph-api/)
