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
import {
  useActor,
  useSelector as useXstateSelector,
  useMachine,
} from "@xstate/react";
import { CircularProgress } from "@material-ui/core"; // add this at the top

const useStyles = makeStyles((theme) => ({
  filterBox: {
    display: "flex",
    justifyContent: "flex-end",
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(2),
  },
  formControl: {
    minWidth: 120,
  },
  renderValue: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    padding: "0px",
    marginLeft: 30,
    color: theme.palette.text.secondary,
  },
  arrow: {
    marginLeft: theme.spacing(1),
  },
  card: {
    marginBottom: theme.spacing(2),
    borderRadius: 4,
    backgroundColor: "#EBEBEB",
    fontFamily: "Inter, sans-serif",
    cursor: "pointer",
  },
  activeCard: {
    backgroundColor: "#F2A1D1",
  },
  expandIcon: {
    marginLeft: "auto",
  },
  row: {
    display: "flex",
    alignItems: "center",
    padding: "2px 0",
  },
  bodyText: {
    flex: "0 0 200px",
    fontWeight: 500,
    fontSize: 14,
    fontFamily: "Inter, sans-serif",
    color: "#5D5D5D",
    marginBottom: 2,
  },
  logCaption: {
    fontSize: 12,
    marginBottom: 2,
    fontFamily: "Inter, sans-serif",
  },
  logName: {
    color: "#000",
    fontSize: 14,
    fontFamily: "Inter, sans-serif",
    fontWeight: 500,
  },
  title: {
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
    "& .MuiChip-label": {
      paddingLeft: theme.spacing(0.5),
      paddingRight: theme.spacing(0.5),
      fontSize: 12,
    },
  },
}));

const statusConfig = {
  APPROVED: { bg: "#D1E7D1", text: "#1A8817", label: "Approved" },
  REGISTERED: { bg: "#E6C7F0", text: "#8E11BA", label: "Registered" },
  CLOSED: { bg: "#DCDCDC", text: "#5D5D5D", label: "Closed" },
};

const filterOptions = ["All", ...Object.keys(statusConfig)];

const focusLogsInViewer = async (logs, setSliceElementsByQuery) => {
  if (!logs || !logs.length) return;

  const elementIds = logs
    .map((log) => log["Equipment Id"])
    .filter((id) => id !== undefined && id !== null);
  if (!elementIds.length) return;

  const extraIds = ["PMP-01", "PMP-02", "PMP-03", "PMP-04"];
  const allElementIds = [...elementIds, ...extraIds];

  await setSliceElementsByQuery([
    {
      propRef: { property: { propertyType: "instance" } },
      queryPartial: { "properties.Mark.id": 12032 },
      // queryPartial: { 'properties.Mark.val': '39' }
      // queryPartial: { 'properties.Mark.val': { $in: allElementIds } }
    },
  ]);
};

export default function EngineeringChangesTab({ data, loading }) {
  const classes = useStyles();
  const { setSliceElementsByQuery, sliceElements } = useContext(ModelContext);

  const [filter, setFilter] = useState("All");
  const [expanded, setExpanded] = useState({});
  const [activeCardId, setActiveCardId] = useState(null);
  const [clickedCardIndex, setClickedCardIndex] = useState(null);
  const [ecsData, setEcsData] = useState(null);

  const handleExpandClick = (id) =>
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  const mapService = useContext(MapMachineContext);

  const handleCardClick = async (ec, index) => {
    setExpanded({});

    if (activeCardId === index) {
      setClickedCardIndex(null);
      setActiveCardId(null);
      await setSliceElementsByQuery([]);
      return;
    }

    if (!ec.logs) {
      setClickedCardIndex(null);
      return;
    }

    const ecLogs = Array.isArray(ec.logs) ? ec.logs : Object.values(ec.logs);
    setClickedCardIndex(index);
    await focusLogsInViewer(ecLogs, setSliceElementsByQuery);
  };

  useEffect(() => {
    if (sliceElements && sliceElements.length > 0) {
      setActiveCardId(clickedCardIndex);
    } else {
      setActiveCardId(null);
    }
  }, [sliceElements, clickedCardIndex]);

  const filterByLabel =
    filter === "All" ? "Filter by" : `Filter by (${filter})`;

  const filteredData =
    !data || data.length === 0
      ? []
      : filter === "All"
        ? data.filter((ec) => ec.logs && ec.logs.length > 0)
        : data.filter((ec) => {
            if (!ec.status || !ec.logs || ec.logs.length === 0) return false;
            switch (filter) {
              case "APPROVED":
                return ec.status.APPROVED > 0;
              case "CLOSED":
                return ec.status.CLOSED > 0;
              case "REGISTERED":
                return ec.status.REGISTERED > 0;
              default:
                return true;
            }
          });

  const formatFieldName = (name) => name.replace(/([a-z])([A-Z])/g, "$1 $2");

  return (
    <Box>
      <Box className={classes.filterBox}>
        <FormControl className={classes.formControl}>
          <Select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            displayEmpty
            disableUnderline
            renderValue={() => (
              <div className={classes.renderValue}>
                <span>{filterByLabel}</span>
                <KeyboardArrowDownIcon className={classes.arrow} />
              </div>
            )}
          >
            {filterOptions.map((option) => {
              const circleColor =
                option === "All"
                  ? null
                  : {
                      REGISTERED: "#8E11BA",
                      APPROVED: "#1A8817",
                      CLOSED: "#5D5D5D",
                    }[option];

              const displayText =
                option === "All"
                  ? "All"
                  : option[0] + option.slice(1).toLowerCase();

              return (
                <MenuItem key={option} value={option}>
                  <Box display="flex" alignItems="center">
                    {circleColor && (
                      <Box
                        width={10}
                        height={10}
                        borderRadius="50%"
                        bgcolor={circleColor}
                        mr={1.5}
                      />
                    )}
                    {displayText}
                  </Box>
                </MenuItem>
              );
            })}
          </Select>
        </FormControl>
      </Box>

      {loading ? (
        <Box display="flex" justifyContent="center" alignItems="center" py={6}>
          <CircularProgress />
        </Box>
      ) : filteredData.length === 0 ? (
        // Empty State
        <Box
          display="flex"
          flexDirection="column"
          alignItems="center"
          justifyContent="center"
          py={6}
        >
          <Typography variant="h6" color="textSecondary" gutterBottom>
            Sorry, there are no engineering changes to show.
          </Typography>
          <Typography variant="body2" color="textSecondary">
            Try selecting a different filter or building.
          </Typography>
        </Box>
      ) : (
        filteredData.map((ec, index) => {
          if (activeCardId !== null && activeCardId !== index) return null; // hide non-active cards
          const orderedFields = [
            "Base Revision",
            "Equipment Revision",
            "EC Type",
            "EC ID",
            "Date Reviewed",
          ];

          return (
            <Card
              key={index}
              className={`${classes.card} ${activeCardId === index ? classes.activeCard : ""}`}
              onClick={() => handleCardClick(ec, index)}
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
                      handleExpandClick(index);
                    }}
                    size="small"
                  >
                    {expanded[index] ? (
                      <KeyboardArrowUpIcon />
                    ) : (
                      <KeyboardArrowDownIcon />
                    )}
                  </IconButton>
                </Box>

                <Typography className={classes.title}>
                  {ec["EC Title"]}
                </Typography>

                {orderedFields.map((field) => {
                  const value = ec[field] || "-";
                  return (
                    <Typography key={field} className={classes.bodyText}>
                      <strong>{formatFieldName(field)}:</strong> {value}
                    </Typography>
                  );
                })}
              </CardContent>

              <Collapse in={expanded[index]} timeout="auto" unmountOnExit>
                <CardContent>
                  {(() => {
                    let logsArray = [];
                    if (Array.isArray(ec.logs))
                      logsArray = ec.logs.map((log, i) => ({
                        name: log["Equipment Id"] || `Log ${i + 1}`,
                        ...log,
                      }));
                    else if (ec.logs && typeof ec.logs === "object")
                      logsArray = Object.entries(ec.logs).map(
                        ([key, details]) => ({
                          name: details["Equipment Id"] || key,
                          ...details,
                        }),
                      );

                    return logsArray.map((log, logIdx) => (
                      <Box
                        key={logIdx}
                        mb={1}
                        pb={1}
                        borderBottom="1px solid #e0e0e0"
                      >
                        <Typography
                          variant="caption"
                          style={{
                            color: "#777",
                            fontSize: 12,
                            marginBottom: 2,
                          }}
                        >
                          Name id
                        </Typography>
                        <Box
                          display="flex"
                          alignItems="center"
                          justifyContent="space-between"
                        >
                          <Typography className={classes.logName}>
                            {log.name}
                          </Typography>
                          <Chip
                            label={log.status || "Unknown"}
                            className={classes.chipSmall}
                            style={{
                              backgroundColor:
                                statusConfig[log.status]?.bg || "#EBEBEB",
                              color: statusConfig[log.status]?.text || "#000",
                            }}
                            size="small"
                          />
                        </Box>
                      </Box>
                    ));
                  })()}
                </CardContent>
              </Collapse>
            </Card>
          );
        })
      )}
    </Box>
  );
}
