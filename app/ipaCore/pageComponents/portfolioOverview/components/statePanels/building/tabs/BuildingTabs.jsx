import * as React from "react";
import { Tabs, Tab, Box, CircularProgress } from "@mui/material";
import BuildingInfo from "../BuildingInfo.jsx";

// Pretend this is your heavy chart tab component
const DashboardTab = React.lazy(() => import("../BuildingDashboard.jsx"));

function TabPanel({
                      value,
                      index,
                      mounted,
                      children,
                  }) {
    if (!mounted) return null; // don't mount until visited at least once
    const active = value === index;
    return (
        <div
            role="tabpanel"
            hidden={!active}
            id={`tabpanel-${index}`}
            aria-labelledby={`tab-${index}`}
        >
            {active && <Box sx={{ p: 0 }}>{children}</Box>}
        </div>
    );
}

export default function LazyTabs({context}) {
    const [value, setValue] = React.useState(0);

    // Track which tabs have been opened at least once
    const [visited, setVisited] = React.useState(new Set([0]));

    const handleChange = (_, newValue) => {
        setValue(newValue);
        setVisited(prev => {
            if (prev.has(newValue)) return prev;
            const next = new Set(prev);
            next.add(newValue);
            return next;
        });
    };
    return (
        <Box sx={{ p: 0, m: 0 }}>
            <Tabs value={value} onChange={handleChange} aria-label="building tabs" variant="fullWidth">
                <Tab id="tab-0" label="Info" aria-controls="tabpanel-0" />
                <Tab id="tab-1" label="Dashboard" aria-controls="tabpanel-1" />
            </Tabs>

            {/* Tab 0: lightweight, mounts immediately */}
            <TabPanel value={value} index={0} mounted={visited.has(0)}>
                <BuildingInfo context={context}></BuildingInfo>
            </TabPanel>

            {/* Tab 1: heavy, code-split + only mounts on first open */}
            <TabPanel value={value} index={1} mounted={visited.has(1)}>
                <React.Suspense fallback={<CircularProgress />}>
                    <DashboardTab />
                </React.Suspense>
            </TabPanel>
        </Box>
    );
}
