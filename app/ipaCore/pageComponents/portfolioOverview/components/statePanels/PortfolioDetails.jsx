import React, {useEffect, useState} from 'react';
import DeployStatusChart from '../DeployStatusBarChart';
import SearchPanel from '../SearchPanel';
import {Box} from "@mui/material";
import {useDispatch, useSelector} from "react-redux";
import {getFilter, setFilter} from "../../../../redux/filters.js";

export default function PortfolioDetails({ context, userConfig, snapshot, send, stateKey, handler }) {

    const globalFilters = useSelector(getFilter)
    const dispatch = useDispatch();

    useEffect(()=>{
        send({ type: 'UPDATE_FILTERS', filters: globalFilters });
    },[globalFilters])

    return (
        <div>
            <Box pl={2} pr={2} pt={2}>
                <SearchPanel
                    initialFilter={globalFilters["site"]}
                    userConfig={userConfig}
                    context={context}
                    stateKey={stateKey}
                    onSubmit={(filter, rawFilters) => {
                        const newGlobalFilters = {...globalFilters, ["site"]: filter};
                        dispatch(setFilter(newGlobalFilters));
                    }}
                />

                <DeployStatusChart
                    userConfig={userConfig}
                    context={context}
                    snapshot={snapshot}
                    send={send}
                    stateKey={stateKey}
                />
            </Box>
        </div>
    );
}
