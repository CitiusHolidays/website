import { entityModal, expectEntityModalOpen, modalSpinbutton } from "../helpers/modal";
import { PortalPage } from "./portalPage";

export class ProposalsPage extends PortalPage {
  async open() {
    await this.gotoPortalView("/portal/proposals");
  }

  async createProposalForQuery(clientName: string) {
    await this.toolbarAction("New Proposal").click();
    await expectEntityModalOpen(this.page);
    await entityModal(this.page)
      .getByRole("checkbox", { name: new RegExp(clientName) })
      .check();
    await modalSpinbutton(this.page, "Land Cost/Pax").fill("1000");
    await modalSpinbutton(this.page, "Airfare/Pax").fill("500");
    await modalSpinbutton(this.page, "Visa Cost/Pax").fill("100");
    await modalSpinbutton(this.page, "Selling Price").fill("2500");
  }

  proposalRow(clientName: string) {
    return this.rowContaining(clientName);
  }
}
