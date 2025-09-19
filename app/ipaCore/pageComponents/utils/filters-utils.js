export const getChartFilters = (statusId, capacityRange) => {
  return {
    site: {
      op: "and",
      rules: [
        { fn: "statusIn", args: { values: [statusId] } },
        {
          fn: "capacityBetween",
          args: {
            min: capacityRange?.min,
            max: capacityRange?.max,
          },
        },
      ],
    },
  };
};
