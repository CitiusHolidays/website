function DashboardView({ summary, has }) {
  if (!summary) return <LoadingPanel />;

  const metrics = [
    { label: "Active Queries", value: summary.metrics.activeQueries, Icon: ClipboardList, permission: P.VIEW_QUERIES },
    { label: "Proposals Sent", value: summary.metrics.proposalsSent, Icon: FileText, permission: P.VIEW_PROPOSALS },
    { label: "Confirmed Jobs", value: summary.metrics.confirmedJobs, Icon: CheckCircle2, permission: P.VIEW_QUERIES },
    { label: "Open Job Cards", value: summary.metrics.jobCardsOpen, Icon: BriefcaseIcon, permission: P.VIEW_JOB_CARDS },
    { label: "Tickets Issued", value: summary.metrics.ticketsIssued, Icon: Ticket, permission: P.VIEW_TICKETING },
    { label: "Tickets Pending", value: summary.metrics.ticketsPending, Icon: Plane, permission: P.VIEW_TICKETING },
    { label: "Visa Pending", value: summary.metrics.visaPending, Icon: ShieldCheck, permission: P.VIEW_VISA },
    { label: "Outstanding", value: money(summary.metrics.outstandingAmount), Icon: CircleDollarSign, permission: P.VIEW_FINANCE },
    { label: "Pending Approvals", value: summary.metrics.pendingApprovals, Icon: CheckCircle2, permission: P.VIEW_APPROVALS },
    { label: "Revenue Pipeline", value: money(summary.metrics.revenuePipeline), Icon: CircleDollarSign, permission: P.VIEW_FINANCE },
  ].filter((metric) => has(metric.permission));

  const departmentWorkflow = (summary.departmentWorkflow || []).filter((item) => {
    if (item.label.startsWith("Sales")) return has(P.VIEW_QUERIES);
    if (item.label.startsWith("Contracting")) return has(P.VIEW_CONTRACTING);
    if (item.label.startsWith("Ops")) return has(P.VIEW_JOB_CARDS);
    if (item.label.startsWith("Ticketing")) return has(P.VIEW_TICKETING);
    if (item.label.startsWith("Finance")) return has(P.VIEW_FINANCE);
    return true;
  });

  const urgentActions = (summary.urgentActions || []).filter((item) => {
    if (item.type === "approvals") return has(P.VIEW_APPROVALS);
    if (item.type === "finance") return has(P.VIEW_FINANCE);
    if (item.type === "accounts") return has(P.MANAGE_JOB_CARDS);
    if (item.type === "ticketing") return has(P.VIEW_TICKETING);
    return has(P.VIEW_QUERIES);
  });

  const showOpsProgress =
    has(P.VIEW_JOB_CARDS) ||
    has(P.VIEW_TRAVELLERS) ||
    has(P.VIEW_TICKETING) ||
    has(P.VIEW_VISA) ||
    has(P.VIEW_OPERATIONS) ||
    has(P.VIEW_FINANCE);

  return (
    <div className="space-y-8">
      {metrics.length > 0 && (
        <div className="grid grid-flow-dense gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {metrics.map(({ label, value, Icon }, index) => (
            <StatCard key={label} label={label} value={value} Icon={Icon} index={index} featured={index === 0} />
          ))}
        </div>
      )}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.05 }}
        className="grid gap-5 xl:grid-cols-[1.35fr_0.9fr]"
      >
        {has(P.VIEW_JOB_CARDS) && (
          <Panel title="Active tours">
            {(summary.activeTours || []).length === 0 ? <EmptyState label="No active tours yet." /> : (
              <div className="space-y-4">
                {summary.activeTours.map((tour, index) => (
                  <motion.div
                    key={tour.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.06, duration: 0.35 }}
                    whileHover={{ y: -2 }}
                    className="overflow-hidden rounded-xl border border-brand-border bg-brand-light p-4 transition-shadow hover:shadow-md"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-brand-dark">{tour.jobCode} - {tour.clientName}</div>
                        <div className="text-xs text-brand-muted">{tour.destination || "Destination pending"} - {tour.pax} pax</div>
                      </div>
                      <Badge label={tour.status} tone="blue" />
                    </div>
                    <Progress label="Tickets issued" value={tour.ticketProgress} />
                    <Progress label="Visa approved" value={tour.visaProgress} />
                  </motion.div>
                ))}
              </div>
            )}
          </Panel>
        )}
        <Panel title="Urgent actions">
          {urgentActions.length === 0 ? <EmptyState label="No urgent actions." /> : (
            <div className="space-y-3">
              {urgentActions.map((item, index) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.06, duration: 0.35 }}
                  className="rounded-xl border border-brand-border bg-white p-3 text-sm"
                >
                  <div className="font-medium text-brand-dark">{item.label}</div>
                  <div className="mt-1 text-xs text-brand-muted">{item.type}</div>
                </motion.div>
              ))}
            </div>
          )}
        </Panel>
      </motion.div>
      {showOpsProgress && (
        <Panel title="Overall progress">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {has(P.VIEW_TICKETING) && <Progress label="Tickets issued / total pax" value={summary.progress.tickets.percent} />}
            {has(P.VIEW_VISA) && <Progress label="Visa approved / total pax" value={summary.progress.visas.percent} />}
            {has(P.VIEW_TRAVELLERS) && <Progress label="Guest data completed" value={summary.progress.guestData.percent} />}
            {has(P.VIEW_OPERATIONS) && <Progress label="Rooming completed" value={summary.progress.rooming.percent} />}
            {has(P.VIEW_FINANCE) && <Progress label="Payment received" value={summary.progress.payment.percent} />}
          </div>
        </Panel>
      )}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.12 }}
        className="grid gap-5 xl:grid-cols-2"
      >
        {has(P.VIEW_JOB_CARDS) && (
          <Panel title="Upcoming departures">
            {(summary.upcomingDepartures || []).length === 0 ? <EmptyState label="No upcoming departures." /> : (
              <DataTable compact rows={summary.upcomingDepartures} empty="No upcoming departures." columns={[
                ["JC", (row) => row.jobCode],
                ["Client", (row) => strong(row.clientName)],
                ["Date", (row) => row.travelStartDate],
                ["Pax", (row) => row.pax],
                ["TM", (row) => row.tourManagerName || "-"],
                ["Readiness", (row) => <Badge label={row.readiness} tone={statusTone(row.readiness)} />],
              ]} />
            )}
          </Panel>
        )}
        {has(P.VIEW_TEAM) && (
          <Panel title="My team">
            {(summary.myTeam || []).length === 0 ? <EmptyState label="No matching team members." /> : (
              <div className="grid gap-3 sm:grid-cols-2">
                {summary.myTeam.map((member) => (
                  <div key={member.id} className="rounded-xl border border-brand-border bg-brand-light p-4">
                    <div className="text-sm font-semibold text-brand-dark">{member.name}</div>
                    <div className="mt-1 text-xs text-brand-muted">{member.function || member.department}</div>
                    <div className="mt-1 text-xs text-brand-muted">{member.location || member.email}</div>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        )}
      </motion.div>
      {departmentWorkflow.length > 0 && (
        <Panel title="Department workflow">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {departmentWorkflow.map((item) => (
              <Progress key={item.label} label={`${item.label}: ${typeof item.value === "number" ? item.value.toLocaleString("en-IN") : item.value}`} value={item.percent} />
            ))}
          </div>
        </Panel>
      )}
    </div>
  );
}

