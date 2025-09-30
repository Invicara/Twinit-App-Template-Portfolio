export const formatDateOnly = (dateTimeString) => {
  if (!dateTimeString) {
    return "";
  }
  const date = new Date(dateTimeString);
  if (isNaN(date.getTime())) {
    // console.error(`Invalid date format provided: ${dateTimeString}`);
    return "Invalid Date";
  }
  const day = date.getDate().toString().padStart(2, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};
