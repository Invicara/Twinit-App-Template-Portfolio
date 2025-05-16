//import { render } from 'react-dom';
import { createRoot } from 'react-dom/client'
import React from 'react';
import _ from 'lodash'
import {IafProj, IafSession} from '@dtplatform/platform-api';
import { AliveScope } from 'react-activation';
import {IpaMainLayout} from '@invicara/ipa-core/modules/IpaLayouts';
import ipaConfig from '../ipaCore/ipaConfig'
import './styles/app.scss'

const onConfigLoad = async (store, userConfig, AppContext) => {
  console.log('onConfigLoad ->', AppContext, store, userConfig)
  
  IafSession.setConfig(endPointConfig)
  
}

const container = document.getElementById('app')
const root = createRoot(container)
root.render(<AliveScope>
       <IpaMainLayout
            ipaConfig={ipaConfig}
            onConfigLoad={onConfigLoad}
        />
    </AliveScope>)

if (module.hot) {
  module.hot.accept();
}
