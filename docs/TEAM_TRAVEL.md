# Staff travel and external tour managers

## Staff travel

`/portal/travel-schedule` shows current and upcoming plans to active staff. Each plan contains the existing staff identity, destination and inclusive date range. Staff create, edit and cancel their own plans. HR, Operations Head and directors/admins can manage plans for others. Cancelled plans remain in My trips; a cancelled plan is replaced with a new plan if needed.

Travel is separate from leave. No leave reason, approval record, live location or automatic movement tracking enters the schedule. A JC can be linked only through ordinary JC permissions and record scope; viewers outside that scope see the person, destination and dates without the JC identifier or link. The existing local reference-date clock refreshes at local midnight and supplies validated date-only query inputs.

## External tour managers

`/portal/external-tour-managers` reuses the existing Tour Manager read permission. Operations Head and directors/admins maintain profiles and assignments. There are no external logins, invitations or automatic messages.

Profiles hold name, email/phone, destinations handled, experience notes and optional years. Normalized email or phone prevents duplicate external profiles; existing staff contacts must use their staff identity. Phone matching checks at most 500 staff and fails closed beyond that bound; email-only identification remains available.

Reported past-tour counts require source/context and are explicitly marked as tour-manager-reported or staff-recorded. Unknown history stays blank. JC-linked assignments come only from explicit profile links and retain ordinary JC visibility. Series destination, label and dates override the JC where recorded. Assignment records do not establish completed travel.

Staff can add an assignment from a profile or deliberately link an existing unlinked external assignment. Profiles can be made inactive for new assignments while preserving history and edits to unchanged existing assignments. Staff and external identities cannot be combined on one assignment; an external name match never grants staff feedback authorship.

## Using the travel schedule

1. Open **Admin → Travel schedule**. **Team travel** shows current and upcoming plans; **My trips** also keeps your past and cancelled plans.
2. Choose **Add travel**, enter **Destination**, **From** and **Through**, then **Save travel**. Dates include both endpoints. **Job Card, optional** starts at **No Job Card**. Choose an existing authorized JC when the trip belongs to that work. Managers who can record travel for others also see **Person**.
3. Use **Edit travel** to change dates, destination or the optional JC. Selecting **No Job Card** clears a previous link. **Cancel** in the form discards unsaved edits and leaves the saved trip unchanged.
4. **Cancel trip** opens a confirmation. **Keep trip** dismisses it. Confirming **Cancel trip** removes the plan from Team travel and keeps it marked **Cancelled** in My trips. Cancelled plans cannot be edited or reopened; add a new plan if the travel resumes. Travel plans do not create or approve leave.

## Using an external-manager profile

1. Open **Operations → External tour managers** and choose a person. Authorized managers can use **Add profile**, enter the name and at least one contact method, and separate **Destinations handled** with commas. Years and experience notes are optional; leave unknown information blank.
2. **Reported history** records prior experience you have been told about. An optional **Past tours** count requires **History source** and **Source and context**. It can say, for example, that the manager reported 18 past tours. It does not create 18 JC records or establish that those tours were completed.
3. **Save profile** keeps the person for reuse. **Edit profile** updates the same record; its **Cancel** button discards unsaved edits. Clear **Use for new assignments** when the person should no longer receive new work. The profile and its history remain available through **Include inactive profiles**.
4. Under **JC-linked assignments**, select **Assign to a Job Card** and choose **Add assignment**. A JC is required in this control. To reuse an older allocation instead, expand **Link an existing assignment**, deliberately choose its **Unlinked assignment**, and select **Link assignment**. Linking uses this profile's contact identity for that allocation.
5. The JC list shows explicit linked assignments within your ordinary JC visibility. It does not infer tours from experience notes or treat an assignment as a completed tour. An allocation with no JC does not appear in this JC history. The optional reported count remains separate when assignments are added.

Active staff manage their own travel. HR, Operations Head and directors/admins can manage travel for others. The external directory follows Tour Manager read permission; Operations Head and directors/admins maintain profiles and assignments. Read-only viewers do not see write controls.

## Local verification and rollout

Schema changes are additive: two new tables and optional external profile links on existing assignments. No existing row is backfilled into inferred travel or experience. Ownership cleanup and JC deletion cover linked test records. Permission, duplicate identity, dates, midnight refresh, cancellation, series history and inactive-profile regression tests accompany the APIs. No production migration is part of this change.
