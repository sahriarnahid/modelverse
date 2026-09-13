export function initFilters() {
  const chips = document.querySelectorAll("[data-filter]");
  const cards = document.querySelectorAll("[data-tags]");

  chips.forEach((chip) => {
    chip.addEventListener("click", () => {
      chips.forEach((c) => c.classList.toggle("active", c === chip));
      const filter = chip.dataset.filter;

      cards.forEach((card) => {
        const tags = card.dataset.tags.split(" ");
        const visible = filter === "all" || tags.includes(filter);
        card.style.display = visible ? "" : "none";
      });
    });
  });
}
