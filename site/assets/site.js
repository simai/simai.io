// The language menu (a <details> like Docara's): closes on Escape and on a
// click outside, mirrors its state to aria-expanded, and keeps the section
// the reader is on (the #hash) when switching language.
for (const menu of document.querySelectorAll('[data-lang-menu]')) {
  const trigger = menu.querySelector('summary');
  const sync = () => trigger.setAttribute('aria-expanded', String(menu.open));
  menu.addEventListener('toggle', sync);
  menu.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && menu.open) {
      menu.open = false;
      trigger.focus();
    }
  });
  document.addEventListener('click', (event) => {
    if (menu.open && !menu.contains(event.target)) menu.open = false;
  });
  for (const option of menu.querySelectorAll('a[hreflang]')) {
    option.addEventListener('click', () => {
      if (location.hash) option.hash = location.hash;
    });
  }
  sync();
}

// The Framework reveals the page after its first components load, so the
// browser's own jump to #section can land before the layout settles. Jump
// again once the page has loaded.
const jump = () => {
  const target = location.hash.length > 1 ? document.getElementById(decodeURIComponent(location.hash.slice(1))) : null;
  // Instant: the Framework sets smooth scrolling, which a load jump does not need.
  if (target) target.scrollIntoView({block: 'start', behavior: 'instant'});
};
// setTimeout, not requestAnimationFrame: a tab opened in the background runs
// no frames until it is shown.
if (document.readyState === 'complete') setTimeout(jump, 0);
else window.addEventListener('load', () => setTimeout(jump, 0), {once: true});
