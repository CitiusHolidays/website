"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import {
  CheckCircle2,
  CircleDollarSign,
  ClipboardList,
  FileText,
  Hotel,
  Loader2,
  Plane,
  Plus,
  RefreshCw,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Ticket,
  Trash2,
  Users,
} from "lucide-react";
import {
  CABIN_CLASSES,
  CALLING_STATUSES,
  CONTRACTING_STATUSES,
  EXPENSE_CURRENCIES,
  EXPENSE_HEADS,
  FOOD_PREFERENCES,
  GUEST_TYPES,
  LEAD_STAGES,
  LOST_REASONS,
  PAYMENT_TYPES,
  PORTAL_PERMISSIONS,
  PORTAL_ROLES,
  QUERY_SOURCES,
  QUERY_TYPES,
  ROOM_TYPES,
  SALES_STATUSES,
  TICKET_STATUSES,
  TICKET_TYPES,
  TRAVEL_TYPES,
  VISA_STATUSES,
} from "@/lib/portal/constants";
import { getPipelineBuckets, getSalesPipelineBuckets } from "@/lib/portal/workflow";
import { api } from "@convex/_generated/api";

const P = PORTAL_PERMISSIONS;

const VIEW_META = {
  dashboard: { title: "Dashboard", subtitle: "Live overview across active enquiries, jobs, tickets, visas, and payments.", permission: P.VIEW_DASHBOARD },
  queries: { title: "All Sales Queries", subtitle: "Manage incoming MICE, group travel, FIT, B2B, cement, and spiritual enquiries.", permission: P.VIEW_QUERIES },
  pipeline: { title: "Pipeline View", subtitle: "Track query movement from contracting to confirmed or lost.", permission: P.VIEW_QUERIES },
  proposals: { title: "Proposals", subtitle: "Create, cost, and send proposals linked to active queries.", permission: P.VIEW_PROPOSALS },
  contracting: { title: "Contracting Dashboard", subtitle: "Assign contracting owners and move proposals through contracting statuses.", permission: P.VIEW_CONTRACTING },
  "accounts-job-cards": { title: "Accounts / Job Card Creation", subtitle: "Create Job Card numbers only after order confirmation.", permission: P.MANAGE_JOB_CARDS },
  "job-cards": { title: "Job Cards", subtitle: "Operational file control, progress, and pre-departure checklist status.", permission: P.VIEW_JOB_CARDS },
  travellers: { title: "Traveller Master Sheet", subtitle: "Guest details, hubs, food preferences, rooming, visa, ticket, and TM calling status.", permission: P.VIEW_TRAVELLERS },
  visa: { title: "Visa Tracker", subtitle: "Checklist, appointments, submission, approval, rejection, and re-application tracking.", permission: P.VIEW_VISA },
  ticketing: { title: "Ticket Dashboard", subtitle: "Ticket status summary across active Job Cards.", permission: P.VIEW_TICKETING },
  flights: { title: "Flights & PNR", subtitle: "Manage PNRs, routes, fare types, group seats, and airline records.", permission: P.VIEW_TICKETING },
  "seat-allocation": { title: "Seat Allocation", subtitle: "Manual stored seat assignments, holds, and blocks.", permission: P.VIEW_TICKETING },
  tickets: { title: "All Tickets", subtitle: "Issue, reissue, cancellation, name correction, and refund tracking.", permission: P.VIEW_TICKETING },
  hotels: { title: "Hotel / Rooming List", subtitle: "Hotel arrangements, rooming, special instructions, and ground planning.", permission: P.VIEW_OPERATIONS },
  "tour-managers": { title: "Tour Managers", subtitle: "TM assignment, calling status, availability, and active tour visibility.", permission: P.VIEW_TOUR_MANAGERS },
  finance: { title: "Finance", subtitle: "Fund projections, invoices, received amounts, balances, and closure status.", permission: P.VIEW_FINANCE },
  expenses: { title: "Expense Management", subtitle: "Tour-wise expenses, approval, and reimbursement tracking.", permission: P.VIEW_EXPENSES },
  approvals: { title: "Approvals", subtitle: "Unified approval queue for expenses and finance handoffs.", permission: P.VIEW_APPROVALS },
  reports: { title: "Reports", subtitle: "Revenue, headcount, and conversion snapshots for leadership review.", permission: P.VIEW_REPORTS },
  team: { title: "Team Directory", subtitle: "Read-only staff directory by department, role, and location.", permission: P.VIEW_TEAM },
  activity: { title: "Notifications / Activity Log", subtitle: "Audit trail for CRM status changes and workflow triggers.", permission: P.VIEW_ACTIVITY },
  settings: { title: "Settings / Dropdown Management", subtitle: "Staff allowlist and workflow dropdown reference values.", permission: P.MANAGE_STAFF },
};

const INITIAL_FORM = {
  clientName: "",
  contactPerson: "",
  contactMobile: "",
  destination: "",
  paxCount: "1",
  travelStartDate: "",
  travelEndDate: "",
  queryType: "MICE",
  travelType: "International Travel",
  budgetAmount: "",
  source: "Manual",
  leadStage: "Inquiry",
  salesOwnerName: "",
  notes: "",
  queryId: "",
  proposalId: "",
  preparedBy: "",
  landCostPerPax: "",
  airfarePerPax: "",
  itinerarySummary: "",
  ownerName: "",
  salesStatus: "Proposal in discussion",
  contractingStatus: "Proposal in progress",
  lostReason: "Price",
  confirmedPax: "1",
  roomCount: "",
  tourManagerName: "",
  jobCardId: "",
  fullName: "",
  travelHub: "",
  travelDate: "",
  guestCompanions: "",
  foodPreference: "Veg",
  guestType: "Employee",
  paymentType: "Company Paid",
  roomType: "Twin",
  visaRequired: "Yes",
  passportStatus: "Pending",
  hotelAllocation: "",
  domesticTravelRequired: "No",
  biometricAppointmentDate: "",
  extensionOfTour: "No",
  arrivingEarly: "No",
  visaRecordId: "",
  visaStatus: "Checklist Shared",
  appointmentDate: "",
  pnrCode: "",
  airline: "",
  route: "",
  fareType: "",
  totalSeats: "1",
  travellerId: "",
  pnrId: "",
  ticketNumber: "",
  ticketType: "FIT Ticket",
  ticketStatus: "Issued",
  cabinClass: "Economy",
  seatPreference: "",
  seatNumber: "",
  seatStatus: "Assigned",
  hotelName: "",
  city: "",
  checkInDate: "",
  checkOutDate: "",
  staffId: "",
  staffName: "",
  staffEmail: "",
  staffRoles: ["Sales"],
  staffActive: true,
  invoiceNumber: "",
  expectedAmount: "",
  receivedAmount: "",
  dueDate: "",
  category: "",
  expenseDate: "",
  particulars: "",
  currency: "INR",
  cardAmount: "",
  cashAmount: "",
  epayAmount: "",
  amount: "",
  paidBy: "",
  department: "",
  staffFunction: "",
  mobile: "",
  location: "",
};

export default function PortalWorkspace({ view = "dashboard" }) {
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(INITIAL_FORM);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [pipelineMode, setPipelineMode] = useState("sales");

  const { isAuthenticated, isLoading: isAuthLoading } = useConvexAuth();
  const access = useQuery(api.crm.staff.getMyPortalAccess, isAuthenticated ? {} : "skip");
  const has = (permission) => Boolean(access?.permissions?.includes(permission));
  const meta = VIEW_META[view] || VIEW_META.dashboard;
  const allowed = access?.allowed && has(meta.permission);
  const canFetch = isAuthenticated && access?.allowed;

  const summary = useQuery(api.crm.dashboard.getPortalSummary, canFetch && allowed && view === "dashboard" ? {} : "skip");
  const queries = useQuery(api.crm.queries.list, canFetch && has(P.VIEW_QUERIES) ? {} : "skip");
  const proposals = useQuery(api.crm.proposals.list, canFetch && has(P.VIEW_PROPOSALS) ? {} : "skip");
  const jobCards = useQuery(api.crm.jobCards.list, canFetch && has(P.VIEW_JOB_CARDS) ? {} : "skip");
  const travellers = useQuery(api.crm.travellers.list, canFetch && has(P.VIEW_TRAVELLERS) ? {} : "skip");
  const visas = useQuery(api.crm.visa.list, canFetch && has(P.VIEW_VISA) ? {} : "skip");
  const ticketDashboard = useQuery(api.crm.ticketing.dashboard, canFetch && has(P.VIEW_TICKETING) ? {} : "skip");
  const pnrs = useQuery(api.crm.ticketing.listPnrs, canFetch && has(P.VIEW_TICKETING) ? {} : "skip");
  const tickets = useQuery(api.crm.ticketing.listTickets, canFetch && has(P.VIEW_TICKETING) ? {} : "skip");
  const seats = useQuery(api.crm.ticketing.listSeatAllocations, canFetch && has(P.VIEW_TICKETING) ? {} : "skip");
  const hotels = useQuery(api.crm.ops.listHotels, canFetch && has(P.VIEW_OPERATIONS) ? {} : "skip");
  const tourManagers = useQuery(api.crm.ops.listTourManagers, canFetch && has(P.VIEW_TOUR_MANAGERS) ? {} : "skip");
  const invoices = useQuery(api.crm.finance.listInvoices, canFetch && has(P.VIEW_FINANCE) ? {} : "skip");
  const expenses = useQuery(api.crm.finance.listExpenses, canFetch && has(P.VIEW_EXPENSES) ? {} : "skip");
  const financeOverview = useQuery(api.crm.finance.getFinanceOverview, canFetch && has(P.VIEW_FINANCE) && view === "finance" ? {} : "skip");
  const approvals = useQuery(api.crm.approvals.list, canFetch && has(P.VIEW_APPROVALS) ? {} : "skip");
  const reports = useQuery(api.crm.reports.overview, canFetch && has(P.VIEW_REPORTS) && view === "reports" ? {} : "skip");
  const team = useQuery(
    api.crm.staff.listDirectory,
    canFetch && (has(P.VIEW_TEAM) || view === "contracting") ? {} : "skip",
  );
  const activity = useQuery(api.crm.activity.listActivity, canFetch && has(P.VIEW_ACTIVITY) ? { limit: 80 } : "skip");
  const notifications = useQuery(api.crm.activity.listNotifications, canFetch ? { limit: 80 } : "skip");
  const dropdowns = useQuery(api.crm.settings.listDropdowns, canFetch && view === "settings" ? {} : "skip");
  const staff = useQuery(api.crm.staff.listStaff, canFetch && has(P.MANAGE_STAFF) ? {} : "skip");

  const createQuery = useMutation(api.crm.queries.create);
  const submitToContracting = useMutation(api.crm.queries.submitToContracting);
  const assignContracting = useMutation(api.crm.queries.assignContracting);
  const updateQueryStatus = useMutation(api.crm.queries.updateStatus);
  const createProposal = useMutation(api.crm.proposals.create);
  const markProposalSent = useMutation(api.crm.proposals.markSent);
  const createJobCard = useMutation(api.crm.jobCards.createFromQuery);
  const updateJobStatus = useMutation(api.crm.jobCards.updateStatus);
  const createTraveller = useMutation(api.crm.travellers.create);
  const updateCallingStatus = useMutation(api.crm.travellers.updateCallingStatus);
  const updateVisa = useMutation(api.crm.visa.updateStatus);
  const createPnr = useMutation(api.crm.ticketing.createPnr);
  const createTicket = useMutation(api.crm.ticketing.createTicket);
  const saveSeat = useMutation(api.crm.ticketing.saveSeatAllocation);
  const createHotel = useMutation(api.crm.ops.createHotel);
  const createTourManager = useMutation(api.crm.ops.createTourManager);
  const createInvoice = useMutation(api.crm.finance.createInvoice);
  const createExpense = useMutation(api.crm.finance.createExpense);
  const submitExpenseForApproval = useMutation(api.crm.finance.submitExpenseForApproval);
  const decideApproval = useMutation(api.crm.approvals.decide);
  const upsertStaff = useMutation(api.crm.staff.upsertStaff);
  const removeQuery = useMutation(api.crm.queries.remove);
  const removeProposal = useMutation(api.crm.proposals.remove);
  const removeJobCard = useMutation(api.crm.jobCards.remove);
  const removeTraveller = useMutation(api.crm.travellers.remove);
  const removeVisa = useMutation(api.crm.visa.remove);
  const removePnr = useMutation(api.crm.ticketing.removePnr);
  const removeTicket = useMutation(api.crm.ticketing.removeTicket);
  const removeSeatAllocation = useMutation(api.crm.ticketing.removeSeatAllocation);
  const removeHotel = useMutation(api.crm.ops.removeHotel);
  const removeTourManager = useMutation(api.crm.ops.removeTourManager);
  const removeInvoice = useMutation(api.crm.finance.removeInvoice);
  const removeExpense = useMutation(api.crm.finance.removeExpense);
  const removeStaff = useMutation(api.crm.staff.removeStaff);
  const removeNotification = useMutation(api.crm.activity.removeNotification);

  const filteredQueries = useMemo(
    () => filterRows(queries || [], search, ["queryCode", "clientName", "destination", "queryType"]),
    [queries, search],
  );
  const filteredTeam = useMemo(
    () => filterRows(team || [], search, ["name", "email", "department", "function", "location"]),
    [team, search],
  );

  if (isAuthLoading || !isAuthenticated || access === undefined) {
    return <LoadingPanel />;
  }

  if (!allowed) {
    return (
      <div className="rounded-2xl border border-brand-border bg-white p-8 shadow-sm">
        <div className="font-heading text-xl font-semibold text-citius-blue">No access to this portal page</div>
        <p className="mt-2 text-sm text-brand-muted">
          Your account is signed in, but your staff role does not include this module.
        </p>
      </div>
    );
  }

  const openModal = (type, initial = {}) => {
    setError("");
    setForm({ ...INITIAL_FORM, ...initial });
    setModal(type);
  };

  const updateForm = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const deleteItem = async (label, mutation, args) => {
    setError("");
    if (!window.confirm(`Delete ${label}? This cannot be undone.`)) {
      return;
    }
    try {
      await mutation(args);
    } catch (err) {
      setError(err?.data || err?.message || "Unable to delete this record.");
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    setIsSaving(true);
    setError("");
    try {
      if (modal === "query") {
        await createQuery({
          clientName: form.clientName,
          contactPerson: form.contactPerson,
          contactMobile: form.contactMobile,
          destination: form.destination,
          paxCount: toNumber(form.paxCount, 1),
          travelStartDate: form.travelStartDate,
          travelEndDate: form.travelEndDate,
          queryType: form.queryType,
          travelType: form.travelType,
          budgetAmount: toNumber(form.budgetAmount, 0),
          source: form.source,
          salesOwnerName: form.salesOwnerName,
          notes: form.notes,
        });
      }
      if (modal === "assignContracting") {
        await assignContracting({ queryId: form.queryId, ownerName: form.ownerName });
      }
      if (modal === "queryStatus") {
        await updateQueryStatus({
          queryId: form.queryId,
          salesStatus: form.salesStatus,
          leadStage: form.leadStage,
          contractingStatus: form.contractingStatus,
          lostReason: form.salesStatus === "Order Lost" || form.contractingStatus === "Order Lost" ? form.lostReason : undefined,
        });
      }
      if (modal === "proposal") {
        await createProposal({
          queryId: form.queryId || undefined,
          clientName: form.clientName,
          preparedBy: form.preparedBy,
          landCostPerPax: toNumber(form.landCostPerPax, 0),
          airfarePerPax: toNumber(form.airfarePerPax, 0),
          itinerarySummary: form.itinerarySummary,
        });
      }
      if (modal === "jobCard") {
        await createJobCard({
          queryId: form.queryId || undefined,
          clientName: form.clientName,
          destination: form.destination,
          confirmedPax: toNumber(form.confirmedPax, 1),
          roomCount: toNumber(form.roomCount, 0),
          travelStartDate: form.travelStartDate,
          travelEndDate: form.travelEndDate,
          tourManagerName: form.tourManagerName,
        });
      }
      if (modal === "traveller") {
        await createTraveller({
          jobCardId: form.jobCardId,
          fullName: form.fullName,
          travelHub: form.travelHub,
          foodPreference: form.foodPreference,
          guestType: form.guestType,
          paymentType: form.paymentType,
          roomType: form.roomType,
          visaRequired: form.visaRequired === "Yes",
          domesticTravelRequired: form.domesticTravelRequired === "Yes",
          biometricAppointmentDate: form.biometricAppointmentDate,
          travelDate: form.travelDate,
          guestCompanions: form.guestCompanions,
          extensionOfTour: form.extensionOfTour === "Yes",
          arrivingEarly: form.arrivingEarly === "Yes",
          passportStatus: form.passportStatus,
          hotelAllocation: form.hotelAllocation,
          specialRequests: form.notes,
        });
      }
      if (modal === "visa") {
        await updateVisa({
          visaRecordId: form.visaRecordId,
          status: form.visaStatus,
          appointmentDate: form.appointmentDate,
          notes: form.notes,
        });
      }
      if (modal === "pnr") {
        await createPnr({
          jobCardId: form.jobCardId,
          pnrCode: form.pnrCode,
          airline: form.airline,
          route: form.route,
          fareType: form.fareType,
          totalSeats: toNumber(form.totalSeats, 1),
        });
      }
      if (modal === "ticket") {
        await createTicket({
          jobCardId: form.jobCardId,
          travellerId: form.travellerId || undefined,
          pnrId: form.pnrId || undefined,
          ticketNumber: form.ticketNumber,
          ticketType: form.ticketType,
          ticketStatus: form.ticketStatus,
          paymentType: form.paymentType,
          cabinClass: form.cabinClass,
          mealPreference: form.foodPreference,
          seatPreference: form.seatPreference,
          seatNumber: form.seatNumber,
        });
      }
      if (modal === "seat") {
        await saveSeat({
          jobCardId: form.jobCardId,
          travellerId: form.travellerId || undefined,
          pnrId: form.pnrId || undefined,
          seatNumber: form.seatNumber,
          status: form.seatStatus,
          notes: form.notes,
        });
      }
      if (modal === "hotel") {
        await createHotel({
          jobCardId: form.jobCardId,
          name: form.hotelName,
          city: form.city,
          checkInDate: form.checkInDate,
          checkOutDate: form.checkOutDate,
          specialInstructions: form.notes,
        });
      }
      if (modal === "tourManager") {
        await createTourManager({
          jobCardId: form.jobCardId || undefined,
          name: form.tourManagerName,
          email: form.staffEmail,
          phone: form.paidBy,
          availabilityDate: form.travelStartDate,
          notes: form.notes,
        });
      }
      if (modal === "invoice") {
        await createInvoice({
          jobCardId: form.jobCardId,
          invoiceNumber: form.invoiceNumber,
          expectedAmount: toNumber(form.expectedAmount, 0),
          receivedAmount: toNumber(form.receivedAmount, 0),
          dueDate: form.dueDate,
        });
      }
      if (modal === "expense") {
        await createExpense({
          jobCardId: form.jobCardId,
          tourManagerName: form.tourManagerName,
          category: form.category,
          expenseDate: form.expenseDate,
          particulars: form.particulars,
          currency: form.currency,
          cardAmount: toNumber(form.cardAmount, 0),
          cashAmount: toNumber(form.cashAmount, 0),
          epayAmount: toNumber(form.epayAmount, 0),
          amount: toNumber(form.amount, toNumber(form.cardAmount, 0) + toNumber(form.cashAmount, 0) + toNumber(form.epayAmount, 0)),
          paidBy: form.paidBy,
          notes: form.notes,
        });
      }
      if (modal === "staff") {
        await upsertStaff({
          staffId: form.staffId || undefined,
          email: form.staffEmail,
          name: form.staffName,
          roles: form.staffRoles,
          department: form.department,
          function: form.staffFunction,
          mobile: form.mobile,
          location: form.location,
          active: Boolean(form.staffActive),
        });
      }
      setModal(null);
      setForm(INITIAL_FORM);
    } catch (err) {
      setError(err?.data || err?.message || "Unable to save. Check required fields and permissions.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-[1500px]">
      <PageHeader
        title={meta.title}
        subtitle={meta.subtitle}
        search={search}
        setSearch={setSearch}
      >
        {renderHeaderAction(view, openModal, has)}
      </PageHeader>

      {error && !modal && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {view === "dashboard" && <DashboardView summary={summary} has={has} />}
      {view === "queries" && (
        <QueriesView rows={filteredQueries} openModal={openModal} has={has} deleteItem={deleteItem} removeQuery={removeQuery} submitToContracting={submitToContracting} />
      )}
      {view === "pipeline" && <PipelineView rows={queries || []} mode={pipelineMode} setMode={setPipelineMode} />}
      {view === "contracting" && (
        <ContractingView rows={filteredQueries} team={team || []} openModal={openModal} has={has} deleteItem={deleteItem} removeQuery={removeQuery} />
      )}
      {view === "proposals" && (
        <ProposalsView
          rows={proposals || []}
          markProposalSent={markProposalSent}
          has={has}
          deleteItem={deleteItem}
          removeProposal={removeProposal}
        />
      )}
      {view === "accounts-job-cards" && (
        <AccountsJobCardView rows={queries || []} openModal={openModal} />
      )}
      {view === "job-cards" && (
        <JobCardsView rows={jobCards || []} updateJobStatus={updateJobStatus} has={has} deleteItem={deleteItem} removeJobCard={removeJobCard} />
      )}
      {view === "travellers" && <TravellersView rows={travellers || []} has={has} deleteItem={deleteItem} removeTraveller={removeTraveller} />}
      {view === "visa" && <VisaView rows={visas || []} openModal={openModal} has={has} deleteItem={deleteItem} removeVisa={removeVisa} />}
      {view === "ticketing" && <TicketDashboardView summary={ticketDashboard} tickets={tickets || []} has={has} deleteItem={deleteItem} removeTicket={removeTicket} />}
      {view === "flights" && <PnrView rows={pnrs || []} has={has} deleteItem={deleteItem} removePnr={removePnr} />}
      {view === "seat-allocation" && <SeatView rows={seats || []} has={has} deleteItem={deleteItem} removeSeatAllocation={removeSeatAllocation} />}
      {view === "tickets" && <TicketsView rows={tickets || []} has={has} deleteItem={deleteItem} removeTicket={removeTicket} />}
      {view === "hotels" && <HotelsView rows={hotels || []} has={has} deleteItem={deleteItem} removeHotel={removeHotel} />}
      {view === "tour-managers" && <TourManagersView rows={tourManagers || []} travellers={travellers || []} has={has} deleteItem={deleteItem} removeTourManager={removeTourManager} updateCallingStatus={updateCallingStatus} />}
      {view === "finance" && <FinanceView rows={invoices || []} overview={financeOverview} has={has} deleteItem={deleteItem} removeInvoice={removeInvoice} />}
      {view === "expenses" && <ExpensesView rows={expenses || []} has={has} deleteItem={deleteItem} removeExpense={removeExpense} submitExpenseForApproval={submitExpenseForApproval} />}
      {view === "approvals" && <ApprovalsView rows={approvals || []} has={has} decideApproval={decideApproval} />}
      {view === "reports" && <ReportsView report={reports} />}
      {view === "team" && <TeamView rows={filteredTeam} />}
      {view === "activity" && (
        <ActivityView activity={activity || []} notifications={notifications || []} deleteItem={deleteItem} removeNotification={removeNotification} />
      )}
      {view === "settings" && (
        <SettingsView staff={staff || []} dropdowns={dropdowns || {}} openModal={openModal} deleteItem={deleteItem} removeStaff={removeStaff} />
      )}

      <EntityModal modal={modal} form={form} updateForm={updateForm} submit={submit} close={() => setModal(null)} error={error} isSaving={isSaving} queries={queries || []} jobCards={jobCards || []} travellers={travellers || []} visas={visas || []} pnrs={pnrs || []} team={team || []} />
    </div>
  );
}

function renderHeaderAction(view, openModal, has) {
  const actions = {
    queries: has(P.MANAGE_QUERIES) && ["query", "New Query"],
    contracting: has(P.MANAGE_CONTRACTING) && ["assignContracting", "Assign Contracting"],
    proposals: has(P.MANAGE_PROPOSALS) && ["proposal", "New Proposal"],
    "accounts-job-cards": has(P.MANAGE_JOB_CARDS) && ["jobCard", "Open Job Card"],
    "job-cards": has(P.MANAGE_JOB_CARDS) && ["jobCard", "Open Job Card"],
    travellers: has(P.MANAGE_TRAVELLERS) && ["traveller", "Add Traveller"],
    visa: has(P.MANAGE_VISA) && ["visa", "Update Visa"],
    flights: has(P.MANAGE_TICKETING) && ["pnr", "Add PNR"],
    tickets: has(P.MANAGE_TICKETING) && ["ticket", "Issue Ticket"],
    "seat-allocation": has(P.MANAGE_TICKETING) && ["seat", "Save Seat"],
    hotels: has(P.MANAGE_OPERATIONS) && ["hotel", "Add Hotel"],
    "tour-managers": has(P.MANAGE_TOUR_MANAGERS) && ["tourManager", "Add Tour Manager"],
    finance: has(P.MANAGE_FINANCE) && ["invoice", "Generate Invoice"],
    expenses: has(P.MANAGE_EXPENSES) && ["expense", "Add Expense"],
    settings: has(P.MANAGE_STAFF) && ["staff", "Add Staff"],
  };
  const action = actions[view];
  if (!action) return null;
  return (
    <button type="button" onClick={() => openModal(action[0])} className="portal-primary-btn">
      <Plus size={16} />
      {action[1]}
    </button>
  );
}

function PageHeader({ title, subtitle, children, search, setSearch }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"
    >
      <div>
        <h1 className="max-w-5xl font-heading text-3xl font-semibold leading-tight text-citius-blue md:text-4xl">
          {title}
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-brand-muted md:text-base">
          {subtitle}
        </p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <label className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-brand-muted/60" size={16} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="h-11 w-full rounded-full border border-brand-border bg-white pl-9 pr-4 text-sm outline-none transition focus:border-citius-blue focus:ring-2 focus:ring-citius-blue/10 sm:w-72"
            placeholder="Search current data"
          />
        </label>
        {children}
      </div>
    </motion.div>
  );
}

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

function QueriesView({ rows, openModal, has, deleteItem, removeQuery, submitToContracting }) {
  return (
    <DataTable
      rows={rows}
      empty="No queries yet."
      columns={[
        ["Query ID", (row) => row.queryCode],
        ["Client", (row) => strong(row.clientName)],
        ["Destination", (row) => row.destination || "TBD"],
        ["Pax", (row) => row.paxCount],
        ["Budget", (row) => money(row.budgetAmount)],
        ["Stage", (row) => <Badge label={row.leadStage || "Inquiry"} tone={statusTone(row.leadStage)} />],
        ["Type", (row) => <Badge label={row.queryType} tone="blue" />],
        ["Sales", (row) => row.salesOwnerName || "-"],
        ["Source", (row) => row.source || "-"],
        ["Action", (row) => has(P.MANAGE_QUERIES) && (
          <div className="flex flex-wrap gap-2">
            <button className="portal-small-btn" onClick={() => submitToContracting({ queryId: row.id })}>
              Submit
            </button>
            <button className="portal-small-btn" onClick={() => openModal("queryStatus", { queryId: row.id, salesStatus: row.salesStatus, leadStage: row.leadStage || "Inquiry", contractingStatus: row.contractingStatus })}>
              Update
            </button>
            <DeleteButton label={row.queryCode} onClick={() => deleteItem(row.queryCode, removeQuery, { queryId: row.id })} />
          </div>
        )],
      ]}
    />
  );
}

function ContractingView({ rows, team, openModal, has, deleteItem, removeQuery }) {
  const contractingTeam = team.filter((member) =>
    member.roles.some((role) => ["Contracting", "Contracting Head"].includes(role)),
  );
  const teamRows = contractingTeam.map((member) => ({
    id: member.id,
    name: member.name,
    email: member.email,
    location: member.location || "-",
    activeQueries: rows.filter(
      (query) =>
        query.contractingOwnerName === member.name &&
        !["Order Confirmed", "Order Lost"].includes(query.contractingStatus),
    ).length,
  }));

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="space-y-5"
    >
      <Panel title="Contracting team">
        <DataTable
          compact
          rows={teamRows}
          empty="No contracting staff in the directory yet."
          columns={[
            ["Name", (row) => strong(row.name)],
            ["Email", (row) => row.email],
            ["Location", (row) => row.location],
            ["Active queries", (row) => row.activeQueries],
          ]}
        />
      </Panel>
    <DataTable
      rows={rows}
      empty="No contracting queries yet."
      columns={[
        ["Received", (row) => formatDate(row.createdAt)],
        ["Query", (row) => row.queryCode],
        ["Client", (row) => strong(row.clientName)],
        ["Sales Owner", (row) => row.salesOwnerName || "-"],
        ["Contracting Owner", (row) => row.contractingOwnerName || "Unassigned"],
        ["Status", (row) => <Badge label={row.contractingStatus} tone={statusTone(row.contractingStatus)} />],
        ["Action", (row) => has(P.MANAGE_CONTRACTING) && (
          <div className="flex gap-2">
            <button className="portal-small-btn" onClick={() => openModal("assignContracting", { queryId: row.id })}>Assign</button>
            <button className="portal-small-btn" onClick={() => openModal("queryStatus", { queryId: row.id, salesStatus: row.salesStatus, leadStage: row.leadStage || "Inquiry", contractingStatus: row.contractingStatus })}>Status</button>
            <DeleteButton label={row.queryCode} onClick={() => deleteItem(row.queryCode, removeQuery, { queryId: row.id })} />
          </div>
        )],
      ]}
    />
    </motion.div>
  );
}

function PipelineView({ rows, mode, setMode }) {
  const buckets = mode === "sales" ? getSalesPipelineBuckets(rows) : getPipelineBuckets(rows);
  return (
    <div className="space-y-4">
      <div className="inline-flex rounded-full border border-brand-border bg-white p-1 shadow-sm">
        {[
          ["sales", "Sales pipeline"],
          ["contracting", "Contracting pipeline"],
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setMode(value)}
            className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
              mode === value ? "bg-citius-blue text-white" : "text-brand-muted hover:text-citius-blue"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="grid grid-flow-dense gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {Object.entries(buckets).map(([stage, items], index) => (
          <motion.div
            key={stage}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05, duration: 0.35 }}
            className="min-h-36 rounded-2xl border border-brand-border bg-white p-4 shadow-sm"
          >
            <div className="mb-3 flex items-center justify-between font-heading text-sm font-semibold text-citius-blue">
              {stage}
              <span className="grid h-7 w-7 place-items-center rounded-full bg-citius-orange text-xs font-bold text-white">
                {items.length}
              </span>
            </div>
            <div className="space-y-2">
              {items.map((item) => (
                <div key={item.id} className="rounded-xl border border-brand-border bg-brand-light p-3">
                  <div className="text-sm font-semibold text-brand-dark">{item.clientName}</div>
                  <div className="mt-1 text-xs text-brand-muted">{item.queryCode} - {item.destination || "TBD"} - {item.paxCount} pax</div>
                  <div className="mt-1 text-xs text-brand-muted">{item.salesOwnerName || "Unassigned"}</div>
                </div>
              ))}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function ProposalsView({ rows, markProposalSent, has, deleteItem, removeProposal }) {
  return (
    <DataTable
      rows={rows}
      empty="No proposals yet."
      columns={[
        ["Proposal", (row) => row.proposalCode],
        ["Client", (row) => strong(row.clientName)],
        ["Linked Query", (row) => row.query?.queryCode || "-"],
        ["Prepared By", (row) => row.preparedBy],
        ["Land/Pax", (row) => money(row.landCostPerPax)],
        ["Airfare/Pax", (row) => money(row.airfarePerPax)],
        ["Status", (row) => <Badge label={row.status} tone={statusTone(row.status)} />],
        ["Action", (row) => has(P.MANAGE_PROPOSALS) && (
          <div className="flex flex-wrap gap-2">
            {row.status !== "Sent" && (
              <button className="portal-small-btn" onClick={() => markProposalSent({ proposalId: row.id })}>
                <Send size={13} /> Send
              </button>
            )}
            <DeleteButton label={row.proposalCode} onClick={() => deleteItem(row.proposalCode, removeProposal, { proposalId: row.id })} />
          </div>
        )],
      ]}
    />
  );
}

function AccountsJobCardView({ rows, openModal }) {
  const confirmed = rows.filter((row) => row.salesStatus === "Order Confirmed" || row.contractingStatus === "Order Confirmed");
  return (
    <div className="space-y-5">
      <Panel title="Payment terms reference">
        <DataTable
          compact
          rows={[
            { id: "mice", type: "MICE / MICE Bidding", advance: "70-90%", balance: "10-30%", notify: "Sales, Contracting, Operations, Finance" },
            { id: "cement", type: "Cement", advance: "70-90%", balance: "10-30%", notify: "Sales, Contracting, Operations, Finance" },
            { id: "cement-bid", type: "Cement Bidding", advance: "70-100%", balance: "0-30%", notify: "Sales, Contracting, Operations, Finance" },
            { id: "fit", type: "FIT / Family Group", advance: "90-100%", balance: "0-10%", notify: "Sales, Contracting, Operations, Finance" },
            { id: "b2b", type: "B2B", advance: "80-100%", balance: "0-20%", notify: "Sales, Contracting, Finance" },
            { id: "spiritual", type: "Spiritual", advance: "Per plan", balance: "-", notify: "Sales, Operations, Finance" },
          ]}
          empty="No payment terms configured."
          columns={[
            ["Type", (row) => strong(row.type)],
            ["Advance", (row) => row.advance],
            ["Balance", (row) => row.balance],
            ["Notification", (row) => row.notify],
          ]}
        />
      </Panel>
      <DataTable
        rows={confirmed}
        empty="No confirmed orders waiting for Job Card creation."
        columns={[
          ["Query", (row) => row.queryCode],
          ["Client", (row) => strong(row.clientName)],
          ["Destination", (row) => row.destination || "TBD"],
          ["Pax", (row) => row.paxCount],
          ["Payment Terms", (row) => paymentTermLabel(row.queryType)],
          ["Action", (row) => (
            <button className="portal-small-btn" onClick={() => openModal("jobCard", { queryId: row.id, clientName: row.clientName, destination: row.destination, confirmedPax: String(row.paxCount), travelStartDate: row.travelStartDate, travelEndDate: row.travelEndDate })}>
              Open JC
            </button>
          )],
        ]}
      />
    </div>
  );
}

function JobCardsView({ rows, updateJobStatus, has, deleteItem, removeJobCard }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {rows.length === 0 ? <EmptyState label="No Job Cards yet." /> : rows.map((job, index) => (
        <motion.div
          key={job.id}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.05 }}
          whileHover={{ y: -4 }}
          className="overflow-hidden rounded-2xl border border-brand-border bg-white shadow-sm transition-shadow hover:shadow-lg"
        >
          <div className="flex items-center justify-between border-b border-brand-border px-5 py-4">
            <div>
              <div className="font-semibold text-brand-dark">{job.clientName}</div>
              <div className="text-xs text-brand-muted">{job.jobCode} - {job.destination || "Destination pending"}</div>
            </div>
            <Badge label={job.status} tone={statusTone(job.status)} />
          </div>
          <div className="space-y-3 p-5 text-sm">
            <div className="flex justify-between"><span>Confirmed pax</span><strong>{job.confirmedPax}</strong></div>
            <div className="flex justify-between"><span>Rooms</span><strong>{job.roomCount || "-"}</strong></div>
            <div className="flex justify-between"><span>Tour Manager</span><strong>{job.tourManagerName || "Unassigned"}</strong></div>
            <div className="text-xs text-brand-muted">{job.paymentTerms?.label || "Payment terms pending"}</div>
            {has(P.MANAGE_JOB_CARDS) && (
              <div className="flex flex-wrap gap-2">
                <button className="portal-small-btn" onClick={() => updateJobStatus({ jobCardId: job.id, status: job.status === "Open" ? "In Operations" : "Ready for Departure" })}>
                  <RefreshCw size={13} /> Advance Status
                </button>
                <DeleteButton label={job.jobCode} onClick={() => deleteItem(job.jobCode, removeJobCard, { jobCardId: job.id })} />
              </div>
            )}
          </div>
        </motion.div>
      ))}
    </div>
  );
}

function TravellersView({ rows, has, deleteItem, removeTraveller }) {
  return (
    <DataTable rows={rows} empty="No travellers yet." columns={[
      ["Name", (row) => strong(row.fullName)],
      ["Job", (row) => row.jobCode],
      ["Hub", (row) => row.travelHub || "-"],
      ["Room", (row) => <Badge label={row.roomType} tone="blue" />],
      ["Food", (row) => <Badge label={row.foodPreference} tone="green" />],
      ["Passport", (row) => row.passportStatus || "Pending"],
      ["Ticket", (row) => <Badge label={row.ticketStatus} tone={statusTone(row.ticketStatus)} />],
      ["Visa", (row) => <Badge label={row.visaStatus} tone={statusTone(row.visaStatus)} />],
      ["TM Call", (row) => row.callingStatus],
      ["Action", (row) => has(P.MANAGE_TRAVELLERS) && <DeleteButton label={row.fullName} onClick={() => deleteItem(row.fullName, removeTraveller, { travellerId: row.id })} />],
    ]} />
  );
}

function VisaView({ rows, openModal, has, deleteItem, removeVisa }) {
  return (
    <DataTable rows={rows} empty="No visa records yet." columns={[
      ["Traveller", (row) => strong(row.travellerName)],
      ["Job", (row) => row.jobCode],
      ["Hub", (row) => row.travelHub || "-"],
      ["Status", (row) => <Badge label={row.status} tone={statusTone(row.status)} />],
      ["Appointment", (row) => row.appointmentDate || "-"],
      ["Notes", (row) => row.notes || "-"],
      ["Action", (row) => has(P.MANAGE_VISA) && (
        <div className="flex flex-wrap gap-2">
          <button className="portal-small-btn" onClick={() => openModal("visa", { visaRecordId: row.id, visaStatus: row.status, appointmentDate: row.appointmentDate })}>Update</button>
          <DeleteButton label={`${row.travellerName} visa`} onClick={() => deleteItem(`${row.travellerName} visa`, removeVisa, { visaRecordId: row.id })} />
        </div>
      )],
    ]} />
  );
}

function TicketDashboardView({ summary, tickets, has, deleteItem, removeTicket }) {
  if (!summary) return <LoadingPanel />;
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Issued" value={summary.issued} Icon={Ticket} />
        <StatCard label="Pending" value={summary.pending} Icon={Plane} />
        <StatCard label="Attention" value={summary.attention} Icon={RefreshCw} />
        <StatCard label="PNRs" value={summary.pnrCount} Icon={FileText} />
        <StatCard label="Issued Seats" value={`${summary.issuedSeats}/${summary.totalSeats}`} Icon={Users} />
      </div>
      <TicketsView rows={tickets.slice(0, 8)} has={has} deleteItem={deleteItem} removeTicket={removeTicket} />
    </div>
  );
}

function PnrView({ rows, has, deleteItem, removePnr }) {
  return (
    <DataTable rows={rows} empty="No PNRs yet." columns={[
      ["PNR", (row) => <span className="font-mono font-bold tracking-[0.14em] text-citius-blue">{row.pnrCode}</span>],
      ["Job", (row) => row.jobCode],
      ["Client", (row) => row.clientName],
      ["Airline", (row) => row.airline],
      ["Route", (row) => row.route],
      ["Fare", (row) => row.fareType || "-"],
      ["Seats", (row) => `${row.issuedSeats}/${row.totalSeats}`],
      ["Action", (row) => has(P.MANAGE_TICKETING) && <DeleteButton label={row.pnrCode} onClick={() => deleteItem(row.pnrCode, removePnr, { pnrId: row.id })} />],
    ]} />
  );
}

function TicketsView({ rows, has, deleteItem, removeTicket }) {
  return (
    <DataTable rows={rows} empty="No tickets yet." columns={[
      ["Ticket", (row) => row.ticketNumber || "-"],
      ["Traveller", (row) => strong(row.travellerName || "Unassigned")],
      ["Job", (row) => row.jobCode],
      ["Type", (row) => row.ticketType || "-"],
      ["PNR", (row) => row.pnrCode || "-"],
      ["Class", (row) => row.cabinClass || "Economy"],
      ["Seat", (row) => row.seatNumber || row.seatPreference || "-"],
      ["Status", (row) => <Badge label={row.ticketStatus} tone={statusTone(row.ticketStatus)} />],
      ["Action", (row) => has(P.MANAGE_TICKETING) && <DeleteButton label={row.ticketNumber || "ticket"} onClick={() => deleteItem(row.ticketNumber || "ticket", removeTicket, { ticketId: row.id })} />],
    ]} />
  );
}

function SeatView({ rows, has, deleteItem, removeSeatAllocation }) {
  return (
    <DataTable rows={rows} empty="No stored seat allocations yet." columns={[
      ["Seat", (row) => <span className="font-mono font-bold">{row.seatNumber}</span>],
      ["Traveller", (row) => row.travellerName || "Unassigned"],
      ["Job", (row) => row.jobCode],
      ["Status", (row) => <Badge label={row.status} tone={statusTone(row.status)} />],
      ["Notes", (row) => row.notes || "-"],
      ["Action", (row) => has(P.MANAGE_TICKETING) && <DeleteButton label={`seat ${row.seatNumber}`} onClick={() => deleteItem(`seat ${row.seatNumber}`, removeSeatAllocation, { seatAllocationId: row.id })} />],
    ]} />
  );
}

function HotelsView({ rows, has, deleteItem, removeHotel }) {
  return (
    <DataTable rows={rows} empty="No hotel records yet." columns={[
      ["Hotel", (row) => strong(row.name)],
      ["Job", (row) => row.jobCode],
      ["Client", (row) => row.clientName],
      ["City", (row) => row.city || "-"],
      ["Check-in", (row) => row.checkInDate || "-"],
      ["Check-out", (row) => row.checkOutDate || "-"],
      ["Instructions", (row) => row.specialInstructions || "-"],
      ["Action", (row) => has(P.MANAGE_OPERATIONS) && <DeleteButton label={row.name} onClick={() => deleteItem(row.name, removeHotel, { hotelId: row.id })} />],
    ]} />
  );
}

function TourManagersView({ rows, travellers, has, deleteItem, removeTourManager, updateCallingStatus }) {
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Total Pax" value={travellers.length} Icon={Users} />
        <StatCard label="Onboarded" value={travellers.filter((row) => row.fullName && row.travelHub && row.foodPreference).length} Icon={CheckCircle2} />
        <StatCard label="Docs Pending" value={travellers.filter((row) => !["Approved", "Not Required"].includes(row.visaStatus) || row.ticketStatus !== "Issued").length} Icon={ShieldCheck} />
      </div>
      <Panel title="Calling status board">
        <DataTable compact rows={travellers} empty="No travellers to call yet." columns={[
          ["Guest", (row) => strong(row.fullName)],
          ["Job", (row) => row.jobCode],
          ["Hub", (row) => row.travelHub || "-"],
          ["Type", (row) => row.guestType],
          ["Cancellation", (row) => row.cancellation || row.lastMinuteDrop ? <Badge label="Flagged" tone="red" /> : "-"],
          ["Calling", (row) => <Badge label={row.callingStatus} tone={statusTone(row.callingStatus)} />],
          ["Action", (row) => has(P.MANAGE_TOUR_MANAGERS) && (
            <div className="flex flex-wrap gap-2">
              {CALLING_STATUSES.map((status) => (
                <button key={status} type="button" className="portal-small-btn" onClick={() => updateCallingStatus({ travellerId: row.id, callingStatus: status })}>
                  {status}
                </button>
              ))}
            </div>
          )],
        ]} />
      </Panel>
      <DataTable rows={rows} empty="No Tour Managers yet." columns={[
        ["Name", (row) => strong(row.name)],
        ["Current Tour", (row) => row.currentTour || "Available"],
        ["Job", (row) => row.jobCode || "-"],
        ["Calling", (row) => row.callingStatus],
        ["Available", (row) => row.availabilityDate || "-"],
        ["Status", (row) => <Badge label={row.status} tone={statusTone(row.status)} />],
        ["Action", (row) => has(P.MANAGE_TOUR_MANAGERS) && <DeleteButton label={row.name} onClick={() => deleteItem(row.name, removeTourManager, { tourManagerId: row.id })} />],
      ]} />
    </div>
  );
}

function FinanceView({ rows, overview, has, deleteItem, removeInvoice }) {
  return (
    <div className="space-y-5">
      {overview && (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="Total Revenue" value={money(overview.summary.totalRevenue)} Icon={CircleDollarSign} />
            <StatCard label="Client Outstanding" value={money(overview.summary.clientOutstanding)} Icon={FileText} />
            <StatCard label="Approved Expenses" value={money(overview.summary.approvedExpenses)} Icon={ClipboardList} />
          </div>
          {overview.fundProjections && (
            <Panel title="Fund projections">
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35 }}
                className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
              >
                <StatCard label="Expected collections" value={money(overview.fundProjections.expectedCollections)} Icon={CircleDollarSign} />
                <StatCard label="Advance pipeline" value={money(overview.fundProjections.advancePipeline)} Icon={ClipboardList} />
                <StatCard label="Pending reimbursements" value={money(overview.fundProjections.pendingReimbursements)} Icon={RefreshCw} />
                <StatCard label="Expense approvals due" value={money(overview.fundProjections.pendingExpenseApprovals)} Icon={CheckCircle2} />
              </motion.div>
            </Panel>
          )}
          <Panel title="Tour-wise P&L">
            <DataTable compact rows={overview.pnl} empty="No Job Cards available." columns={[
              ["JC", (row) => row.jobCode],
              ["Group", (row) => row.clientName],
              ["Revenue", (row) => money(row.revenue)],
              ["Expense", (row) => money(row.expense)],
              ["Profit", (row) => money(row.profit)],
              ["Margin", (row) => `${row.marginPercent}%`],
            ]} />
          </Panel>
          <Panel title="Outstanding payments">
            <DataTable compact rows={overview.outstanding} empty="No outstanding balances." columns={[
              ["Client", (row) => strong(row.clientName)],
              ["JC", (row) => row.jobCode],
              ["Due", (row) => money(row.dueAmount)],
              ["Due Date", (row) => row.dueDate || "-"],
              ["Status", (row) => <Badge label={row.status} tone={statusTone(row.status)} />],
            ]} />
          </Panel>
        </>
      )}
      <DataTable rows={rows} empty="No invoices yet." columns={[
        ["Invoice", (row) => strong(row.invoiceNumber)],
        ["Job", (row) => row.jobCode],
        ["Client", (row) => row.clientName],
        ["Expected", (row) => money(row.expectedAmount)],
        ["Received", (row) => money(row.receivedAmount)],
        ["Balance", (row) => money(row.balanceAmount)],
        ["Status", (row) => <Badge label={row.status} tone={statusTone(row.status)} />],
        ["Action", (row) => has(P.MANAGE_FINANCE) && <DeleteButton label={row.invoiceNumber} onClick={() => deleteItem(row.invoiceNumber, removeInvoice, { invoiceId: row.id })} />],
      ]} />
    </div>
  );
}

function ExpensesView({ rows, has, deleteItem, removeExpense, submitExpenseForApproval }) {
  return (
    <DataTable rows={rows} empty="No expenses yet." columns={[
      ["Job", (row) => row.jobCode],
      ["Date", (row) => row.expenseDate || "-"],
      ["Category", (row) => strong(row.category)],
      ["Particulars", (row) => row.particulars || "-"],
      ["Currency", (row) => row.currency],
      ["Amount", (row) => money(row.amount)],
      ["Split", (row) => `Card ${money(row.cardAmount)} / Cash ${money(row.cashAmount)} / E-Pay ${money(row.epayAmount)}`],
      ["Paid By", (row) => row.paidBy],
      ["Approval", (row) => <Badge label={row.approvalStatus} tone={statusTone(row.approvalStatus)} />],
      ["Reimbursement", (row) => row.reimbursementStatus],
      ["Action", (row) => has(P.MANAGE_EXPENSES) && (
        <div className="flex flex-wrap gap-2">
          <button className="portal-small-btn" onClick={() => submitExpenseForApproval({ expenseId: row.id })}>
            Submit
          </button>
          <DeleteButton label={`${row.category} expense`} onClick={() => deleteItem(`${row.category} expense`, removeExpense, { expenseId: row.id })} />
        </div>
      )],
    ]} />
  );
}

function ApprovalsView({ rows, has, decideApproval }) {
  return (
    <DataTable rows={rows} empty="No approvals in the queue." columns={[
      ["Code", (row) => strong(row.requestCode)],
      ["Type", (row) => <Badge label={row.type} tone="blue" />],
      ["Requested By", (row) => row.requestedByName],
      ["Summary", (row) => row.summary],
      ["Amount", (row) => money(row.amount)],
      ["Status", (row) => <Badge label={row.status} tone={statusTone(row.status)} />],
      ["Action", (row) => has(P.APPROVE_EXPENSES) && row.status === "Pending" && (
        <div className="flex flex-wrap gap-2">
          <button className="portal-small-btn" onClick={() => decideApproval({ approvalId: row.id, status: "Approved" })}>Approve</button>
          <button className="portal-danger-btn" onClick={() => decideApproval({ approvalId: row.id, status: "Rejected" })}>Reject</button>
        </div>
      )],
    ]} />
  );
}

function ReportsView({ report }) {
  if (!report) return <LoadingPanel />;
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Pipeline Budget" value={money(report.summary.totalPipelineBudget)} Icon={CircleDollarSign} />
        <StatCard label="Confirmed Revenue" value={money(report.summary.confirmedRevenue)} Icon={CheckCircle2} />
        <StatCard label="Confirmed / Lost" value={`${report.summary.confirmedQueries}/${report.summary.lostQueries}`} Icon={ClipboardList} />
      </div>
      <Panel title="Revenue by query type">
        <DataTable compact rows={report.revenueByType.map((row) => ({ ...row, id: row.queryType }))} empty="No query revenue yet." columns={[
          ["Type", (row) => strong(row.queryType)],
          ["Pipeline Budget", (row) => money(row.revenue)],
          ["Queries", (row) => row.count],
        ]} />
      </Panel>
      <Panel title="Location-wise headcount">
        <DataTable compact rows={report.locationHeadcount} empty="No staff locations yet." columns={[
          ["Location", (row) => strong(row.location)],
          ["Headcount", (row) => row.count],
        ]} />
      </Panel>
    </div>
  );
}

function TeamView({ rows }) {
  return (
    <DataTable rows={rows} empty="No active staff records." columns={[
      ["Name", (row) => <span className={row.isCurrentUser ? "font-semibold text-citius-blue" : "font-semibold"}>{row.name}</span>],
      ["Email", (row) => row.email],
      ["Mobile", (row) => row.mobile || "-"],
      ["Department", (row) => row.department || "-"],
      ["Function", (row) => row.function || "-"],
      ["Location", (row) => row.location || "-"],
      ["Access", (row) => row.roles.join(", ")],
    ]} />
  );
}

function ActivityView({ activity, notifications, deleteItem, removeNotification }) {
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <Panel title="Activity log">
        <Timeline rows={activity} />
      </Panel>
      <Panel title="Notifications">
        {notifications.length === 0 ? <EmptyState label="No notifications yet." /> : (
          <div className="space-y-3">
            {notifications.map((item) => (
              <div key={item.id} className="rounded-md border border-brand-border bg-brand-light p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold">{item.title}: {item.body}</div>
                    <div className="mt-1 text-xs text-brand-muted">{item.readAt ? "Read" : "Unread"} - {formatDate(item.createdAt)}</div>
                  </div>
                  <DeleteButton label={item.title} onClick={() => deleteItem(item.title, removeNotification, { notificationId: item.id })} />
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}

function SettingsView({ staff, dropdowns, openModal, deleteItem, removeStaff }) {
  return (
    <div className="space-y-5">
      <Panel title="Staff allowlist">
        <DataTable rows={staff} empty="No staff records yet." columns={[
          ["Name", (row) => strong(row.name)],
          ["Email", (row) => row.email],
          ["Department", (row) => row.department || "-"],
          ["Function", (row) => row.function || "-"],
          ["Location", (row) => row.location || "-"],
          ["Roles", (row) => row.roles.join(", ")],
          ["Active", (row) => <Badge label={row.active ? "Active" : "Inactive"} tone={row.active ? "green" : "red"} />],
          ["Action", (row) => (
            <div className="flex flex-wrap gap-2">
              <button className="portal-small-btn" onClick={() => openModal("staff", { staffId: row.id, staffName: row.name, staffEmail: row.email, staffRoles: row.roles, department: row.department, staffFunction: row.function, mobile: row.mobile, location: row.location, staffActive: row.active })}>
                Edit
              </button>
              <DeleteButton label={row.email} onClick={() => deleteItem(row.email, removeStaff, { staffId: row.id })} />
            </div>
          )],
        ]} compact />
      </Panel>
      <Panel title="Workflow dropdowns">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {Object.entries(dropdowns).map(([category, values]) => (
            <div key={category} className="rounded-md border border-brand-border bg-brand-light p-4">
              <div className="mb-2 text-sm font-semibold capitalize">{category}</div>
              <div className="flex flex-wrap gap-2">
                {values.map((value) => <Badge key={value} label={value} tone="gray" />)}
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function EntityModal({ modal, form, updateForm, submit, close, error, isSaving, queries, jobCards, travellers, visas, pnrs, team }) {
  const title = modal
    ? {
        query: "New Query / Enquiry",
        assignContracting: "Assign Contracting Owner",
        queryStatus: "Update Query Status",
        proposal: "Create Proposal",
        jobCard: "Open Job Card",
        traveller: "Add Traveller",
        visa: "Update Visa Status",
        pnr: "Add PNR",
        ticket: "Issue Ticket",
        seat: "Save Seat Allocation",
        hotel: "Add Hotel",
        tourManager: "Add Tour Manager",
        invoice: "Generate Invoice",
        expense: "Add Expense",
        staff: "Staff Allowlist Entry",
      }[modal]
    : "";

  return (
    <AnimatePresence>
      {modal && (
        <motion.div
          key={modal}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/50 p-4 backdrop-blur-sm"
        >
          <motion.form
            onSubmit={submit}
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.98 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-2xl border border-brand-border bg-white shadow-2xl"
          >
        <div className="flex items-center justify-between border-b border-brand-border px-5 py-4">
          <div className="font-heading text-lg font-semibold text-citius-blue">{title}</div>
          <button type="button" onClick={close} className="rounded-full p-2 text-brand-muted hover:bg-brand-light">Close</button>
        </div>
        <div className="max-h-[calc(90vh-130px)] overflow-y-auto p-5">
          {error && <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
          <div className="grid gap-4 md:grid-cols-2">
            {modal === "query" && <>
              <Input label="Client / Company" value={form.clientName} onChange={(v) => updateForm("clientName", v)} required />
              <Input label="Contact Person" value={form.contactPerson} onChange={(v) => updateForm("contactPerson", v)} />
              <Input label="Mobile" value={form.contactMobile} onChange={(v) => updateForm("contactMobile", v)} />
              <Input label="No. of Pax" type="number" value={form.paxCount} onChange={(v) => updateForm("paxCount", v)} />
              <Input label="Destination" value={form.destination} onChange={(v) => updateForm("destination", v)} />
              <Input label="Travel Date From" type="date" value={form.travelStartDate} onChange={(v) => updateForm("travelStartDate", v)} />
              <Input label="Travel Date To" type="date" value={form.travelEndDate} onChange={(v) => updateForm("travelEndDate", v)} />
              <Select label="Query Type" value={form.queryType} options={QUERY_TYPES} onChange={(v) => updateForm("queryType", v)} />
              <Select label="Travel Type" value={form.travelType} options={TRAVEL_TYPES} onChange={(v) => updateForm("travelType", v)} />
              <Input label="Budget INR" type="number" value={form.budgetAmount} onChange={(v) => updateForm("budgetAmount", v)} />
              <Select label="Source" value={form.source} options={QUERY_SOURCES} onChange={(v) => updateForm("source", v)} />
              <Select label="Sales Rep" value={form.salesOwnerName} options={[{ value: "", label: "Current user" }, ...team.filter((member) => member.roles.some((role) => ["Sales", "Sales Head"].includes(role))).map((member) => ({ value: member.name, label: member.name }))]} onChange={(v) => updateForm("salesOwnerName", v)} />
              <Textarea label="Notes" value={form.notes} onChange={(v) => updateForm("notes", v)} />
            </>}
            {modal === "assignContracting" && <>
              <Select label="Query" value={form.queryId} options={queries.map((q) => ({ value: q.id, label: `${q.queryCode} - ${q.clientName}` }))} onChange={(v) => updateForm("queryId", v)} required />
              <Input label="Contracting Owner" value={form.ownerName} onChange={(v) => updateForm("ownerName", v)} required />
            </>}
            {modal === "queryStatus" && <>
              <Select label="Sales Status" value={form.salesStatus} options={SALES_STATUSES} onChange={(v) => updateForm("salesStatus", v)} />
              <Select label="Lead Stage" value={form.leadStage} options={LEAD_STAGES} onChange={(v) => updateForm("leadStage", v)} />
              <Select label="Contracting Status" value={form.contractingStatus} options={CONTRACTING_STATUSES} onChange={(v) => updateForm("contractingStatus", v)} />
              <Select label="Lost Reason" value={form.lostReason} options={LOST_REASONS} onChange={(v) => updateForm("lostReason", v)} />
            </>}
            {modal === "proposal" && <>
              <Select label="Linked Query" value={form.queryId} options={[{ value: "", label: "Unlinked" }, ...queries.map((q) => ({ value: q.id, label: `${q.queryCode} - ${q.clientName}` }))]} onChange={(v) => updateForm("queryId", v)} />
              <Input label="Client Name" value={form.clientName} onChange={(v) => updateForm("clientName", v)} />
              <Input label="Prepared By" value={form.preparedBy} onChange={(v) => updateForm("preparedBy", v)} />
              <Input label="Land Cost/Pax" type="number" value={form.landCostPerPax} onChange={(v) => updateForm("landCostPerPax", v)} />
              <Input label="Airfare/Pax" type="number" value={form.airfarePerPax} onChange={(v) => updateForm("airfarePerPax", v)} />
              <Textarea label="Itinerary Summary" value={form.itinerarySummary} onChange={(v) => updateForm("itinerarySummary", v)} />
            </>}
            {modal === "jobCard" && <>
              <Select label="Confirmed Query" value={form.queryId} options={[{ value: "", label: "Direct Job" }, ...queries.filter((q) => q.salesStatus === "Order Confirmed" || q.contractingStatus === "Order Confirmed").map((q) => ({ value: q.id, label: `${q.queryCode} - ${q.clientName}` }))]} onChange={(v) => updateForm("queryId", v)} />
              <Input label="Client" value={form.clientName} onChange={(v) => updateForm("clientName", v)} />
              <Input label="Confirmed Pax" type="number" value={form.confirmedPax} onChange={(v) => updateForm("confirmedPax", v)} />
              <Input label="Room Count" type="number" value={form.roomCount} onChange={(v) => updateForm("roomCount", v)} />
              <Input label="Destination" value={form.destination} onChange={(v) => updateForm("destination", v)} />
              <Input label="Tour Manager" value={form.tourManagerName} onChange={(v) => updateForm("tourManagerName", v)} />
            </>}
            {modal === "traveller" && <>
              <Select label="Job Card" value={form.jobCardId} options={jobCards.map((j) => ({ value: j.id, label: `${j.jobCode} - ${j.clientName}` }))} onChange={(v) => updateForm("jobCardId", v)} required />
              <Input label="Full Name" value={form.fullName} onChange={(v) => updateForm("fullName", v)} required />
              <Input label="Travel Hub" value={form.travelHub} onChange={(v) => updateForm("travelHub", v)} />
              <Input label="Travel Date" type="date" value={form.travelDate} onChange={(v) => updateForm("travelDate", v)} />
              <Input label="Guests travelling with" value={form.guestCompanions} onChange={(v) => updateForm("guestCompanions", v)} placeholder="Spouse, children, friends..." />
              <Select label="Food Preference" value={form.foodPreference} options={FOOD_PREFERENCES} onChange={(v) => updateForm("foodPreference", v)} />
              <Select label="Guest Type" value={form.guestType} options={GUEST_TYPES} onChange={(v) => updateForm("guestType", v)} />
              <Select label="Payment Type" value={form.paymentType} options={PAYMENT_TYPES} onChange={(v) => updateForm("paymentType", v)} />
              <Select label="Room Type" value={form.roomType} options={ROOM_TYPES} onChange={(v) => updateForm("roomType", v)} />
              <Select label="Visa Required" value={form.visaRequired} options={["Yes", "No"]} onChange={(v) => updateForm("visaRequired", v)} />
              <Select label="Domestic Travel Required" value={form.domesticTravelRequired} options={["Yes", "No"]} onChange={(v) => updateForm("domesticTravelRequired", v)} />
              <Input label="Biometric Date" type="date" value={form.biometricAppointmentDate} onChange={(v) => updateForm("biometricAppointmentDate", v)} />
              <Select label="Extension of Tour" value={form.extensionOfTour} options={["No", "Yes"]} onChange={(v) => updateForm("extensionOfTour", v)} />
              <Select label="Arriving Early" value={form.arrivingEarly} options={["No", "Yes"]} onChange={(v) => updateForm("arrivingEarly", v)} />
              <Input label="Passport Status" value={form.passportStatus} onChange={(v) => updateForm("passportStatus", v)} />
              <Input label="Hotel Allocation" value={form.hotelAllocation} onChange={(v) => updateForm("hotelAllocation", v)} />
              <Textarea label="Special Requests" value={form.notes} onChange={(v) => updateForm("notes", v)} />
            </>}
            {modal === "visa" && <>
              <Select label="Visa Record" value={form.visaRecordId} options={visas.map((v) => ({ value: v.id, label: `${v.travellerName} - ${v.jobCode}` }))} onChange={(v) => updateForm("visaRecordId", v)} required />
              <Select label="Visa Status" value={form.visaStatus} options={VISA_STATUSES} onChange={(v) => updateForm("visaStatus", v)} />
              <Input label="Appointment Date" type="date" value={form.appointmentDate} onChange={(v) => updateForm("appointmentDate", v)} />
              <Textarea label="Notes" value={form.notes} onChange={(v) => updateForm("notes", v)} />
            </>}
            {modal === "pnr" && <>
              <Select label="Job Card" value={form.jobCardId} options={jobCards.map((j) => ({ value: j.id, label: `${j.jobCode} - ${j.clientName}` }))} onChange={(v) => updateForm("jobCardId", v)} required />
              <Input label="PNR" value={form.pnrCode} onChange={(v) => updateForm("pnrCode", v)} required />
              <Input label="Airline" value={form.airline} onChange={(v) => updateForm("airline", v)} />
              <Input label="Route" value={form.route} onChange={(v) => updateForm("route", v)} />
              <Input label="Fare Type" value={form.fareType} onChange={(v) => updateForm("fareType", v)} />
              <Input label="Total Seats" type="number" value={form.totalSeats} onChange={(v) => updateForm("totalSeats", v)} />
            </>}
            {modal === "ticket" && <>
              <Select label="Job Card" value={form.jobCardId} options={jobCards.map((j) => ({ value: j.id, label: `${j.jobCode} - ${j.clientName}` }))} onChange={(v) => updateForm("jobCardId", v)} required />
              <Select label="Traveller" value={form.travellerId} options={[{ value: "", label: "Unassigned" }, ...travellers.map((t) => ({ value: t.id, label: `${t.fullName} - ${t.jobCode}` }))]} onChange={(v) => updateForm("travellerId", v)} />
              <Select label="PNR" value={form.pnrId} options={[{ value: "", label: "No PNR" }, ...pnrs.map((p) => ({ value: p.id, label: `${p.pnrCode} - ${p.route}` }))]} onChange={(v) => updateForm("pnrId", v)} />
              <Input label="Ticket Number" value={form.ticketNumber} onChange={(v) => updateForm("ticketNumber", v)} />
              <Select label="Ticket Type" value={form.ticketType} options={TICKET_TYPES} onChange={(v) => updateForm("ticketType", v)} />
              <Select label="Ticket Status" value={form.ticketStatus} options={TICKET_STATUSES} onChange={(v) => updateForm("ticketStatus", v)} />
              <Select label="Payment Type" value={form.paymentType} options={PAYMENT_TYPES} onChange={(v) => updateForm("paymentType", v)} />
              <Select label="Cabin Class" value={form.cabinClass} options={CABIN_CLASSES} onChange={(v) => updateForm("cabinClass", v)} />
              <Select label="Meal Preference" value={form.foodPreference} options={FOOD_PREFERENCES} onChange={(v) => updateForm("foodPreference", v)} />
              <Input label="Seat Preference" value={form.seatPreference} onChange={(v) => updateForm("seatPreference", v)} />
              <Input label="Seat Number" value={form.seatNumber} onChange={(v) => updateForm("seatNumber", v)} />
            </>}
            {modal === "seat" && <>
              <Select label="Job Card" value={form.jobCardId} options={jobCards.map((j) => ({ value: j.id, label: `${j.jobCode} - ${j.clientName}` }))} onChange={(v) => updateForm("jobCardId", v)} required />
              <Select label="Traveller" value={form.travellerId} options={[{ value: "", label: "Unassigned" }, ...travellers.map((t) => ({ value: t.id, label: `${t.fullName} - ${t.jobCode}` }))]} onChange={(v) => updateForm("travellerId", v)} />
              <Select label="PNR" value={form.pnrId} options={[{ value: "", label: "No PNR" }, ...pnrs.map((p) => ({ value: p.id, label: `${p.pnrCode} - ${p.route}` }))]} onChange={(v) => updateForm("pnrId", v)} />
              <Input label="Seat Number" value={form.seatNumber} onChange={(v) => updateForm("seatNumber", v)} required />
              <Select label="Status" value={form.seatStatus} options={["Available", "Held", "Assigned", "Blocked"]} onChange={(v) => updateForm("seatStatus", v)} />
              <Textarea label="Notes" value={form.notes} onChange={(v) => updateForm("notes", v)} />
            </>}
            {modal === "hotel" && <>
              <Select label="Job Card" value={form.jobCardId} options={jobCards.map((j) => ({ value: j.id, label: `${j.jobCode} - ${j.clientName}` }))} onChange={(v) => updateForm("jobCardId", v)} required />
              <Input label="Hotel Name" value={form.hotelName} onChange={(v) => updateForm("hotelName", v)} required />
              <Input label="City" value={form.city} onChange={(v) => updateForm("city", v)} />
              <Input label="Check-in" type="date" value={form.checkInDate} onChange={(v) => updateForm("checkInDate", v)} />
              <Input label="Check-out" type="date" value={form.checkOutDate} onChange={(v) => updateForm("checkOutDate", v)} />
              <Textarea label="Special Instructions" value={form.notes} onChange={(v) => updateForm("notes", v)} />
            </>}
            {modal === "tourManager" && <>
              <Select label="Job Card" value={form.jobCardId} options={[{ value: "", label: "Unassigned" }, ...jobCards.map((j) => ({ value: j.id, label: `${j.jobCode} - ${j.clientName}` }))]} onChange={(v) => updateForm("jobCardId", v)} />
              <Input label="Tour Manager Name" value={form.tourManagerName} onChange={(v) => updateForm("tourManagerName", v)} required />
              <Input label="Email" value={form.staffEmail} onChange={(v) => updateForm("staffEmail", v)} />
              <Input label="Phone" value={form.paidBy} onChange={(v) => updateForm("paidBy", v)} />
              <Input label="Available Date" type="date" value={form.travelStartDate} onChange={(v) => updateForm("travelStartDate", v)} />
              <Textarea label="Notes" value={form.notes} onChange={(v) => updateForm("notes", v)} />
            </>}
            {modal === "invoice" && <>
              <Select label="Job Card" value={form.jobCardId} options={jobCards.map((j) => ({ value: j.id, label: `${j.jobCode} - ${j.clientName}` }))} onChange={(v) => updateForm("jobCardId", v)} required />
              <Input label="Invoice Number" value={form.invoiceNumber} onChange={(v) => updateForm("invoiceNumber", v)} required />
              <Input label="Expected Amount" type="number" value={form.expectedAmount} onChange={(v) => updateForm("expectedAmount", v)} />
              <Input label="Received Amount" type="number" value={form.receivedAmount} onChange={(v) => updateForm("receivedAmount", v)} />
              <Input label="Due Date" type="date" value={form.dueDate} onChange={(v) => updateForm("dueDate", v)} />
            </>}
            {modal === "expense" && <>
              <Select label="Job Card" value={form.jobCardId} options={jobCards.map((j) => ({ value: j.id, label: `${j.jobCode} - ${j.clientName}` }))} onChange={(v) => updateForm("jobCardId", v)} required />
              <Input label="Tour Manager" value={form.tourManagerName} onChange={(v) => updateForm("tourManagerName", v)} />
              <Input label="Expense Date" type="date" value={form.expenseDate} onChange={(v) => updateForm("expenseDate", v)} />
              <Select label="Expense Head" value={form.category} options={EXPENSE_HEADS} onChange={(v) => updateForm("category", v)} required />
              <Select label="Currency" value={form.currency} options={EXPENSE_CURRENCIES} onChange={(v) => updateForm("currency", v)} />
              <Input label="Card Amount" type="number" value={form.cardAmount} onChange={(v) => updateForm("cardAmount", v)} />
              <Input label="Cash Amount" type="number" value={form.cashAmount} onChange={(v) => updateForm("cashAmount", v)} />
              <Input label="E-Pay Amount" type="number" value={form.epayAmount} onChange={(v) => updateForm("epayAmount", v)} />
              <Input label="Total Amount" type="number" value={form.amount} onChange={(v) => updateForm("amount", v)} />
              <Input label="Paid By" value={form.paidBy} onChange={(v) => updateForm("paidBy", v)} required />
              <Textarea label="Particulars" value={form.particulars} onChange={(v) => updateForm("particulars", v)} />
            </>}
            {modal === "staff" && <>
              <Input label="Name" value={form.staffName} onChange={(v) => updateForm("staffName", v)} required />
              <Input label="Email" type="email" value={form.staffEmail} onChange={(v) => updateForm("staffEmail", v)} required />
              <Input label="Mobile" value={form.mobile} onChange={(v) => updateForm("mobile", v)} />
              <Input label="Department" value={form.department} onChange={(v) => updateForm("department", v)} />
              <Input label="Function" value={form.staffFunction} onChange={(v) => updateForm("staffFunction", v)} />
              <Input label="Location" value={form.location} onChange={(v) => updateForm("location", v)} />
              <MultiSelect label="Roles" value={form.staffRoles} options={PORTAL_ROLES} onChange={(v) => updateForm("staffRoles", v)} />
              <Select label="Active" value={form.staffActive ? "Active" : "Inactive"} options={["Active", "Inactive"]} onChange={(v) => updateForm("staffActive", v === "Active")} />
            </>}
          </div>
        </div>
        <div className="flex justify-end gap-3 border-t border-brand-border px-5 py-4">
          <button type="button" onClick={close} className="portal-outline-btn">Cancel</button>
          <button type="submit" disabled={isSaving} className="portal-primary-btn disabled:opacity-60">
            {isSaving ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
            Save
          </button>
        </div>
          </motion.form>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function DataTable({ rows, columns, empty, compact = false }) {
  if (!rows) return <LoadingPanel />;
  if (rows.length === 0) return <EmptyState label={empty} />;
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="overflow-hidden rounded-2xl border border-brand-border bg-white shadow-sm"
    >
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse">
          <thead className="bg-brand-light/80">
            <tr>
              {columns.map(([label]) => (
                <th key={label} className="border-b border-brand-border px-4 py-3 text-left text-xs font-semibold text-citius-blue/80">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <motion.tr
                key={row.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: Math.min(rowIndex * 0.02, 0.2) }}
                className="transition-colors hover:bg-citius-blue/[0.03]"
              >
                {columns.map(([label, render]) => (
                  <td key={label} className={`border-b border-brand-border px-4 ${compact ? "py-2" : "py-3"} text-sm text-brand-dark last:border-b-0`}>
                    {render(row) || "-"}
                  </td>
                ))}
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}

function DeleteButton({ label, onClick }) {
  return (
    <button type="button" className="portal-danger-btn" onClick={onClick} aria-label={`Delete ${label}`}>
      <Trash2 size={13} />
      Delete
    </button>
  );
}

function Panel({ title, children }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      className="rounded-2xl border border-brand-border bg-white p-5 shadow-sm md:p-6"
    >
      <h2 className="mb-4 font-heading text-lg font-semibold text-citius-blue md:text-xl">{title}</h2>
      {children}
    </motion.section>
  );
}

function StatCard({ label, value, Icon, index = 0, featured = false }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ y: -4, scale: 1.01 }}
      className={`group overflow-hidden rounded-2xl border border-brand-border bg-white p-5 shadow-sm transition-shadow hover:border-citius-orange/30 hover:shadow-lg ${
        featured ? "sm:col-span-2 bg-linear-to-br from-citius-blue to-citius-blue/90 text-white" : ""
      }`}
    >
      <div className="flex items-center justify-between">
        <div className={`text-xs font-semibold ${featured ? "text-white/80" : "text-brand-muted"}`}>{label}</div>
        <div className={`rounded-full p-2 ${featured ? "bg-white/15" : "bg-citius-orange/10"}`}>
          <Icon size={18} className={featured ? "text-citius-orange" : "text-citius-orange"} />
        </div>
      </div>
      <div className={`mt-3 font-heading text-3xl font-semibold ${featured ? "text-white" : "text-citius-blue"}`}>
        {value}
      </div>
    </motion.div>
  );
}

function Progress({ label, value }) {
  return (
    <div>
      <div className="mt-3 flex justify-between text-xs text-brand-muted">
        <span>{label}</span>
        <strong className="text-citius-blue">{Math.min(value || 0, 100)}%</strong>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-brand-border">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(value || 0, 100)}%` }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="h-full rounded-full bg-linear-to-r from-citius-orange to-citius-blue"
        />
      </div>
    </div>
  );
}

function Timeline({ rows }) {
  if (!rows.length) return <EmptyState label="No records yet." />;
  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <div key={row.id} className="rounded-md border border-brand-border bg-brand-light p-3">
          <div className="text-sm font-semibold">{row.message}</div>
          <div className="mt-1 text-xs text-brand-muted">{row.actorName} - {formatDate(row.createdAt)}</div>
        </div>
      ))}
    </div>
  );
}

function Input({ label, value, onChange, type = "text", required = false }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-brand-muted">{label}</span>
      <input type={type} required={required} value={value} onChange={(event) => onChange(event.target.value)} className="h-11 w-full rounded-xl border border-brand-border bg-brand-light px-3 text-sm outline-none transition focus:border-citius-blue focus:bg-white focus:ring-2 focus:ring-citius-blue/10" />
    </label>
  );
}

function Select({ label, value, options, onChange, required = false }) {
  const normalized = options.map((option) => typeof option === "string" ? { value: option, label: option } : option);
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-brand-muted">{label}</span>
      <select required={required} value={value} onChange={(event) => onChange(event.target.value)} className="h-11 w-full rounded-xl border border-brand-border bg-brand-light px-3 text-sm outline-none transition focus:border-citius-blue focus:bg-white focus:ring-2 focus:ring-citius-blue/10">
        {normalized.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
}

function MultiSelect({ label, value, options, onChange }) {
  const selected = new Set(value);
  return (
    <div className="md:col-span-2">
      <span className="mb-2 block text-xs font-semibold text-brand-muted">{label}</span>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {options.map((option) => (
          <label key={option} className="flex items-center gap-2 rounded-md border border-brand-border bg-brand-light px-3 py-2 text-sm">
            <input
              type="checkbox"
              checked={selected.has(option)}
              onChange={(event) => {
                const next = new Set(selected);
                if (event.target.checked) next.add(option);
                else next.delete(option);
                onChange(Array.from(next));
              }}
            />
            {option}
          </label>
        ))}
      </div>
    </div>
  );
}

function Textarea({ label, value, onChange }) {
  return (
    <label className="block md:col-span-2">
      <span className="mb-1 block text-xs font-semibold text-brand-muted">{label}</span>
      <textarea value={value} onChange={(event) => onChange(event.target.value)} rows={4} className="w-full rounded-xl border border-brand-border bg-brand-light px-3 py-2 text-sm outline-none transition focus:border-citius-blue focus:bg-white focus:ring-2 focus:ring-citius-blue/10" />
    </label>
  );
}

function Badge({ label, tone = "gray" }) {
  const tones = {
    blue: "bg-citius-blue/10 text-citius-blue",
    green: "bg-citius-green/15 text-emerald-700",
    amber: "bg-citius-orange/15 text-amber-700",
    red: "bg-red-50 text-red-700",
    purple: "bg-violet-50 text-violet-700",
    gray: "bg-brand-light text-brand-muted",
  };
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${tones[tone] || tones.gray}`}>{label}</span>;
}

function EmptyState({ label }) {
  return (
    <div className="rounded-2xl border border-dashed border-brand-border bg-white p-8 text-center text-sm text-brand-muted">
      {label}
    </div>
  );
}

function LoadingPanel() {
  return (
    <div className="grid min-h-60 place-items-center rounded-2xl border border-brand-border bg-white">
      <div className="flex items-center gap-2 text-sm text-brand-muted">
        <Loader2 className="animate-spin text-citius-orange" size={18} />
        Loading portal data
      </div>
    </div>
  );
}

function strong(value) {
  return <strong className="font-semibold">{value}</strong>;
}

function filterRows(rows, search, keys) {
  const term = search.trim().toLowerCase();
  if (!term) return rows;
  return rows.filter((row) =>
    keys.some((key) => String(row[key] || "").toLowerCase().includes(term)),
  );
}

function toNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function money(value) {
  return `INR ${Number(value || 0).toLocaleString("en-IN")}`;
}

function paymentTermLabel(queryType) {
  if (queryType === "Spiritual") return "100% advance";
  if (queryType === "B2B") return "80%-100% advance";
  if (["FIT", "Family Group"].includes(queryType)) return "90%-100% advance";
  if (queryType === "Cement Bidding") return "70%-100% advance";
  return "70%-90% advance";
}

function statusTone(status) {
  if (["Issued", "Approved", "Paid", "Active", "Available", "Done", "Order Confirmed", "Sent", "Assigned", "Confirmation", "Ready"].includes(status)) return "green";
  if (["Pending Issue", "Pending", "Awaiting", "Part Paid", "Proposal in progress", "Proposal in discussion", "Open", "Held", "Inquiry", "Proposal", "Ticketing", "Docs pending"].includes(status)) return "amber";
  if (["Cancelled", "Rejected", "Order Lost", "Overdue", "Inactive", "Blocked", "Closed"].includes(status)) return "red";
  if (["Reissue Required", "Name Change Required", "Re-applied", "Negotiation"].includes(status)) return "purple";
  return "blue";
}

function BriefcaseIcon(props) {
  return <Settings {...props} />;
}
