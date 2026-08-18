import { validateModalForm } from "@/lib/portal/formValidation";
import {
  isModalCommandId,
  type ModalCommandAdapter,
  type ModalCommandForm,
} from "@/lib/portal/modalCommandAdapter";
import { isRuntimeString } from "../runtimeValues";

function modalRequiresJobCard(
  modal: string,
  form: ModalCommandForm,
  jobCardModals?: ReadonlySet<string>
) {
  if (!jobCardModals?.has(modal)) {
    return false;
  }
  return !(modal === "expense" && form.expenseType === "office");
}

export async function executeModalCommand({
  adapter,
  modal,
  form,
}: {
  adapter: ModalCommandAdapter;
  form: ModalCommandForm;
  modal: null | string;
}): Promise<string> {
  if (!(modal && isModalCommandId(modal))) {
    throw new Error(`Unsupported modal command: ${modal}`);
  }
  validateModalForm(modal, form, adapter.policy);
  if (modalRequiresJobCard(modal, form, adapter.policy.jobCardModals) && !form.jobCardId?.trim()) {
    throw new Error("Please select a job card.");
  }
  const command = adapter.commands[modal];
  if (!command) {
    throw new Error(`Unsupported modal command: ${modal}`);
  }
  const result = await command(form);
  return isRuntimeString(result) && result ? result : "Saved";
}
