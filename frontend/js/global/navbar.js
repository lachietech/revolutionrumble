(function () {
    const btn = document.querySelector('.hamburger');
    const menu = document.getElementById('mobileMenu');
    const desktop = document.getElementById('desktopMenu');
    if (!btn || !menu) return;
    // Ensure menu starts hidden and aria state is correct
    menu.hidden = true;
    if (desktop) desktop.hidden = true;
    btn.classList.remove('is-open');
    btn.setAttribute('aria-expanded', 'false');

    const isDesktopView = () => window.innerWidth >= 900;

    const currentOpenState = () => {
        return isDesktopView() ? (desktop && !desktop.hidden) : !menu.hidden;
    };

    const setButtonState = (open) => {
        btn.classList.toggle('is-open', open);
        btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    };

    const toggle = (open) => {
        const wantOpen = open !== undefined ? Boolean(open) : !currentOpenState();
        if (isDesktopView()) {
            if (desktop) desktop.hidden = !wantOpen;
            menu.hidden = true;
        } else {
            menu.hidden = !wantOpen;
            if (desktop) desktop.hidden = true;
        }
        setButtonState(wantOpen);
    };

    btn.addEventListener('click', (e) => { e.stopPropagation(); toggle(); });

    // Close on link click (both menus)
    menu.querySelectorAll('a').forEach(a => a.addEventListener('click', () => toggle(false)));
    if (desktop) desktop.querySelectorAll('a').forEach(a => a.addEventListener('click', () => toggle(false)));

    // Close on ESC
    document.addEventListener('keydown', e => { if (e.key === 'Escape') toggle(false); });

    // Click outside closes the open menu and syncs the button
    document.addEventListener('click', e => {
        if (isDesktopView()) {
            if (desktop && !desktop.hidden && !desktop.contains(e.target) && !btn.contains(e.target)) toggle(false);
        } else {
            if (!menu.hidden && !menu.contains(e.target) && !btn.contains(e.target)) toggle(false);
        }
    });

    // Ensure menus adapt on resize (hide whichever is not appropriate)
    window.addEventListener('resize', () => {
        if (isDesktopView()) {
            // moving to desktop view
            if (!menu.hidden) menu.hidden = true;
        } else {
            if (desktop && !desktop.hidden) desktop.hidden = true;
        }
        // sync button state
        setButtonState(currentOpenState());
    });
})();