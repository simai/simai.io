// The theme switch in the header. The choice is kept per reader; without it
// the page follows the system (the inline script in <head> sets the class
// before the first paint).
const KEY = 'simai-io-theme';
const html = document.documentElement;

const current = () => (html.classList.contains('theme-dark') ? 'dark' : 'light');
const mark = () => {
  for (const button of document.querySelectorAll('[data-site-theme]')) {
    button.setAttribute('aria-pressed', String(button.dataset.siteTheme === current()));
  }
};

document.addEventListener('click', (event) => {
  const button = event.target.closest('[data-site-theme]');
  if (!button) return;
  html.classList.remove('theme-light', 'theme-dark');
  html.classList.add(`theme-${button.dataset.siteTheme}`);
  try { localStorage.setItem(KEY, button.dataset.siteTheme); } catch (error) { /* private mode */ }
  mark();
});

mark();
