import { modelByName } from "../lib/catalog.js";
import { fmtPrice, fmtCtx } from "../lib/format.js";

const ROWS = [
  { key: "provider", label: "Provider", value: (m) => m.provider },
  {
    key: "input",
    label: "Input $/1M",
    value: (m) => fmtPrice(m.input),
    raw: (m) => m.input,
    better: "lower",
  },
  {
    key: "output",
    label: "Output $/1M",
    value: (m) => fmtPrice(m.output),
    raw: (m) => m.output,
    better: "lower",
  },
  {
    key: "context",
    label: "Context",
    value: (m) => fmtCtx(m.context),
    raw: (m) => m.context,
    better: "higher",
  },
  { key: "best", label: "Best for", value: (m) => m.tag },
  { key: "released", label: "Released", value: (m) => m.released },
];

function findBestIndex(row, models) {
  if (!row.better) return -1;
  const values = models.map(row.raw);
  const target =
    row.better === "lower" ? Math.min(...values) : Math.max(...values);
  return values.indexOf(target);
}

export function initCompare() {
  const selects = [...document.querySelectorAll("[data-compare-select]")];
  const table = document.getElementById("compare-table");
  if (!table || !selects.length) return;

  const render = () => {
    const picked = selects.map((s) => modelByName.get(s.value)).filter(Boolean);
    if (!picked.length) return;

    const head = `<thead><tr><th>Metric</th>${picked
      .map((model) => `<th>${model.name}</th>`)
      .join("")}</tr></thead>`;

    const body = ROWS.map((row) => {
      const best = findBestIndex(row, picked);
      const cells = picked
        .map(
          (model, index) =>
            `<td class="num num-${row.key}${index === best ? " win" : ""}">${row.value(model)}</td>`
        )
        .join("");
      return `<tr><td class="row-label">${row.label}</td>${cells}</tr>`;
    }).join("");

    table.innerHTML = head + `<tbody>${body}</tbody>`;
  };

  selects.forEach((select) => select.addEventListener("change", render));
  render();
}
