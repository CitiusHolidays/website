import { firstSelectableOptionLabel, selectOptionByMatchingLabel } from "../helpers/select";
import { modalCombobox, modalField } from "../helpers/modal";
import { PortalPage } from "./portalPage";

export class TravellersPage extends PortalPage {
  async open() {
    await this.gotoPortalView("/portal/travellers");
  }

  async firstAvailableJobCardLabel() {
    const filter = this.page.getByLabel(/job card/i).first();
    if (await filter.isVisible()) {
      return firstSelectableOptionLabel(filter);
    }
    await this.toolbarAction("Add Traveller").click();
    const label = await firstSelectableOptionLabel(modalCombobox(this.page, "Job Card"));
    await this.page.getByTestId("portal-entity-modal-cancel").click();
    return label;
  }

  async filterByJobCard(jobCode: string) {
    const filter = this.page.getByLabel(/job card/i).first();
    if (await filter.isVisible()) {
      await selectOptionByMatchingLabel(filter, jobCode);
    }
  }

  async createTraveller(jobCode: string, fullName: string) {
    await this.toolbarAction("Add Traveller").click();
    if (jobCode) {
      await selectOptionByMatchingLabel(modalCombobox(this.page, "Job Card"), jobCode);
    }
    await modalField(this.page, "Full Name").fill(fullName);
  }

  travellerRow(fullName: string) {
    return this.rowContaining(fullName);
  }
}
