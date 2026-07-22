const siteNav = document.querySelector('[data-site-nav]');
const menuButton = siteNav?.querySelector('.hamburger');
const mobileMenu = siteNav?.querySelector('#mobileMenu');

const path = window.location.pathname.replace(/\/$/, '') || '/';
const activeNav = path === '/' ? 'home'
    : (path === '/events' || path === '/squads') ? 'events'
    : path === '/results' ? 'results'
    : (path === '/player-stats' || path === '/playerstats' || path === '/bowlerstats') ? 'stats'
    : path === '/register' ? 'registration'
    : path === '/bowler-hub' ? 'portal'
    : '';

if (activeNav) {
    siteNav?.querySelectorAll(`[data-nav="${activeNav}"]`).forEach((link) => link.setAttribute('aria-current', 'page'));
}

if (menuButton && mobileMenu) {
    const setMenuOpen = (open) => {
        mobileMenu.hidden = !open;
        menuButton.classList.toggle('is-open', open);
        menuButton.setAttribute('aria-expanded', String(open));
        menuButton.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
        document.body.classList.toggle('menu-open', open);
    };

    menuButton.addEventListener('click', (event) => {
        event.stopPropagation();
        setMenuOpen(mobileMenu.hidden);
    });
    mobileMenu.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => setMenuOpen(false)));
    window.addEventListener('resize', () => { if (window.innerWidth > 980) setMenuOpen(false); });
    if (window.location.hash === '#mobileMenu') setMenuOpen(true);

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            setMenuOpen(false);
        }
    });
}
