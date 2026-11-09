# Office check-in: setup guide for directors

Office check-in lets staff press **Clock in** and **Clock out** in Citius Connect, and shows
managers who is in the office today. For now it only **records** the result. Nobody is ever
blocked from clocking in. The same text is sent to directors on WhatsApp.

## Office details (looked up on Google Maps, 5 November 2026)

| Office | Code | Address | Latitude | Longitude |
| --- | --- | --- | --- | --- |
| Thane | THN | 810, Capittal Tree, Pokhran Road No 2, Thane West 400606 | 19.2183687 | 72.9705434 |
| Bengaluru | BLR | Pachie's, 3C-982, 3rd Cross Road, Kalyan Nagar, Bengaluru 560043 | 13.0187393 | 77.6521613 |
| Kolkata | CCU | 207, The Chambers, 1865 Rajdanga Main Road, Kasba, Kolkata 700107 | 22.513929 | 88.3942969 |

The Thane pin is Google's "Capittal Tree sales office" listing for the building. The Kolkata pin
is the Citius Holidays listing. The Bengaluru pin is the Pachie's building. Confirm each with the
self-test in step 2.

## 1. Set up each office (about 10 minutes each, from anywhere)

Open **Citius Connect → Me → Office check-in** and scroll to **Office rules**.

1. Type the office name and code from the table, then press **Add office**.
2. Select the office and fill in:
   - **Choose what to check:** Location
   - **Latitude / Longitude:** from the table
   - **Radius (m):** 150
   - **Accuracy limit (m):** 75
   - **Time zone:** Asia/Kolkata
   - **Mode:** Report only (leave it)
   - **Reason:** First setup
3. Press **Save rule**.
4. Under **Staff office**, pick each person at that office, choose the office, type
   `First setup`, and press **Save assignment**.

## 2. Test it (at the office, 5 minutes)

- Press **Clock in** on your phone and allow location. It should say **Location: Pass**. Indoors
  it may say **Uncertain**, which is fine.
- If location is blocked (most often on a laptop whose Mac or Windows location setting is off for
  the browser), the page shows the steps to turn it on for that device.
- Press **Clock out**. Your time appears.
- Scroll to **Today in the office**. Your team is listed, and so are you, to look at only: your
  own record is reviewed by someone else.

## 3. Add the office internet (when IT replies)

Send IT this message:

> Hi, what is the public IP address of our office internet, and the backup line if we have one?
> Also, do people on the company VPN from home appear to come from the office internet?

When they reply, open the office rule:

1. Under **Office network ranges**, add the IP address with the label "Main line". If IT said VPN
   users appear as the office, choose **Office, shared with VPN**; otherwise choose **Office**.
2. Change **Choose what to check** to **Office network or location**.
3. Write a reason and press **Save rule**.

## Each week

When someone's clock-in check doesn't pass, they are asked where they're working: **On tour**,
**Sales call** or **Work from home**. Their answer shows in **Today in the office** in place of
**Fail** or **Uncertain**, and when you open them. It is what they told us, not something the
system checked, and it doesn't approve the check-in.

**On tour** and **Sales call** also save where the person was when they answered. Open the
person and press **Open in Google Maps** to see the exact point, with the time and how accurate the
reading was. Those two answers can't be chosen without sharing a location; **Work from home** saves
none.

Once someone has answered, their check no longer says **Fail**: On tour and Sales call read
**Under review**, and Work from home reads **Not in office**. **Fail** or **Uncertain** means they
haven't said where they are.

Look at **Today in the office** for **Fail** or **Uncertain** (no answer given) and for answers you
didn't expect. Ask the person what happened, then use **Review**, **Correct times** or **Add
entry**. A result is a prompt to ask, not proof someone was absent.

After clocking out, anyone can press **Clock in again** the same day. To remove a wrong session,
open the person and press **Delete session**: Admin's delete removes it completely, and a
director's delete needs a reason, which is kept with a record of the deletion.

Don't switch **Mode** to **Enforce** without talking to the development team first.

Location is only asked for when someone presses Clock in or Clock out, or answers On tour or Sales
call. Only those two answers keep an exact location, visible to the person and the people
who oversee them. Full internet addresses are never stored, and records are deleted after 3 months.
