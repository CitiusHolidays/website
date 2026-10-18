import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";
import { modules } from "../test.setup";

async function setup() {
  const t = convexTest({ modules, schema });
  const jobCardId = await t.run(async (ctx) => {
    await ctx.db.insert("staffUsers", {
      active: true,
      authUserId: "https://auth.citius.test|contacts",
      createdAt: 1,
      email: "contacts@citius-e2e.test",
      emailNormalized: "contacts@citius-e2e.test",
      name: "Contact editor",
      roles: ["Directors"],
      updatedAt: 1,
    });
    return await ctx.db.insert("jobCards", {
      clientName: "Synthetic client",
      confirmedPax: 1,
      createdAt: 1,
      createdBy: "contacts",
      jobCode: "JC/TEST/001/26-27",
      status: "Open",
      updatedAt: 1,
    });
  });
  const actor = t.withIdentity({
    issuer: "https://auth.citius.test",
    subject: "contacts",
    tokenIdentifier: "https://auth.citius.test|contacts",
  });
  return { actor, jobCardId, t };
}

const details = {
  foodPreference: "Veg",
  fullName: "Asha Rao",
  guestType: "Client",
  paymentType: "Company Paid",
  roomType: "Twin",
  visaRequired: false,
} as const;

describe("private guest contacts", () => {
  test("preserves unchanged legacy import phone values while validating new edits", async () => {
    const { actor, jobCardId, t } = await setup();
    const { id } = await actor.mutation(api.crm.travellers.create, { ...details, jobCardId });
    await t.run((ctx) => ctx.db.patch("travellers", id, { contactNo: "N/A from legacy import" }));
    await actor.mutation(api.crm.travellers.update, {
      contactNo: "N/A from legacy import",
      fullName: "Asha Rao updated",
      travellerId: id,
    });
    expect(await actor.query(api.crm.travellers.getListRow, { travellerId: id })).toMatchObject({
      contactNo: "N/A from legacy import",
      fullName: "Asha Rao updated",
    });
    await expect(
      actor.mutation(api.crm.travellers.update, {
        contactNo: "new invalid number",
        travellerId: id,
      })
    ).rejects.toThrow("cell number");
  });
  test("stores contacts without assuming promotional consent and supports clearing", async () => {
    const { actor, jobCardId, t } = await setup();
    const { id } = await actor.mutation(api.crm.travellers.create, {
      ...details,
      contactNo: "+91 99999 00001",
      email: " ASHA@example.test ",
      jobCardId,
    });
    expect(await actor.query(api.crm.travellers.getListRow, { travellerId: id })).toMatchObject({
      contactNo: "+91 99999 00001",
      email: "asha@example.test",
      marketingConsent: "not_recorded",
    });
    await expect(t.query(api.crm.travellers.getListRow, { travellerId: id })).rejects.toThrow();
    const customer = t.withIdentity({ issuer: "https://auth.citius.test", subject: "customer" });
    await expect(
      customer.query(api.crm.travellers.getListRow, { travellerId: id })
    ).rejects.toThrow();
    await t.run(async (ctx) => {
      await ctx.db.insert("staffUsers", {
        active: true,
        authUserId: "https://auth.citius.test|other-operator",
        createdAt: 1,
        email: "other@citius-e2e.test",
        emailNormalized: "other@citius-e2e.test",
        name: "Unassigned operator",
        roles: ["Operations"],
        updatedAt: 1,
      });
    });
    const outsider = t.withIdentity({
      issuer: "https://auth.citius.test",
      subject: "other-operator",
    });
    expect(await outsider.query(api.crm.travellers.getListRow, { travellerId: id })).toBeNull();
    await expect(
      outsider.mutation(api.crm.travellers.update, { email: "other@example.test", travellerId: id })
    ).rejects.toThrow("FORBIDDEN");
    await actor.mutation(api.crm.travellers.update, { contactNo: "", email: "", travellerId: id });
    expect(await actor.query(api.crm.travellers.getListRow, { travellerId: id })).toMatchObject({
      contactNo: "",
      email: "",
      marketingConsent: "not_recorded",
    });
  });

  test("does not transfer promotional permission to a changed email address", async () => {
    const { actor, jobCardId } = await setup();
    const { id } = await actor.mutation(api.crm.travellers.create, {
      ...details,
      email: "asha@example.test",
      jobCardId,
      marketingConsent: "granted",
      marketingConsentNote: "Signed opt-in form, 17 October 2026",
    });
    await actor.mutation(api.crm.travellers.update, { email: "new@example.test", travellerId: id });
    expect(await actor.query(api.crm.travellers.getListRow, { travellerId: id })).toMatchObject({
      email: "new@example.test",
      marketingConsent: "not_recorded",
    });
  });

  test("rejects malformed email and requires evidence for promotional permission", async () => {
    const { actor, jobCardId } = await setup();
    await expect(
      actor.mutation(api.crm.travellers.create, {
        ...details,
        email: "not an email",
        jobCardId,
      })
    ).rejects.toThrow("valid email");
    await expect(
      actor.mutation(api.crm.travellers.create, {
        ...details,
        email: "asha@example.test",
        jobCardId,
        marketingConsent: "granted",
      })
    ).rejects.toThrow("consent evidence");
    const { id } = await actor.mutation(api.crm.travellers.create, {
      ...details,
      email: "asha@example.test",
      jobCardId,
      marketingConsent: "granted",
      marketingConsentNote: "Guest opted in on signed form, 17 October 2026",
    });
    await actor.mutation(api.crm.travellers.update, {
      marketingConsent: "withdrawn",
      travellerId: id,
    });
    expect(await actor.query(api.crm.travellers.getListRow, { travellerId: id })).toMatchObject({
      marketingConsent: "withdrawn",
      marketingConsentRecordedBy: "https://auth.citius.test|contacts",
    });
  });
});
