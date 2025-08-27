//import { render } from 'react-dom';
import { createRoot } from 'react-dom/client'
import React, { useState, useEffect } from 'react';
import _ from 'lodash'
import {IafProj, IafSession} from '@dtplatform/platform-api';
import { AliveScope } from 'react-activation';
import {IpaMainLayout} from '@invicara/ipa-core/modules/IpaLayouts';
import { ModelContextProvider } from '../ipaCore/contexts/ModelContext';
import ipaConfig from '../ipaCore/ipaConfig'
import './styles/app.scss'
import { mapboxGISMode, mmvRegisterMode } from '@invicara/ipa-core-mmv';
import { ThemeProvider, CssBaseline } from '@material-ui/core';
import { themeOptions } from '../styles/defaultTheme';

mmvRegisterMode("mmvGIS", mapboxGISMode)

// Wrapper component to provide ModelContext globally
const AppWithModelContext = () => {
  const [project, setProject] = useState(null)
  const [appContext, setAppContext] = useState(null)

  const onConfigLoad = async (store, userConfig, AppContext) => {
    console.log('onConfigLoad ->', AppContext, store, userConfig)
    
    IafSession.setConfig(endPointConfig)
    
    // Set the appContext for the ModelContext
    setAppContext(AppContext)
    
    // Get current project and set it for the ModelContext
    try {
      const currentProject = await IafProj.getCurrent()
      setProject(currentProject)
    } catch (error) {
      console.error('Error getting current project:', error)
    }
  }

  return (
    <ThemeProvider theme={themeOptions}>
      <CssBaseline />
      <ModelContextProvider project={project} appContext={appContext}>
        <IpaMainLayout
          ipaConfig={ipaConfig}
          onConfigLoad={onConfigLoad}
        />
      </ModelContextProvider>
    </ThemeProvider>
  )
}

const container = document.getElementById('app')
const root = createRoot(container)
root.render(<AliveScope>
       <AppWithModelContext />
    </AliveScope>)

if (module.hot) {
  module.hot.accept();
}
