export const fmtPrice = (value) =>
  `$${
    value % 1 === 0
      ? value.toFixed(0)
      : value < 1
        ? value.toFixed(3).replace(/0+$/, "")
        : value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "")
  }`;

export const fmtCtx = (value) =>
  value >= 1000000
    ? `${(value / 1000000).toFixed(value % 1000000 ? 2 : 0).replace(/\.?0+$/, "")}M`
    : `${Math.round(value / 1000)}K`;

export const fmtDate = (isoDate) =>
  new Date(`${isoDate}T00:00:00Z`).toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
