# Office check-in: director's pilot guide

Office check-in shows who is in the office and whether each clock-in met the office's check.
It does not run payroll and it does not track anyone during the day. Location is asked for
only when someone presses **Clock in** or **Clock out**.

The pilot runs in **Report only** mode. Nothing is blocked: every check-in is recorded with a
result of **Pass**, **Fail** or **Uncertain** so we can learn what each office looks like
before deciding anything else. A Fail or Uncertain result is not proof that someone was
absent; it is a prompt to look.

Your development team switches the feature on first (see "Before you start"). Everything
below is done in Citius Connect under **Admin → Office check-in**.

## Before you start (development team)

You cannot test until the development team confirms:

- the new version of Citius Connect is live,
- the check-in settings are in place on the server,
- the daily clean-up job is switched on.

They will tell you when it is ready.

## Step 1. Collect each office's details (about a week, with IT)

For **each office** (Mumbai/Thane, Bengaluru, Kolkata), ask the IT contact or internet
provider for the following and write it down:

1. **The office's public internet address(es).** Ask for every one, including any backup
   connection or 4G router, and both the IPv4 and IPv6 versions if the office has them. Ask
   whether each one is fixed ("static") or changes.
2. **VPN.** Does Citius have a company VPN? If staff working from home connect through it, do
   they appear to come from the office's internet address? (If yes, that address cannot tell
   home and office apart, so we mark it as shared.)
3. **Security software** on office computers that routes internet traffic elsewhere
   (Zscaler, Cloudflare WARP, or similar). Ask for its exit addresses.
4. **Guest Wi-Fi.** Does it use the same internet address as staff computers?
5. **Who uses what.** Roughly which staff use fixed desktops and which use laptops or phones.

For the location check you also need:

6. **The office's exact position.** Stand at the office entrance with a phone, open a maps
   app, drop a pin, and copy the latitude and longitude (for example 19.2166, 72.9722). Do
   not use the building's address search result.
7. **How far the boundary should reach.** Start with 100 to 150 metres in a busy city
   block. We tighten it after the pilot.

## Step 2. Set up each office (15 minutes per office)

Go to **Admin → Office check-in** and scroll to **Office rules**.

1. **Add office.** Enter a short code (for example `BOM`, `BLR`, `CCU`), the name and city.
2. **Choose what to check** for that office:
   - **Office network**: for offices where people use office desktops or office Wi-Fi.
   - **Location**: for offices where people mostly use phones or laptops.
   - **Office network and location**: both must pass. Desktop users without location will
     show Uncertain.
   - **Office network or location**: either one passing is enough. Weaker, but practical for
     a mix of desktops and phones. Start here if unsure.
3. **Office network ranges.** Add each address from Step 1 with a label (for example "Main
   line", "Backup 4G"). For each one choose:
   - **Office**: only office traffic uses it.
   - **Office, shared with VPN**: home VPN users also appear here. Matches count as Uncertain.
   - **VPN or proxy exit**: security software or VPN exits. Matches count as Uncertain.
4. **Office location.** Enter the latitude and longitude from Step 1, the radius in metres,
   and an **Accuracy limit** smaller than the radius (start with about half of it, for
   example 60 m for a 120 m radius). Readings less precise than the limit count as Uncertain.
5. **Mode: Report only.** Leave it on Report only for the whole pilot.
6. Write a short reason (for example "Pilot setup from IT details, 6 Nov") and **Save rule**.
7. Under **Staff office**, choose each person's office and **Save assignment**. A person with
   no office cannot clock in.

## Step 3. Test it yourself (30 minutes, before telling staff)

Use your own account and, if possible, two colleagues: one at an office desktop, one on a
phone.

| Test | What to do | What you should see |
| --- | --- | --- |
| Clock in on an office desktop | Press **Clock in** at an office computer | Office network: Pass |
| Clock in on a phone in the office | Press **Clock in**, allow location when asked | Location: Pass (or Uncertain if indoor accuracy is poor) |
| Clock in from home | Press **Clock in** on home Wi-Fi | Office network: Fail. Not blocked during the pilot |
| Refuse location | Press **Clock in**, choose "Don't allow" | Location: Uncertain, with a plain message. Clock-in still recorded |
| Try again | Press **Clock in** again after allowing location | The check is re-run and the result updates |
| Clock out | Press **Clock out** | Clock-out time recorded. Clock-out is never blocked |
| Press twice | Double-click **Clock in** | Only one record for the day |

Then, as a manager, look at **Today in the office**:

- Everyone you oversee is listed with **Checked in**, **Checked out**, **Not checked in** or
  **Awaiting review**, and the check result in words.
- Click **Review** on a Fail or Uncertain record, choose accept or reject, give a reason, save.
- Click **Correct times** to fix a forgotten clock-out. A reason is required.
- Click **Add entry** for someone who couldn't clock in (for example their phone died).
- You should **not** be able to review your own record.

Please send the development team a screenshot of anything that looks wrong, with the time
and the person's name.

## Step 4. Run the pilot (at least two working weeks per office)

- Ask staff to press **Clock in** when they arrive and **Clock out** when they leave.
- Each week, look at **Today in the office** for a few days and review Fail and Uncertain
  records with the people involved. Most will have a simple cause (VPN, backup internet,
  phone indoors).
- Under **Unmatched networks seen during the pilot**, the system lists internet address
  ranges that check-ins came from but which aren't set up yet. Ask IT whether any of them
  belong to the office before adding them. A listed range alone does not prove where someone
  was.
- Adjust the radius, accuracy limit and network ranges as you learn. Every change is logged
  under **Recent audit**.

## Step 5. Decide what happens next

At the end of the pilot, decide for each office in writing:

- Is the result good enough to keep using as information only? (Most offices may stay here.)
- Or should the office move to **Enforce**? In Enforce mode, a check-in that doesn't pass is
  held as **Awaiting review** until a manager accepts it. Nobody is turned away, but managers
  must review every held check-in.

Talk to the development team before switching any office to **Enforce**. The system asks for
an explicit confirmation and logs the change.

## Who can see what

- Admin, Directors and HR: every office.
- Department heads: people in their own department at their own office.
- Line managers: their direct reports.
- Nobody can review or correct their own record.

## Privacy

- Exact locations and full internet addresses are never stored, only the result, the reason,
  a rough distance (inside, near, far) and a partial network address.
- Location is asked for only at the moment someone presses Clock in or Clock out.
- Check-in records and their history are deleted automatically after 3 months. Office rule
  changes are kept so we know who changed what.
