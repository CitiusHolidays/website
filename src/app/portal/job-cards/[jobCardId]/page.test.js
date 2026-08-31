import { describe, expect, mock, test } from "bun:test";
import { Suspense } from "react";
import { renderToStaticMarkup } from "react-dom/server";

function JobCardCommandCenterMock({ jobCardId }) {
  return <div data-job-card-id={jobCardId} />;
}

mock.module("@/components/portal/jobCard/JobCardCommandCenter", () => ({
  default: JobCardCommandCenterMock,
}));

const { default: PortalJobCardCommandCenterPage } = await import("./page");

describe("Job Card detail shell", () => {
  test("keeps params and record data behind an authorized Staff fallback", async () => {
    const jobCardId = "private-job-card-id";
    const page = PortalJobCardCommandCenterPage({ params: Promise.resolve({ jobCardId }) });
    const suspense = page.props.children;

    expect(page.type).toBe("div");
    expect(suspense.type).toBe(Suspense);

    const fallback = renderToStaticMarkup(suspense.props.fallback);
    expect(fallback).toContain("Checking Job Card access");
    expect(fallback).not.toContain(jobCardId);

    const content = await suspense.props.children.type(suspense.props.children.props);
    expect(content.type).toBe(JobCardCommandCenterMock);
    expect(content.props.jobCardId).toBe(jobCardId);
  });
});
