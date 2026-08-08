import { toNumber } from "@/lib/portal/formUtils";
import { withoutUndefinedValues } from "./shared";

export function createOperationsModalCommands(deps) {
  return {
    hotel: async (form) => {
      const payload = {
        checkInDate: form.checkInDate,
        checkOutDate: form.checkOutDate,
        city: form.city,
        name: form.hotelName,
        specialInstructions: form.notes,
      };
      if (form.entityId) {
        await deps.updateHotel({ hotelId: form.entityId, ...payload });
      } else {
        await deps.createHotel({ jobCardId: form.jobCardId, ...payload });
      }
    },
    pnr: async (form) => {
      const payload = {
        airline: form.airline,
        fareType: form.fareType,
        pnrCode: form.pnrCode,
        route: form.route,
        totalSeats: toNumber(form.totalSeats, 1),
      };
      if (form.entityId) {
        await deps.updatePnr({ pnrId: form.entityId, ...payload });
      } else {
        await deps.createPnr({ jobCardId: form.jobCardId, ...payload });
      }
    },
    seat: async (form) => {
      const payload = {
        notes: form.notes,
        pnrId: form.pnrId || undefined,
        seatNumber: form.seatNumber,
        status: form.seatStatus,
        travellerId: form.travellerId || undefined,
      };
      if (form.entityId) {
        await deps.updateSeatAllocation({ seatAllocationId: form.entityId, ...payload });
      } else {
        await deps.saveSeat({ jobCardId: form.jobCardId, ...payload });
      }
    },
    ticket: async (form) => {
      const payload = {
        cabinClass: form.cabinClass,
        mealPreference: form.foodPreference,
        paymentType: form.paymentType,
        pnrId: form.pnrId || undefined,
        seatNumber: form.seatNumber,
        seatPreference: form.seatPreference,
        ticketNumber: form.ticketNumber,
        ticketStatus: form.ticketStatus,
        ticketType: form.ticketType,
        travellerId: form.travellerId || undefined,
      };
      if (form.entityId) {
        await deps.updateTicket({ ticketId: form.entityId, ...payload });
      } else {
        await deps.createTicket({ jobCardId: form.jobCardId, ...payload });
      }
    },
    tourManager: async (form) => {
      const selected = deps.team.find((member) => member.id === form.staffId);
      const payload = {
        availabilityDate: form.travelStartDate,
        email: form.staffEmail,
        jobCardId: form.jobCardId || undefined,
        name: selected?.name || form.tourManagerName,
        notes: form.notes,
        phone: form.paidBy,
        reportingInstructions: form.reportingInstructions,
        travelBatchId: form.travelBatchId || "",
      };
      if (form.entityId) {
        await deps.updateTourManager({
          ...payload,
          staffId: form.staffId || undefined,
          tourManagerId: form.entityId,
        });
      } else {
        await deps.createTourManager({ ...payload, staffId: form.staffId || undefined });
      }
    },
    travelBatch: async (form) => {
      const payload = withoutUndefinedValues({
        confirmedPax: toNumber(form.confirmedPax, 1),
        contractingOwnerId: form.contractingOwnerId || undefined,
        contractingOwnerName: form.contractingOwnerName?.trim() || undefined,
        destination: form.destination,
        operationsOwnerId: form.operationsOwnerId || undefined,
        operationsOwnerName: form.operationsOwnerName?.trim() || undefined,
        roomCount: toNumber(form.roomCount, 0),
        status: form.status || undefined,
        ticketingOwnerId: form.ticketingOwnerId || undefined,
        ticketingOwnerName: form.ticketingOwnerName?.trim() || undefined,
        tourManagerName: form.tourManagerName?.trim() || undefined,
        travelEndDate: form.travelEndDate,
        travelStartDate: form.travelStartDate,
      });
      if (form.entityId) {
        await deps.updateTravelBatch({ travelBatchId: form.entityId, ...payload });
      } else {
        await deps.createTravelBatch({ jobCardId: form.jobCardId, ...payload });
      }
    },
    traveller: async (form) => {
      const payload = {
        arrivingEarly: form.arrivingEarly === "Yes",
        biometricAppointmentDate: form.biometricAppointmentDate,
        domesticTravelRequired: form.domesticTravelRequired === "Yes",
        extensionOfTour: form.extensionOfTour === "Yes",
        foodPreference: form.foodPreference,
        fullName: form.fullName,
        gender: form.gender,
        givenName: form.givenName,
        guestCompanions: form.guestCompanions,
        guestType: form.guestType,
        hotelAllocation: form.hotelAllocation,
        passportStatus: form.passportStatus,
        paymentType: form.paymentType,
        roomType: form.roomType,
        specialRequests: form.notes,
        surname: form.surname,
        travelBatchId: form.travelBatchId || "",
        travelDate: form.travelDate,
        travelHub: form.travelHub,
        visaRequired: form.visaRequired === "Yes",
      };
      if (form.entityId) {
        await deps.updateTraveller({ travellerId: form.entityId, ...payload });
      } else {
        await deps.createTraveller({ jobCardId: form.jobCardId, ...payload });
      }
    },
    visa: async (form) =>
      await deps.updateVisaRecord({
        appointmentDate: form.appointmentDate,
        notes: form.notes,
        status: form.visaStatus,
        visaRecordId: form.visaRecordId,
      }),
    visa_create: async (form) =>
      await deps.createVisa({ status: form.visaStatus, travellerId: form.travellerId }),
  };
}
