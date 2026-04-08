import {defineCliConfig} from 'sanity/cli'

export default defineCliConfig({
  api: {
    projectId: '469zdu2i',
    dataset: 'production'
  },
  deployment: {
    appId: 'br3hzr6tzrsasp1suvmvtc89'
  },
  /**
   * Enable auto-updates for studios.
   * Learn more at https://www.sanity.io/docs/cli#auto-updates
   */
  autoUpdates: true,
})
