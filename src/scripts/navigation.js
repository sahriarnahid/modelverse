export function initNavigation() {
  const header = document.querySelector(".site-header");
  const navToggle = document.querySelector("[data-nav-toggle]");
  const nav = document.querySelector(".site-nav");

  navToggle?.addEventListener("click", () => nav?.classList.toggle("open"));
  nav?.addEventListener("click", (event) => {
    if (event.target instanceof HTMLAnchorElement) nav.classList.remove("open");
  });

  const navLinks = [...document.querySelectorAll(".site-nav a")];
  const navSections = navLinks
    .map((link) => document.querySelector(link.getAttribute("href")))
    .filter(Boolean);

  const onScroll = () => {
    header?.classList.toggle("scrolled", window.scrollY > 8);

    const fromTop = window.scrollY + 120;
    let current = null;
    for (const section of navSections) {
      if (section.offsetTop <= fromTop) current = section.id;
    }

    navLinks.forEach((link) => {
      link.classList.toggle(
        "active",
        link.getAttribute("href") === `#${current}`
      );
    });
  };

  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
}
