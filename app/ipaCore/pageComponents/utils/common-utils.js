export const formatToIsoString = d => d.toISOString().split(".")[0] + "Z"
export const sum = (a) => a.reduce((c, n) => c+n);
export const mean = (a) => sum(a) / a.length;
export const round = (n, places=2) => !!n ? +(Math.round(n + "e+" + places)  + "e-" + places) : n;

export const makeDateString = (stamp) => {

   const MONTHS = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'June',
      'July',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec'
    ]

   let toDate = new Date(stamp)

   return `${toDate.getDate()} ${MONTHS[toDate.getMonth()]}, ${toDate.getFullYear()}`
}