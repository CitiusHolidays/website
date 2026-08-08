import { createAdministrationModalCommands } from "./modalCommands/administration";
import { createCommercialModalCommands } from "./modalCommands/commercial";
import { createOperationsModalCommands } from "./modalCommands/operations";

export const MODAL_COMMAND_IDS = [
  "addJobCardCollaborator",
  "addProposalCollaborator",
  "approvalDecide",
  "assignContracting",
  "assignContractingOwner",
  "assignJobCardCreator",
  "assignOperationsOwner",
  "assignQueryTeams",
  "assignQueryTicketing",
  "assignTicketingOwner",
  "expense",
  "hotel",
  "invoice",
  "jobCard",
  "leave_create",
  "pnr",
  "proposal",
  "query",
  "queryStatus",
  "removeJobCardCollaborator",
  "removeProposalCollaborator",
  "salesDecision",
  "seat",
  "staff",
  "ticket",
  "tourManager",
  "travelBatch",
  "traveller",
  "visa",
  "visa_create",
] as const;

export type ModalCommandId = (typeof MODAL_COMMAND_IDS)[number];
export type ModalCommandForm = Record<string, any>;
export type ModalCommand = (form: ModalCommandForm) => Promise<unknown>;
export type ModalCommandMap = Partial<Record<ModalCommandId, ModalCommand>>;

export interface ModalCommandPolicy {
  access?: unknown;
  has?: (permission: string) => boolean;
  jobCardModals?: ReadonlySet<string>;
  [key: string]: unknown;
}

export interface ModalCommandAdapter {
  commands: ModalCommandMap;
  policy: ModalCommandPolicy;
}

export type ModalCommandRequest = {
  [Command in ModalCommandId]: {
    adapter: ModalCommandAdapter;
    form: ModalCommandForm;
    modal: Command;
  };
}[ModalCommandId];

export function isModalCommandId(modal: string): modal is ModalCommandId {
  return (MODAL_COMMAND_IDS as readonly string[]).includes(modal);
}

export function createProductionModalCommandAdapter({
  administration,
  commercial,
  operations,
  policy,
}: {
  administration: any;
  commercial: any;
  operations: any;
  policy: ModalCommandPolicy;
}): ModalCommandAdapter {
  return {
    commands: {
      ...createCommercialModalCommands(commercial),
      ...createOperationsModalCommands(operations),
      ...createAdministrationModalCommands(administration),
    },
    policy,
  };
}

export function createInMemoryModalCommandAdapter({
  handlers = {},
  policy = {},
}: {
  handlers?: ModalCommandMap;
  policy?: ModalCommandPolicy;
} = {}) {
  const invocations: { form: ModalCommandForm; modal: ModalCommandId }[] = [];
  const commands = Object.fromEntries(
    MODAL_COMMAND_IDS.map((modal) => [
      modal,
      async (form: ModalCommandForm) => {
        invocations.push({ form, modal });
        return await handlers[modal]?.(form);
      },
    ])
  ) as ModalCommandMap;
  return {
    adapter: { commands, policy } satisfies ModalCommandAdapter,
    invocations,
  };
}
