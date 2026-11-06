/**
 * Draft Privacy Policy for legal and management review.
 *
 * Every statement here describes what the website, CRM and Citius Connect code does today, or is
 * marked as planned. Points that need Citius or legal confirmation carry a visible
 * "[To confirm: ...]" marker so reviewers can find them; the policy page highlights each one.
 * Retention values that the code sets are checked against their source constants in
 * privacyPolicy.test.js.
 */

import { policyLink, richText } from "./policyText";

export const TO_CONFIRM_PATTERN = /\[To confirm: [^\]]+\]/g;

const contactLink = policyLink("/contact", "Contact page");
const accountDeletionLink = policyLink(
  "/contact?intent=account-deletion",
  "account deletion request form"
);
const termsLink = policyLink("/policies?view=terms", "Terms & Conditions");

export const privacyPolicy = {
  content: [
    {
      heading: "1. Who we are",
      list: [
        "Citius Holidays (“Citius”, “we”, “us”) decides why and how the personal data described in this policy is processed. Under India’s Digital Personal Data Protection Act, 2023 (the “Act”), that makes us the Data Fiduciary. [To confirm: full legal name of the entity (the Kolkata office map listing reads “Citius Holidays Private Limited”), its CIN and its registered office address.]",
        richText(
          "Our head office is in Kolkata, and we also have offices in Thane (Mumbai) and Bengaluru. Their addresses are on our ",
          contactLink,
          "."
        ),
        "This policy covers citiusholidays.com (including Citius Concierge, Sacred Bharat and the Citius Journal), your Citius travel account, the records we keep about travellers on our trips, our staff app Citius Connect, and the Citius customer app we are building.",
        "Airlines, hotels, payment pages and other websites we link to have their own privacy policies. This policy does not cover them.",
      ],
    },
    {
      heading: "2. The personal data we collect",
      subsections: [
        {
          list: [
            "Your name, email address, and optionally your phone number.",
            "What you tell us about the trip: subject and message, destination, number of travellers and preferred travel date.",
            "The time you ticked the box agreeing that we may contact you about the enquiry.",
          ],
          title: "When you send an enquiry (Contact page or Citius Concierge)",
        },
        {
          list: [
            "Your name, email address and a password. The password is stored only in hashed form.",
            "If you sign in with Google: the name, email address and profile photo Google shares with us.",
            "A phone number, if you add one to your profile.",
            "Sign-in session records, including the IP address and browser or device details recorded when you sign in.",
            "We plan to offer sign-in by email link and by SMS code. [To confirm: neither is available today; name the SMS provider here before launch.]",
          ],
          title: "When you create a Citius account",
        },
        {
          list: [
            "The trip, number of travellers, traveller details you enter, amount, currency and booking status.",
            "Reference numbers from our payment provider, Razorpay, such as order and payment IDs.",
            "You enter card, UPI or bank details on Razorpay’s checkout. We do not receive or store your card details.",
          ],
          title: "When you book and pay online",
        },
        {
          list: [
            "Name, gender, phone number and email address.",
            "Food preference, flight meal preference, and any special requests you make. Special requests can include health information, so please tell us only what we need to look after you.",
            "Room type, who you share a room with and your hotel allocation.",
            "Travel dates, departure city, flight tickets and booking references (PNRs).",
            "Visa status and appointment dates, and passport details: passport number, date of birth, nationality, and issue and expiry dates, plus a scan of the passport.",
            "Whether you travel as an employee, client or guest of the organiser, and who pays for the trip.",
            "Whether you have given or withdrawn permission for us to contact you about future trips.",
          ],
          title: "When you travel with us",
        },
        {
          list: [
            "If you fill in a post-trip feedback form: an optional name, your comments, and any photos you choose to upload. We remove location and camera details (EXIF data) from those photos.",
            "If you use Sacred Bharat while signed in: your display name, bio and home city, the temples you have visited or saved, any notes, and the groups you join.",
            "Your Sacred Bharat display name (or your account name if you have not set one) appears on the public Sacred Bharat leaderboard unless you ask us to remove it. Your Sacred Bharat profile page is public only if you choose. [To confirm: the website has no opt-out button yet, although our systems support opting out; decide whether to add one or make leaderboard listing opt-in.]",
            "If you play the Sacred Bharat Edition game without an account: a random player code kept in your browser. We store only a scrambled (hashed) copy of that code with your game events.",
            "If you use the event photo booth: your photo stays on your device and is never sent to us. We count how the booth is used, without names, photos or contact details.",
          ],
          title: "Feedback, Sacred Bharat and the photo booth",
        },
      ],
    },
    {
      heading: "3. Why we use your data, and on what basis",
      list: [
        "To reply to your enquiry and plan your trip. We use your contact details only for the enquiry you sent.",
        "To create your account, keep it secure and show you your journeys.",
        "To book and deliver your trip: flights, hotels, visas, transfers, rooming and on-trip support from our tour managers.",
        "To take payments, issue invoices and process refunds.",
        "To ask for your feedback and improve our trips.",
        "To run Sacred Bharat features you choose to use.",
        "To keep our website and systems secure, and to stop spam, abuse and fraud.",
        "To meet our legal obligations, such as tax and GST records and visa and immigration requirements.",
        "To tell you about future trips, but only if you have given us permission. You can withdraw that permission at any time.",
        "We rely either on your consent or on a “legitimate use” allowed by section 7 of the Act, for example when you give us your details so that we can deliver a trip you asked for, or when the law requires us to keep records. [To confirm: legal to confirm the lawful basis for each purpose above.]",
      ],
    },
    {
      heading: "4. Notice, consent and withdrawing consent",
      list: [
        "Where we rely on consent, we ask for it clearly before we collect the data, for example with the checkbox on our enquiry forms. We ask separately for each purpose that needs it.",
        "You can withdraw consent at any time, and it will be as easy as giving it: contact us using the details in section 14. Withdrawing consent does not affect what we did before, but it may mean we cannot continue a booking that depends on that data.",
        "Giving feedback or using the photo booth does not mean you agree to marketing.",
        "[To confirm: whether Citius will also accept requests made through a Consent Manager registered with the Data Protection Board.]",
      ],
    },
    {
      heading: "5. AI features",
      list: [
        "Citius Concierge (our website chat) and the Sacred Bharat Journey Planner use AI models through a service called OpenRouter. OpenRouter passes each request to the company that runs the model, such as Z.ai, NVIDIA, Google or OpenAI.",
        "What you type into Citius Concierge is sent to OpenRouter and that model provider to write a reply. The Journey Planner sends only the temples and trails you pick, not your personal details.",
        "We do not store chat conversations on our servers. Your conversation is kept in your browser until you close the tab. We keep a usage record (feature, model, response time, size of the request and whether it worked) for 30 days.",
        "Please do not type passport, payment or other sensitive personal details into the chat. If you want us to contact you, use the contact form in the chat. The conversation itself is not attached to your enquiry.",
        "We do not use AI to make decisions about you.",
        "[To confirm: the chat currently uses OpenRouter’s free models and does not ask providers to avoid storing or training on prompts. Decide whether this is acceptable, or change the configuration, before publication.]",
      ],
    },
    {
      heading: "6. Who we share your data with",
      subsections: [
        {
          list: [
            "Airlines, hotels, ground handlers, transport companies and event partners who provide the services in your itinerary.",
            "Consulates, embassies, visa application centres and immigration authorities when we help with your visa.",
            "Insurers, if we arrange travel insurance for you.",
          ],
          title: "To deliver your trip",
        },
        {
          list: [
            "Vercel: website hosting, and page-view and performance statistics.",
            "Convex: our database and file storage.",
            "Resend: sending emails, such as sign-in emails and enquiry notifications to our team.",
            "Razorpay: online payments.",
            "Cloudflare Turnstile: checking that forms and chat are used by people, not bots. Your IP address is sent to Cloudflare for this check.",
            "OpenRouter and the AI model providers described in section 5.",
            "Google: “Continue with Google” sign-in, and the maps on our Contact page.",
            "Sanity: managing our gallery and Journal content.",
            "[To confirm: data processing agreements are in place with each of these providers.]",
          ],
          title: "Service providers who process data for us",
        },
        {
          list: [
            "The person or company who organised your group trip can see the trip details in their account. Prices are shown only to the organiser.",
            "Government or law-enforcement authorities, when the law requires it.",
            "We do not sell your personal data.",
          ],
          title: "Others",
        },
      ],
    },
    {
      heading: "7. Company and group trips",
      list: [
        "When a company books a trip for its employees, dealers or guests, the company usually sends us the travellers’ details. The company is responsible for having the right to share those details and for telling its travellers about this policy.",
        "Depending on the contract, Citius may decide how the data is used (as a Data Fiduciary), or may process it only on the company’s instructions (as a Data Processor). [To confirm: our role under each corporate or MICE contract; legal to review the standard contract terms.]",
        "Whichever applies, travellers can contact us directly about their own data, and we will help or pass the request to the company.",
      ],
    },
    {
      heading: "8. Children",
      list: [
        "We treat anyone under 18 as a child.",
        "A child does not get a login of their own. A child’s details are linked to a parent or lawful guardian travelling on the same trip, with up to two guardians per child.",
        "We process a child’s personal data only with the verifiable consent of their parent or lawful guardian.",
        "We do not show photo galleries or documents for children in customer-facing features, and we do not track children’s behaviour or target advertising at them.",
        "[To confirm: our systems do not yet record a traveller’s age or guardian. Confirm how verifiable parental consent is collected for current bookings, and the minimum age for creating an account and using Sacred Bharat.]",
      ],
    },
    {
      heading: "9. Transfers outside India",
      list: [
        "International trips need us to share traveller details with airlines, hotels, ground handlers and visa authorities in the countries you visit. They handle that data under the laws of those countries.",
        "Some of our service providers may process data outside India, for example to deliver emails, run the AI chat or count website visits.",
        "Our website runs in Vercel’s Mumbai region. [To confirm: the region of our Convex database and file storage, and where Resend, OpenRouter and Sanity process data.]",
        "We will follow any restriction the Government of India places on transfers to particular countries.",
      ],
    },
    {
      heading: "10. How long we keep your data",
      list: [
        "We keep personal data only for as long as we need it for the purpose we collected it for, or as long as the law requires, and then delete it.",
      ],
      subsections: [
        {
          list: [
            "Records of each time a tour manager views a passport in Citius Connect are deleted when that trip’s passport viewing window closes, at midnight IST at the end of the day after the trip ends.",
            "The offline trip pack on a tour manager’s phone is deleted 7 days after the trip’s last day, and straight away when they sign out or their access is withdrawn.",
            "Staff office check-in records are deleted after 92 days.",
            "Files our staff delete from a booking can be restored for 14 days and are then permanently deleted.",
            "Temporary passenger list exports are deleted after 15 minutes.",
            "AI chat usage records are deleted after 30 days. Sacred Bharat Edition game events are deleted after 30 days.",
            "Records used to stop abuse of the photo booth are deleted after one day.",
            "Sign-in sessions expire after 30 days. Email verification and password reset links expire after 1 hour.",
            "Feedback links expire after 7, 14 or 30 days, as chosen by our staff.",
          ],
          title: "Periods our systems apply automatically",
        },
        {
          list: [
            "Enquiries, accounts, bookings, traveller records (including passport details and scans), feedback, Sacred Bharat profiles, staff records and staff access logs are kept until they are no longer needed. [To confirm: a retention period for each of these. Our systems do not yet delete them automatically.]",
            "[To confirm: legal to check the minimum retention the Rules require for processing logs (we understand at least one year applies to some logs), and whether this conflicts with deleting passport viewing records at the end of each trip.]",
          ],
          title: "Periods to be set",
        },
      ],
    },
    {
      heading: "11. How we protect your data",
      list: [
        "Passport details and passport scans are encrypted before we store them. Only the last four digits of a passport number are kept unencrypted, so staff can recognise the right passport.",
        "Staff can see traveller data only when their role needs it. Access is checked by our servers, not just hidden in the screen.",
        "Opening or downloading a passport scan is logged.",
        "Tour managers can view passports only for their own group, only from the day before the trip starts until the day after it ends, and only while online. Passports are never saved on their phone, and screenshots are blocked on the passport screen.",
        "Trip data saved on a tour manager’s phone for offline use is encrypted and contains no passport numbers or scans.",
        "Our website uses HTTPS, bot checks and rate limits. Our server logs record technical details of each request, not the contents of forms.",
        "No system is completely secure. If a personal data breach happens, we will inform the people affected and the Data Protection Board of India as the law requires.",
      ],
    },
    {
      heading: "12. Citius Connect and the Citius customer app",
      subsections: [
        {
          list: [
            "Citius Connect is our app for tour managers. Only staff with the tour manager role can use it.",
            "For offline use, it saves the tour manager’s own group: travellers’ names and phone numbers, whether each passport and visa is ready, contacts and the itinerary. It does not save passport numbers, scans, email addresses or payment details.",
            "The app works offline for up to 14 days after the tour manager last signed in online.",
            "Tour managers can photograph receipts for trip expenses. These photos stay in the app’s private storage, are not backed up, and are deleted when the tour manager signs out.",
            "The app does not track location and contains no advertising, analytics or crash-reporting tools.",
          ],
          title: "Citius Connect (staff app)",
        },
        {
          list: [
            "We are building a Citius app for travellers. It is not available yet.",
            "We expect it to show your trips, day plans, contacts and announcements, keep an offline copy of trip information, and let you delete your account from the app.",
            "Features such as photos, document upload and notifications will ask for your consent separately before they use your data.",
            "[To confirm: final launch features and data use. Update this section before the app is published.]",
          ],
          title: "Citius customer app (planned)",
        },
      ],
    },
    {
      heading: "13. Your rights",
      list: [
        "Access: ask for a summary of the personal data we hold about you, how we use it, and who we have shared it with.",
        "Correction: ask us to correct, complete or update your data. You can change your name and phone number yourself in your account profile.",
        richText(
          "Erasure: ask us to delete your data when it is no longer needed for the purpose you gave it for, unless the law requires us to keep it. To delete your account, use our ",
          accountDeletionLink,
          "."
        ),
        "Withdraw consent: see section 4.",
        "Grievance redressal: complain to us about how we handle your data, using the details in section 14.",
        "Nomination: name another person to exercise your rights if you die or become unable to do so.",
        "We will check your identity before acting on a request. We aim to respond within [To confirm: our response period, which must not exceed 90 days].",
        "The Act also asks you to give us accurate information and not to make false or frivolous complaints.",
      ],
    },
    {
      contact: {
        email: "info@citiusholidays.com",
        note: "Write “Privacy request” in the subject line and include your booking reference if you have one.",
        team: "Citius Holidays – Privacy requests",
      },
      heading: "14. Grievance Officer and contact",
      list: [
        "Grievance Officer: [To confirm: name of the Grievance Officer].",
        "Email: [To confirm: dedicated privacy or grievance email address].",
        "Phone: [To confirm: phone number].",
        "Address: [To confirm: postal address for privacy requests].",
        "If you are not satisfied with our response, you can complain to the Data Protection Board of India.",
        "Until the details above are confirmed, you can send privacy requests to the address below. [To confirm: whether info@citiusholidays.com should be used for privacy requests.]",
      ],
    },
    {
      heading: "15. Cookies and similar technologies",
      list: [
        "Sign-in cookies keep you signed in to your account. They are needed for the account to work.",
        "Your browser also stores your Citius Concierge conversation (until you close the tab), your Sacred Bharat progress and game code, and staff layout settings.",
        "We use Vercel Analytics and Speed Insights to count page views and measure performance. They are not used on our feedback form.",
        "Our Contact page shows Google Maps, and some Spiritual Trails pages show YouTube videos. Google may set its own cookies when you use them. [To confirm: whether these embeds set cookies, and whether a cookie notice is needed.]",
        "We do not use advertising cookies or tracking pixels.",
      ],
    },
    {
      heading: "16. Changes to this policy",
      list: [
        "We will update this policy when our services or the law change, and show the date of the latest version at the top of the page. If a change significantly affects how we use your data, we will tell you before it takes effect.",
        richText("Bookings are also governed by our ", termsLink, "."),
      ],
    },
  ],
  draftNotice:
    "Draft for legal and management review. It is not legal advice and is not yet in force. Highlighted “To confirm” items need confirmation from Citius Holidays or legal counsel before publication.",
  intro:
    "This policy explains what personal data Citius Holidays collects, why we use it, who we share it with, how long we keep it and how we protect it. It also explains your rights under the Digital Personal Data Protection Act, 2023 and the Digital Personal Data Protection Rules, 2025. [To confirm: legal to confirm the citation of the Rules and which provisions are in force on the publication date.]",
  lastUpdated: "Draft, November 2026",
  title: "Privacy Policy",
};
