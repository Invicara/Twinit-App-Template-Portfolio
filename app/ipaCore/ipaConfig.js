import { STATE_KEY } from "./redux/pageComponentState"
import { SETUP_SITE_KEY } from "./redux/siteSetup"
import { FILTERS_KEY } from "./redux/filters"

const ipaConfig = {
   appName: "Model Quick View",
   configUserType: "quick-view",
   applicationId: '698c1b53-5343-4028-a259-f8d66399c36c',
   scriptPlugins: [],
   css: [],
    redux: {
        slices: [
            {name: STATE_KEY, file: 'pageComponentState.js'},
            {name: SETUP_SITE_KEY, file: 'siteSetup.js'},
            {name: FILTERS_KEY, file: 'filters.js'}
        ]
    },
   components: {
      dashboard: [],
      entityData: [],
      entityAction: []
   },
   mapPortfolio: {
      statePanel: {
         componentPaths:
             {
                "portfolio": "portfolio/PortfolioDetails.jsx",
                "portfolio.site": "SiteDetails.jsx",
                "portfolio.site.building": "building/tabs/BuildingTabs.jsx",
                "portfolio.site.building.modelElement": undefined,
             }
      }
   }
}

   export default ipaConfig

