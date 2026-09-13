export function initBarChart() {
  const chart = document.querySelector("[data-bar-chart]");
  if (!chart) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const bars = [...chart.querySelectorAll("[data-bar]")];

  const reset = () => {
    bars.forEach((bar) => {
      bar.style.transition = "none";
      bar.style.width = "0%";
    });
    requestAnimationFrame(() => {
      bars.forEach((bar) => {
        bar.style.transition = "";
      });
    });
  };

  const fill = () => {
    bars.forEach((bar) => {
      bar.style.width = `${bar.dataset.target}%`;
    });
  };

  reset();

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) fill();
        else reset();
      });
    },
    { threshold: 0.2 }
  );

  observer.observe(chart);
}
