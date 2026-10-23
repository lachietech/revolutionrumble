// Escape text for HTML text and quoted attribute contexts (not JavaScript).
function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, character => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[character]);
}

document.addEventListener('click', async event => {
    const link = event.target.closest('a[href="/admin/logout"]');
    if (!link) return;
    event.preventDefault();
    try {
        const tokenResponse = await fetch('/api/csrf-token');
        const { csrfToken } = await tokenResponse.json();
        if (!tokenResponse.ok || !csrfToken) throw new Error('Unable to sign out');
        const response = await fetch('/admin/logout', {
            method: 'POST', headers: { 'X-CSRF-Token': csrfToken }
        });
        if (!response.ok) throw new Error('Unable to sign out');
        window.location.href = '/';
    } catch {
        alert('Unable to sign out. Please try again.');
    }
});
