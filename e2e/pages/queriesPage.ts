import { expectEntityModalOpen, modalCombobox, modalField } from "../helpers/modal";
import { selectOptionByMatchingLabel } from "../helpers/select";
import { PortalPage } from "./portalPage";

/** Seeded ordinary contracting staff used for query handoff in E2E flows. */
export const E2E_SEEDED_CONTRACTING_SPOC = "E2E Contracting";
export const E2E_DEFAULT_TICKETING_SCOPE = "Not required";

export class QueriesPage extends PortalPage {
  async open() {
    await this.gotoPortalView("/portal/queries");
  }

  async createQuery(
    clientName: string,
    contractingSpocName: string = E2E_SEEDED_CONTRACTING_SPOC,
    ticketingScope: string = E2E_DEFAULT_TICKETING_SCOPE
  ) {
    await this.toolbarAction("New Query").click();
    await expectEntityModalOpen(this.page);
    await modalField(this.page, "Client / Company").fill(clientName);
    await modalField(this.page, "No. of Pax").fill("2");
    await selectOptionByMatchingLabel(
      modalCombobox(this.page, "Contracting SPOC"),
      contractingSpocName
    );
    await modalCombobox(this.page, "Ticketing Scope").selectOption({ label: ticketingScope });
  }

  queryRow(clientName: string) {
    return this.rowContaining(clientName);
  }
}
