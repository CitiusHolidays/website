# Office check-in: setup guide for directors

Office check-in lets staff press **Clock in** and **Clock out** in Citius Connect, and shows
managers who is in the office today. For now it only **records** the result. Nobody is ever
blocked from clocking in.

Do the steps below once for each office: Mumbai/Thane, Bengaluru and Kolkata.

---

## 1. Ask IT one question (5 minutes)

Send this message to whoever manages the office internet:

> Hi, for our new office check-in system I need the **public IP address** of our office
> internet connection. Please include the backup connection if we have one. Also, do people
> working from home use a company VPN that makes them appear to come from the office internet?

Keep their reply. You'll need it in step 3.

## 2. Get the office location (2 minutes)

1. Stand at the office entrance with your phone.
2. Open Google Maps and press and hold on your blue dot to drop a pin.
3. Copy the two numbers shown at the top, for example `19.2166, 72.9722`.

## 3. Set up the office in Citius Connect (10 minutes)

Open **Citius Connect → Admin → Office check-in** and scroll down to **Office rules**.

1. **Add office.** Type the office name and a short code (for example `BOM`), then press
   **Add office**.
2. Select the office you just added, and fill in the rule:

   | Field | What to enter |
   | --- | --- |
   | Choose what to check | **Office network or location** |
   | Office network ranges | The IP address from IT, with the label "Main line". Add the backup line too if there is one. If IT said home VPN users appear as the office, choose **Office, shared with VPN** for that address. Otherwise choose **Office**. |
   | Latitude / Longitude | The two numbers from step 2 |
   | Radius (m) | `150` |
   | Accuracy limit (m) | `75` |
   | Time zone | `Asia/Kolkata` |
   | Mode | **Report only** (leave it like this) |
   | Reason | `First setup` |

3. Press **Save rule**.
4. Under **Staff office**, pick each person who works at this office, select the office, type
   `First setup` as the reason, and press **Save assignment**.

If the screen shows an error when you save, take a screenshot and send it to the development
team.

## 4. Try it yourself (5 minutes)

| Do this | You should see |
| --- | --- |
| Press **Clock in** on an office computer | **Office network: Pass** |
| Press **Clock in** on your phone in the office and allow location | **Location: Pass** (inside the building it may say **Uncertain**, which is fine) |
| Press **Clock out** | Your clock-out time appears |

Then scroll to **Today in the office**. You should see your staff, with who has clocked in.

## 5. Each week during the pilot (10 minutes)

- Open **Today in the office** and look for **Fail** or **Uncertain**.
- Ask the person what happened (working from home, phone indoors, backup internet). It is a
  prompt to ask, not proof someone was absent.
- If the check was wrong, press **Review**, choose accept, and write why.
- If someone forgot to clock out, press **Correct times**.
- If someone couldn't clock in at all, press **Add entry**.

Send the development team a screenshot of anything that keeps failing for people who are in the
office. They will adjust the settings.

## Please don't

- Don't change **Mode** to **Enforce**. Talk to the development team first.
- Don't invent IP addresses or locations. Leave a field empty and ask.

## Good to know

- Location is only asked for at the moment someone presses Clock in or Clock out. Nobody is
  tracked during the day.
- Exact locations and full internet addresses are never stored.
- Records are deleted automatically after 3 months.
