import { defineCliConfig } from "sanity/cli";

export default defineCliConfig({
  api: {
    dataset: "production",
    projectId: "469zdu2i",
  },
  /**
   * Enable auto-updates for studios.
   * Learn more at https://www.sanity.io/docs/cli#auto-updates
   */
  autoUpdates: true,
  deployment: {
    appId: "br3hzr6tzrsasp1suvmvtc89",
  },
});
