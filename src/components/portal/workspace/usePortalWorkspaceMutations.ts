import { api } from "@convex/_generated/api";
import { useAction, useMutation } from "convex/react";
import { useRef } from "react";
import {
  chunkPassengerImportRows,
  combinePassengerImportBatchResults,
  digestPassengerImportSource,
} from "@/lib/portal/passengerImportClient";

const PORTAL_BULK_DELETE_BATCH_SIZE = 32;

async function runBatchedDelete(ids: string[], invoke: (batch: string[]) => Promise<unknown>) {
  const batches = Array.from(
    { length: Math.ceil(ids.length / PORTAL_BULK_DELETE_BATCH_SIZE) },
    (_, index) =>
      ids.slice(index * PORTAL_BULK_DELETE_BATCH_SIZE, (index + 1) * PORTAL_BULK_DELETE_BATCH_SIZE)
  );
  await batches.reduce<Promise<unknown>>(
    (pending, batch) => pending.then(() => invoke(batch)),
    Promise.resolve()
  );
  return { deletedCount: ids.length };
}

export function usePortalWorkspaceMutations() {
  const commandIdsBySubmission = useRef(new Map<string, string>());
  const createQuery = useMutation(api.crm.queries.create);
  const updateQuery = useMutation(api.crm.queries.update);
  const submitToContractingMutation = useMutation(api.crm.queries.submitToContracting);
  const assignContracting = useMutation(api.crm.queries.assignContracting);
  const assignQueryTicketing = useMutation(api.crm.queries.assignQueryTicketing);
  const assignQueryTeams = useMutation(api.crm.queries.assignQueryTeams);
  const assignJobCardCreator = useMutation(api.crm.queries.assignJobCardCreator);
  const setJobCardCreatorAccess = useMutation(api.crm.staff.setJobCardCreatorAccess);
  const assignContractingOwner = useMutation(api.crm.jobCards.assignContractingOwner);
  const assignOperationsOwner = useMutation(api.crm.jobCards.assignOperationsOwner);
  const assignTicketingOwner = useMutation(api.crm.ticketing.assignTicketingOwner);
  const updateQueryStatusMutation = useMutation(api.crm.queries.updateStatus);
  const moveContractingPipelineStageMutation = useMutation(
    api.crm.queries.moveContractingPipelineStage
  );
  const moveSalesPipelineStageMutation = useMutation(api.crm.queries.moveSalesPipelineStage);
  const createProposal = useMutation(api.crm.proposals.create);
  const updateProposal = useMutation(api.crm.proposals.update);
  const addProposalCollaborator = useMutation(api.crm.proposals.addCollaborator);
  const removeProposalCollaborator = useMutation(api.crm.proposals.removeCollaborator);
  const sendProposalToSalesMutation = useMutation(api.crm.proposals.sendToSales);
  const createJobCard = useMutation(api.crm.jobCards.createFromQuery);
  const updateJobCard = useMutation(api.crm.jobCards.update);
  const updateJobStatus = useMutation(api.crm.jobCards.updateStatus);
  const addJobCardCollaborator = useMutation(api.crm.jobCards.addCollaborator);
  const removeJobCardCollaborator = useMutation(api.crm.jobCards.removeCollaborator);
  const createTraveller = useMutation(api.crm.travellers.create);
  const updateTraveller = useMutation(api.crm.travellers.update);
  const updateCallingStatus = useMutation(api.crm.travellers.updateCallingStatus);
  const updateVisaRecord = useMutation(api.crm.visa.updateRecord);
  const createVisa = useMutation(api.crm.visa.create);
  const createLeave = useMutation(api.crm.leave.create);
  const updateLeave = useMutation(api.crm.leave.update);
  const decideLeave = useMutation(api.crm.leave.decide);
  const removeLeave = useMutation(api.crm.leave.remove);
  const generateUploadUrl = useAction(api.crm.passportActions.generateUploadUrl);
  const encryptAndStorePassport = useAction(api.crm.passportActions.encryptAndStorePassport);
  const getPassportDocument = useAction(api.crm.passportActions.getPassportDocument);
  const removePassport = useAction(api.crm.passportActions.removePassport);
  const generateQueryUploadUrl = useAction(api.crm.queryAttachmentActions.generateUploadUrl);
  const attachQueryFile = useAction(api.crm.queryAttachmentActions.attachFile);
  const getQueryAttachmentUrl = useAction(api.crm.queryAttachmentActions.getDownloadUrl);
  const removeQueryAttachment = useAction(api.crm.queryAttachmentActions.removeAttachment);
  const generateProposalUploadUrl = useAction(api.crm.proposalAttachmentActions.generateUploadUrl);
  const attachProposalFile = useAction(api.crm.proposalAttachmentActions.attachFile);
  const getProposalAttachmentUrl = useAction(api.crm.proposalAttachmentActions.getDownloadUrl);
  const removeProposalAttachment = useAction(api.crm.proposalAttachmentActions.removeAttachment);
  const generateFinalizedPdfUploadUrl = useAction(
    api.crm.proposalAttachmentActions.generateFinalizedPdfUploadUrl
  );
  const attachFinalizedPdf = useAction(api.crm.proposalAttachmentActions.attachFinalizedPdf);
  const getFinalizedPdfUrl = useAction(api.crm.proposalAttachmentActions.getFinalizedPdfUrl);
  const removeFinalizedPdf = useAction(api.crm.proposalAttachmentActions.removeFinalizedPdf);
  const generateExpenseUploadUrl = useAction(api.crm.expenseAttachmentActions.generateUploadUrl);
  const attachExpenseProof = useAction(api.crm.expenseAttachmentActions.attachProof);
  const getExpenseAttachmentUrl = useAction(api.crm.expenseAttachmentActions.getDownloadUrl);
  const removeExpenseProof = useAction(api.crm.expenseAttachmentActions.removeProof);
  const startStaffOnboarding = useAction(api.crm.staffAction.startStaffOnboarding);
  const createPnr = useMutation(api.crm.ticketing.createPnr);
  const updatePnr = useMutation(api.crm.ticketing.updatePnr);
  const previewPassengerImportBatch = useAction(api.crm.importActions.previewPassengerImport);
  const commitPassengerImportBatch = useAction(api.crm.importActions.commitPassengerImport);
  const startPassengerExportAction = useAction(api.crm.importActions.startPassengerExport);
  const getPassengerExportDownload = useAction(api.crm.importActions.getPassengerExportDownload);
  const commitFlightImport = useMutation(api.crm.imports.commitFlightImport);
  const createTicket = useMutation(api.crm.ticketing.createTicket);
  const updateTicket = useMutation(api.crm.ticketing.updateTicket);
  const saveSeat = useMutation(api.crm.ticketing.saveSeatAllocation);
  const updateSeatAllocation = useMutation(api.crm.ticketing.updateSeatAllocation);
  const createHotel = useMutation(api.crm.ops.createHotel);
  const updateHotel = useMutation(api.crm.ops.updateHotel);
  const createTourManager = useMutation(api.crm.ops.createTourManager);
  const updateTourManager = useMutation(api.crm.ops.updateTourManager);
  const createInvoice = useMutation(api.crm.finance.createInvoice);
  const updateInvoice = useMutation(api.crm.finance.updateInvoice);
  const createExpense = useMutation(api.crm.finance.createExpense);
  const updateExpense = useMutation(api.crm.finance.updateExpense);
  const submitExpenseForApproval = useMutation(api.crm.finance.submitExpenseForApproval);
  const decideExpenseManager = useMutation(api.crm.finance.decideExpenseManager);
  const decideExpenseFinance = useMutation(api.crm.finance.decideExpenseFinance);
  const decideApproval = useMutation(api.crm.approvals.decide);
  const removeApproval = useMutation(api.crm.approvals.remove);
  const upsertStaff = useMutation(api.crm.staff.upsertStaff);
  const removeQuery = useMutation(api.crm.queries.remove);
  const removeProposal = useMutation(api.crm.proposals.remove);
  const removeJobCard = useMutation(api.crm.jobCards.remove);
  const removeTraveller = useMutation(api.crm.travellers.remove);
  const removeManyTravellersMutation = useMutation(api.crm.travellers.removeMany);
  const removeVisa = useMutation(api.crm.visa.remove);
  const removeManyVisasMutation = useMutation(api.crm.visa.removeMany);
  const removePnr = useMutation(api.crm.ticketing.removePnr);
  const removeManyPnrsMutation = useMutation(api.crm.ticketing.removeManyPnrs);
  const removeTicket = useMutation(api.crm.ticketing.removeTicket);
  const removeManyTicketsMutation = useMutation(api.crm.ticketing.removeManyTickets);
  const removeSeatAllocation = useMutation(api.crm.ticketing.removeSeatAllocation);
  const removeManySeatAllocationsMutation = useMutation(
    api.crm.ticketing.removeManySeatAllocations
  );
  const removeHotel = useMutation(api.crm.ops.removeHotel);
  const removeManyHotelsMutation = useMutation(api.crm.ops.removeManyHotels);
  const removeTourManager = useMutation(api.crm.ops.removeTourManager);
  const removeManyTourManagersMutation = useMutation(api.crm.ops.removeManyTourManagers);
  const removeInvoice = useMutation(api.crm.finance.removeInvoice);
  const removeExpense = useMutation(api.crm.finance.removeExpense);
  const removeStaff = useMutation(api.crm.staff.removeStaff);
  const removeNotification = useMutation(api.crm.activity.removeNotification);
  const markNotificationRead = useMutation(api.crm.activity.markNotificationRead);

  const removeManyTravellers = (args: { travellerIds: string[] }) =>
    runBatchedDelete(args.travellerIds, (travellerIds) =>
      removeManyTravellersMutation({ travellerIds })
    );
  const removeManyVisas = (args: { visaRecordIds: string[] }) =>
    runBatchedDelete(args.visaRecordIds, (visaRecordIds) =>
      removeManyVisasMutation({ visaRecordIds })
    );
  const removeManyPnrs = (args: { pnrIds: string[] }) =>
    runBatchedDelete(args.pnrIds, (pnrIds) => removeManyPnrsMutation({ pnrIds }));
  const removeManyTickets = (args: { ticketIds: string[] }) =>
    runBatchedDelete(args.ticketIds, (ticketIds) => removeManyTicketsMutation({ ticketIds }));
  const removeManySeatAllocations = (args: { seatAllocationIds: string[] }) =>
    runBatchedDelete(args.seatAllocationIds, (seatAllocationIds) =>
      removeManySeatAllocationsMutation({ seatAllocationIds })
    );
  const removeManyHotels = (args: { hotelIds: string[] }) =>
    runBatchedDelete(args.hotelIds, (hotelIds) => removeManyHotelsMutation({ hotelIds }));
  const removeManyTourManagers = (args: { tourManagerIds: string[] }) =>
    runBatchedDelete(args.tourManagerIds, (tourManagerIds) =>
      removeManyTourManagersMutation({ tourManagerIds })
    );

  const replaySafeCommandId = (signature: string) => {
    const existing = commandIdsBySubmission.current.get(signature);
    if (existing) {
      return existing;
    }
    const commandId = crypto.randomUUID();
    commandIdsBySubmission.current.set(signature, commandId);
    if (commandIdsBySubmission.current.size > 20) {
      const oldest = commandIdsBySubmission.current.keys().next().value;
      if (oldest) {
        commandIdsBySubmission.current.delete(oldest);
      }
    }
    return commandId;
  };

  const sendProposalToSales = async (args: {
    proposalId: string;
    proposalRevision: number;
    queryId: string;
  }) => {
    const signature = `proposal.query_handoff:${args.proposalId}:${args.queryId}:${args.proposalRevision}`;
    const result = await sendProposalToSalesMutation({
      ...args,
      commandId: replaySafeCommandId(signature),
    });
    commandIdsBySubmission.current.delete(signature);
    return result;
  };

  const moveContractingPipelineStage = async (
    args: Omit<Parameters<typeof moveContractingPipelineStageMutation>[0], "commandId">
  ) => {
    const signature = `proposal.query_handoff:${args.proposalId}:${args.queryId}:${args.proposalRevision}`;
    const result = await moveContractingPipelineStageMutation({
      ...args,
      commandId: replaySafeCommandId(signature),
    });
    commandIdsBySubmission.current.delete(signature);
    return result;
  };

  const updateQueryStatus = async (
    args: Omit<Parameters<typeof updateQueryStatusMutation>[0], "commandId">
  ) => {
    const confirmationRequested =
      args.salesStatus === "Order Confirmed" || args.contractingStatus === "Order Confirmed";
    if (!confirmationRequested) {
      return await updateQueryStatusMutation(args);
    }
    const signature = `query.order_confirmed:${args.queryId}:${JSON.stringify(args)}`;
    const result = await updateQueryStatusMutation({
      ...args,
      commandId: replaySafeCommandId(signature),
    });
    commandIdsBySubmission.current.delete(signature);
    return result;
  };

  const startPassengerExport = async (
    args: Omit<Parameters<typeof startPassengerExportAction>[0], "commandId"> & {
      commandId?: string;
    }
  ) => {
    const { commandId: persistedCommandId, ...exportArgs } = args;
    const signature = `passenger.export:${exportArgs.exportKind}:${exportArgs.jobCardId}`;
    const result = await startPassengerExportAction({
      ...exportArgs,
      commandId: persistedCommandId ?? replaySafeCommandId(signature),
    });
    commandIdsBySubmission.current.delete(signature);
    return result;
  };

  const previewPassengerImport = async (
    args: Parameters<typeof previewPassengerImportBatch>[0]
  ) => {
    const batches = chunkPassengerImportRows(args.rows);
    const results = await Promise.all(
      batches.map((rows) => previewPassengerImportBatch({ jobCardId: args.jobCardId, rows }))
    );
    const roomSummary: Record<string, number> = {};
    for (const result of results) {
      for (const [roomType, count] of Object.entries(
        result.roomSummary as Record<string, number>
      )) {
        roomSummary[roomType] = (roomSummary[roomType] ?? 0) + count;
      }
    }
    return { roomSummary, rows: results.flatMap((result) => result.rows) };
  };

  const commitPassengerImport = async (args: Parameters<typeof commitPassengerImportBatch>[0]) => {
    const batches = chunkPassengerImportRows(args.rows);
    if (batches.length === 0) {
      throw new Error("Passenger import requires at least one row");
    }
    const sourceDigest = await digestPassengerImportSource(args.jobCardId, args.rows);
    const importKinds = Array.from(
      new Set(args.rows.map((row) => String(row.importKind ?? "passenger")))
    ).sort();
    const results: Awaited<ReturnType<typeof commitPassengerImportBatch>>[] = [];
    for (const [batchIndex, rows] of batches.entries()) {
      results.push(
        // biome-ignore lint/performance/noAwaitInLoops: import batches must commit in manifest order.
        await commitPassengerImportBatch({
          jobCardId: args.jobCardId,
          operation: {
            batchIndex,
            batchTotal: batches.length,
            complete: batchIndex === batches.length - 1,
            importKinds,
            sourceDigest,
            total: args.rows.length,
          },
          rows,
        })
      );
    }
    return combinePassengerImportBatchResults(results, args.rows.length);
  };

  return {
    addJobCardCollaborator,
    addProposalCollaborator,
    assignContracting,
    assignContractingOwner,
    assignJobCardCreator,
    assignOperationsOwner,
    assignQueryTeams,
    assignQueryTicketing,
    assignTicketingOwner,
    attachExpenseProof,
    attachFinalizedPdf,
    attachProposalFile,
    attachQueryFile,
    commitFlightImport,
    commitPassengerImport,
    createExpense,
    createHotel,
    createInvoice,
    createJobCard,
    createLeave,
    createPnr,
    createProposal,
    createQuery,
    createTicket,
    createTourManager,
    createTraveller,
    createVisa,
    decideApproval,
    decideExpenseFinance,
    decideExpenseManager,
    decideLeave,
    encryptAndStorePassport,
    generateExpenseUploadUrl,
    generateFinalizedPdfUploadUrl,
    generateProposalUploadUrl,
    generateQueryUploadUrl,
    generateUploadUrl,
    getExpenseAttachmentUrl,
    getFinalizedPdfUrl,
    getPassengerExportDownload,
    getPassportDocument,
    getProposalAttachmentUrl,
    getQueryAttachmentUrl,
    markNotificationRead,
    moveContractingPipelineStageMutation: moveContractingPipelineStage,
    moveSalesPipelineStageMutation,
    previewPassengerImport,
    removeApproval,
    removeExpense,
    removeExpenseProof,
    removeFinalizedPdf,
    removeHotel,
    removeInvoice,
    removeJobCard,
    removeJobCardCollaborator,
    removeLeave,
    removeManyHotels,
    removeManyPnrs,
    removeManySeatAllocations,
    removeManyTickets,
    removeManyTourManagers,
    removeManyTravellers,
    removeManyVisas,
    removeNotification,
    removePassport,
    removePnr,
    removeProposal,
    removeProposalAttachment,
    removeProposalCollaborator,
    removeQuery,
    removeQueryAttachment,
    removeSeatAllocation,
    removeStaff,
    removeTicket,
    removeTourManager,
    removeTraveller,
    removeVisa,
    saveSeat,
    sendProposalToSales,
    setJobCardCreatorAccess,
    startPassengerExport,
    startStaffOnboarding,
    submitExpenseForApproval,
    submitToContractingMutation,
    updateCallingStatus,
    updateExpense,
    updateHotel,
    updateInvoice,
    updateJobCard,
    updateJobStatus,
    updateLeave,
    updatePnr,
    updateProposal,
    updateQuery,
    updateQueryStatus,
    updateSeatAllocation,
    updateTicket,
    updateTourManager,
    updateTraveller,
    updateVisaRecord,
    upsertStaff,
  };
}
