# Ideas backlog

Scratchpad for product and engineering ideas. Add bullets as you think of them.

---

## Integrations & settings

1. **Settings page + connectors**
  - Add a **Settings** area where users can connect external services.
  - **Gmail connector** (OAuth): automate cold-email **sending** from the app, and surface **notifications** when replies land (push/in-app), so outreach stays inside GradApply instead of copying to a separate mail client.

---

## AI providers

1. **Bring-your-own API keys**
  - Let users paste **Anthropic**, **OpenAI**, or **other LLM provider** keys so generation (assistant, drafts, inference) uses **their** account/quota instead of—or in addition to—shared server-side keys.
  - Consider storage: encrypted at rest, per-user, optional “use org default” fallback.

---

## Prioritized roadmap (impact vs effort)

### Tier 1 — high impact, relatively fast to ship

1. **Application timeline + reminders**
  - Calendar view across schools and deadlines.
  - “Due in X days” nudges and overdue alerts.
2. **School-specific SOP tailoring**
  - Start from one master SOP and auto-generate per-school variants.
  - Inject school/lab-specific fit statements safely (no hallucinated faculty claims).
3. **Document versioning for SOP/CV/emails**
  - Save named versions with quick rollback.
  - Show diffs between versions for editing confidence.
4. **Reply intelligence for outreach**
  - Detect likely reply intent (interested / maybe / no).
  - Propose next-step response drafts automatically.

#### Tier 1 — implementation plan (2–3 sprints) + Senior Software Engineer workstreams

Run each workstream in a **separate** agent session and open with: *“Act as **Senior Software Engineer**; you own [workstream name] only.”*  
Do not mix workstreams in one session if you want clean ownership and reviewable PRs.


| Sprint       | Focus                                              | Workstreams (parallel where possible)                       |
| ------------ | -------------------------------------------------- | ----------------------------------------------------------- |
| **Sprint 1** | Data + read paths that other features can build on | (1) Timeline, (2) Document versions (MVP)                   |
| **Sprint 2** | AI + user-facing depth                             | (3) SOP tailoring, (4) Reply intelligence (MVP)             |
| **Sprint 3** | Polish, notifications, and hardening               | All four: alerts, diff UI, prompt safety, admin copy, tests |


---

**Workstream 1 — Senior Software Engineer: Application timeline + reminders**

- **Schema**
  - Option A (light): add `reminderAt` / `reminderNote` on `School` (or a small `ApplicationReminder` model: `id`, `userId`, `schoolId?`, `remindAt`, `message`, `dismissedAt`).
  - Option B: `UserNotification` or `Task` model for global tasks not tied to one school.
- **API**
  - `GET /api/schools` (or new `GET /api/timeline`) returns schools with `deadline` + optional reminder fields, sorted for calendar.
  - `PATCH` for setting/dismissing reminders; optional `GET /api/reminders` for a dedicated list.
- **UI**
  - `/schools` or new `/timeline` (or dashboard widget): month/week list, “due in N days” badges, overdue styling.
  - Optional: email or in-app banner (if you add a small `Notification` read model later).
- **DoD**
  - User can see all upcoming deadlines; at least one reminder per school; overdue state visible.

---

**Workstream 2 — Senior Software Engineer: Document versioning (SOP / CV / email drafts)**

- **Schema**
  - `DocumentVersion` (or generic `ContentVersion`): `id`, `userId`, `entityType` (`sop` | `cv` | `prof_email` | `other`), `entityId?` (e.g. `ProfEmail.id` or `Document.id`), `label`, `body` (or `fileUrl` for binary), `createdAt`, `parentVersionId?`.
  - For file-based docs, version can point to `Document` + storage URL per version or store text snapshots for drafts.
- **API**
  - `POST` create version from current draft; `GET` list versions; `GET` single version; optional `POST` restore (creates new version from old).
  - For **ProfEmail**: versions on `emailSubject` + `emailBody`.
- **UI**
  - On emails page (and/or documents): “Save version”, version dropdown, **diff** between two selected versions (text diff enough for MVP).
- **DoD**
  - Save named version, list versions, restore; diff works for text drafts.

---

**Workstream 3 — Senior Software Engineer: School-specific SOP tailoring**

- **Schema**
  - `SopVariant`: `id`, `userId`, `schoolId`, `title`, `body`, `sourceMasterId?`, `updatedAt` — or store as `Document` rows with `type: sop_draft` + metadata JSON for `schoolId`.
- **API**
  - `POST /api/sop/variants` (generate from master + school context); `GET` list by school; `PATCH` save edits.
  - Server calls existing LLM stack with strict system prompt: **no invented faculty facts**; user must confirm faculty names.
- **UI**
  - From `/schools` row or SOP area: “Tailor for this school”, pick master SOP (from documents or textarea), show side-by-side or tabs (master vs variant).
- **DoD**
  - One master → per-school saved variant; edit and save; obvious disclaimer on factual claims.

---

**Workstream 4 — Senior Software Engineer: Reply intelligence for outreach**

- **Schema**
  - Extend `ProfEmail`: `lastReplySnippet`, `replyIntent` enum (`INTERESTED` | `NEUTRAL` | `DECLINED` | `UNKNOWN`), `suggestedReplyDraft` (optional text), `lastClassifiedAt`.
  - Or separate `ProfEmailReplyEvent` if you want history of multiple replies (better long-term).
- **API**
  - `POST /api/prof-emails/[id]/analyze-reply` with `{ replyText }` (paste from user) **or** future Gmail sync webhook.
  - Returns `{ intent, rationale, suggestedReply }` — store on row.
- **UI**
  - On `/emails`: paste reply textarea + “Analyze”; show intent badge + editable suggested reply.
- **DoD**
  - User can paste a reply, get classification + draft; persisted on the thread record.

---

### Tier 2 — high impact, moderate effort

1. **Interview prep module**
  - Mock interviewer mode for PI/program interviews.
  - Score responses with actionable coaching notes.
2. **Scholarship/funding tracker**
  - Track fellowships/assistantships by school and deadline.
  - Filter by eligibility and attach reminders.
3. **Faculty fit scorer**
  - Score professors/labs vs user research interests.
  - Explain score with transparent overlap reasons.

### Tier 3 — strategic but heavier build

1. **Import pipeline + OCR**
  - Import from Drive/Dropbox and parse scanned docs.
  - Extract key metadata (GPA/GRE/institutions) into profile drafts.
2. **Collaboration mode**
  - Share selected drafts for mentor comments.
  - Granular permissions (view/comment only by document).
3. **Application analytics dashboard**
  - Funnel metrics: planned → applied → interview → admit.
  - Cohort-level trend insights and conversion reporting.