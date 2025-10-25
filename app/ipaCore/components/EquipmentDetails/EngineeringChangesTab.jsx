import React, { useState, useContext, useEffect } from "react";
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  Collapse,
  IconButton,
  FormControl,
  Select,
  MenuItem,
} from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import KeyboardArrowDownIcon from "@material-ui/icons/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@material-ui/icons/KeyboardArrowUp";
import { ModelContext } from "../../contexts/ModelContext";
import { MapMachineContext } from "../../pageComponents/portfolioOverview/PortfolioOverview";
import { CircularProgress } from "@material-ui/core";

const useStyles = makeStyles((theme) => ({
  filterBox: {
    display: "flex",
    justifyContent: "flex-end",
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(2),
  },
  formControl: { minWidth: 120 },
  renderValue: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    padding: "0px",
    marginLeft: 30,
    color: theme.palette.text.secondary,
  },
  arrow: { marginLeft: theme.spacing(1) },
  card: {
    marginBottom: theme.spacing(2),
    borderRadius: 4,
    backgroundColor: "#EBEBEB",
    fontFamily: "Inter, sans-serif",
    cursor: "pointer",
  },
  activeCard: { backgroundColor: "#feeff7" },
  expandIcon: { marginLeft: "auto" },
  row: { display: "flex", alignItems: "center", padding: "2px 0" },
  bodyText: {
    flex: "0 0 200px",
    fontWeight: 500,
    fontSize: 14,
    fontFamily: "Inter, sans-serif",
    color: "#5D5D5D",
    marginBottom: 2,
  },
  logCaption: { fontSize: 12, marginBottom: 2, fontFamily: "Inter, sans-serif" },
  logName: {
    color: "#000",
    fontSize: 14,
    fontFamily: "Inter, sans-serif",
    fontWeight: 500,
  },
  title: {
    color: "#5D5D5D",
    fontWeight: 700,
    fontSize: 14,
    fontFamily: "Inter, sans-serif",
    marginBottom: theme.spacing(1),
  },
  chipSmall: {
    height: 18,
    fontSize: 12,
    textTransform: "uppercase",
    border: "1px solid #ccc",
    backgroundColor: "transparent",
    "& .MuiChip-label": { paddingLeft: theme.spacing(0.5), paddingRight: theme.spacing(0.5), fontSize: 12 },
  },
}));

const statusConfig = {
  APPROVED: { bg: "#D1E7D1", text: "#1A8817", label: "Approved" },
  REGISTERED: { bg: "#E6C7F0", text: "#8E11BA", label: "Registered" },
  CLOSED: { bg: "#DCDCDC", text: "#5D5D5D", label: "Closed" },
};
const filterOptions = ["All", ...Object.keys(statusConfig)];

const focusLogsInViewer = async (ec, logs, setSliceElementsByQuery, setTriggeredByFocusLogs, setSiteEquipment) => {
  if (!logs || !logs.length) {
    // still open panel even if no sliceables, but nothing to query
    setSiteEquipment({ data: [], EC: ec });
    setTriggeredByFocusLogs(true);
    return;
  }

  setSiteEquipment({ data: logs, EC: ec });
  const elementIds = logs
    .map((log) => log["Equipment Id"])
    .filter((id) => id !== undefined && id !== null);
  if (!elementIds.length) {
    setTriggeredByFocusLogs(true);
    return;
  }

  setTriggeredByFocusLogs(true);
  await setSliceElementsByQuery([
    {
      propRef: { property: { propertyType: "instance" } },
      queryPartial: { "properties.Mark.val": { $in: elementIds } },
    },
  ]);
};


export default function EngineeringChangesTab({ data, loading }) {
  const classes = useStyles();
  const {
    setSliceElementsByQuery,
    sliceElements,
    setIsBottomECPanelOpen,
    setSiteEquipment,
  } = useContext(ModelContext);

  const [filter, setFilter] = useState("All");
  const [expanded, setExpanded] = useState({}); // keyed by EC key
  const [isFilteringMode, setIsFilteringMode] = useState(false);
  const [triggeredByFocusLogs, setTriggeredByFocusLogs] = useState(false);

  const getEcKey = (ec) => ec?.["EC ID"] ?? ec?.id ?? ec?.title ?? String(ec?.index);

  // Keep selection stable by EC key
  const [activeEcKey, setActiveEcKey] = useState(null);

  const handleExpandClick = (key) =>
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));

  const handleCardClick = async (ec) => {
    const key = getEcKey(ec);
    setExpanded({});
    setIsFilteringMode(false);

    if (activeEcKey === key) {
      setActiveEcKey(null);
      await setSliceElementsByQuery([]);
      return;
    }

    setActiveEcKey(key); // highlight immediately

    const logsArr = toLogsArray(ec.logs);
    await focusLogsInViewer(ec, logsArr, setSliceElementsByQuery, setTriggeredByFocusLogs, setSiteEquipment);
  };

  useEffect(() => {
    if (triggeredByFocusLogs) {
      setIsBottomECPanelOpen(true);
      setTriggeredByFocusLogs(false);
    }
  }, [sliceElements, triggeredByFocusLogs, setIsBottomECPanelOpen]);

  const filteredData =
    !data || data.length === 0
      ? []
      : filter === "All"
      ? data.filter((ec) => toLogsArray(ec.logs).length > 0)
      : data.filter((ec) => {
          if (!ec.status || toLogsArray(ec.logs).length === 0) return false;
          switch (filter) {
            case "APPROVED": return ec.status.APPROVED > 0;
            case "CLOSED": return ec.status.CLOSED > 0;
            case "REGISTERED": return ec.status.REGISTERED > 0;
            default: return true;
          }
        });

  // IMPORTANT: do NOT clear activeEcKey when filters change.
  // This keeps the old behavior: the selected card stays pink/active even as others reappear.

  const formatFieldName = (name) => name.replace(/([a-z])([A-Z])/g, "$1 $2");
  const filterByLabel = filter === "All" ? "Filter by" : `Filter by (${filter})`;

  return (
    <Box>
      {!loading && (
        <Box className={classes.filterBox}>
          <FormControl className={classes.formControl}>
            <Select
              value={filter}
              onChange={(e) => {
                setFilter(e.target.value);
                setIsFilteringMode(true);
              }}
              displayEmpty
              disableUnderline
              renderValue={() => (
                <div className={classes.renderValue}>
                  <span>{filterByLabel}</span>
                  <KeyboardArrowDownIcon className={classes.arrow} />
                </div>
              )}
            >
              {["All", "REGISTERED", "APPROVED", "CLOSED"].map((option) => {
                const circleColor =
                  option === "All"
                    ? null
                    : { REGISTERED: "#8E11BA", APPROVED: "#1A8817", CLOSED: "#5D5D5D" }[option];
                const displayText = option === "All" ? "All" : option[0] + option.slice(1).toLowerCase();
                return (
                  <MenuItem key={option} value={option}>
                    <Box display="flex" alignItems="center">
                      {circleColor && <Box width={10} height={10} borderRadius="50%" bgcolor={circleColor} mr={1.5} />}
                      {displayText}
                    </Box>
                  </MenuItem>
                );
              })}
            </Select>
          </FormControl>
        </Box>
      )}

      {loading ? (
        <Box display="flex" justifyContent="center" alignItems="center" py={6}>
          <CircularProgress />
        </Box>
      ) : filteredData.length === 0 ? (
        <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" py={6}>
          <Typography variant="h6" color="textSecondary" gutterBottom>
            Sorry, there are no engineering changes to show.
          </Typography>
          <Typography variant="body2" color="textSecondary">
            Try selecting a different filter or building.
          </Typography>
        </Box>
      ) : (
        filteredData.map((ec, index) => {
          const key = getEcKey(ec);

          // When NOT filtering, show only the active card (legacy behavior).
          // When filtering, show all cards; the active one stays pink.
          if (!isFilteringMode && activeEcKey !== null && activeEcKey !== key) return null;

          const orderedFields = ["Base Revision", "Equipment Revision", "EC Type", "EC ID", "Date Reviewed"];
          const isActive = activeEcKey === key;

          return (
            <Card
              key={key}
              className={`${classes.card} ${isActive ? classes.activeCard : ""}`}
              onClick={() => handleCardClick(ec)}
            >
              <CardContent>
                <Box display="flex" alignItems="center" marginBottom={1}>
                  {Object.entries(ec.status || {}).map(([status, count]) => (
                    <Chip
                      key={status}
                      label={`${status} ${count}`}
                      className={classes.chipSmall}
                      style={{
                        backgroundColor: statusConfig[status]?.bg || "#EBEBEB",
                        color: statusConfig[status]?.text || "#000",
                        marginRight: 4,
                      }}
                      size="small"
                    />
                  ))}
                  <IconButton
                    className={classes.expandIcon}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleExpandClick(key);
                    }}
                    size="small"
                  >
                    {expanded[key] ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
                  </IconButton>
                </Box>

                <Typography className={classes.title}>EC Title: {ec["EC Title"]}</Typography>

                {orderedFields.map((field) => (
                  <Typography key={field} className={classes.bodyText}>
                    <strong>{formatFieldName(field)}:</strong> {ec[field] || "-"}
                  </Typography>
                ))}
              </CardContent>

              <Collapse in={expanded[key]} timeout="auto" unmountOnExit>
                <CardContent>
                  {toLogsArray(ec.logs).map((log, i) => {
                    const name = log["Site Equipment Id"] || `Log ${i + 1}`;
                    return (
                      <Box key={i} mb={1} pb={1} borderBottom="1px solid #e0e0e0">
                        <Typography variant="caption" style={{ color: "#777", fontSize: 12, marginBottom: 2 }}>
                          Name id
                        </Typography>
                        <Box display="flex" alignItems="center" justifyContent="space-between">
                          <Typography className={classes.logName}>{name}</Typography>
                          <Chip
                            label={log.status || "Unknown"}
                            className={classes.chipSmall}
                            style={{
                              backgroundColor: statusConfig[log.status]?.bg || "#EBEBEB",
                              color: statusConfig[log.status]?.text || "#000",
                            }}
                            size="small"
                          />
                        </Box>
                      </Box>
                    );
                  })}
                </CardContent>
              </Collapse>
            </Card>
          );
        })
      )}
    </Box>
  );
}

// helpers at bottom (unchanged)
const toLogsArray = (logs) => {
  if (Array.isArray(logs)) return logs;
  if (logs && typeof logs === "object") return Object.values(logs);
  return [];
};

