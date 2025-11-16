(function () {
    const btn = document.querySelector('.hamburger');
    const menu = document.getElementById('mobileMenu');
    if (!btn || !menu) return;

    // Ensure menu starts hidden and aria state is correct
    menu.hidden = true;
    btn.classList.remove('is-open');
    btn.setAttribute('aria-expanded', 'false');

    const toggle = (open) => {
        // If `open` explicitly provided, use it. Otherwise toggle based on current hidden state.
        // Use menu.hidden so that when hidden=true (menu closed) toggle() opens it (isOpen=true).
        const isOpen = open !== undefined ? Boolean(open) : menu.hidden;
        btn.classList.toggle('is-open', isOpen);
        btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        menu.hidden = !isOpen;
        // only lock body scroll when the panel is open and covers much of the viewport
        document.body.style.overflow = isOpen ? 'hidden' : '';
    };

    btn.addEventListener('click', (e) => { e.stopPropagation(); toggle(); });

    // Close on link click
    menu.querySelectorAll('a').forEach(a =>
        a.addEventListener('click', () => toggle(false))
    );

    // Close on ESC or outside click
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') toggle(false);
    });

    document.addEventListener('click', e => {
        if (!menu.hidden && !menu.contains(e.target) && !btn.contains(e.target)) {
            toggle(false);
        }
    });
})();