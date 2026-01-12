/**
 * @fileoverview Admin email template management
 * @module admin/admin-email-templates
 */

// ============================================================================
// STATE & CSRF TOKEN
// ============================================================================

let csrfToken = '';

// ============================================================================
// INITIALIZATION
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
    fetchCsrfToken();
    loadTemplate();
    setupEventListeners();
});

// ============================================================================
// CSRF TOKEN
// ============================================================================

async function fetchCsrfToken() {
    try {
        const response = await fetch('/api/csrf-token');
        const data = await response.json();
        csrfToken = data.csrfToken;
    } catch (error) {
        console.error('Error fetching CSRF token:', error);
    }
}

// ============================================================================
// EVENT LISTENERS
// ============================================================================

function setupEventListeners() {
    document.getElementById('saveBtn').addEventListener('click', saveTemplate);
    document.getElementById('previewBtn').addEventListener('click', previewTemplate);
    document.getElementById('closeModal').addEventListener('click', closeModal);
    
    // Close modal on outside click
    document.getElementById('previewModal').addEventListener('click', (e) => {
        if (e.target.id === 'previewModal') {
            closeModal();
        }
    });
}

// ============================================================================
// TEMPLATE LOADING
// ============================================================================

async function loadTemplate() {
    try {
        const response = await fetch('/api/email-templates/registration-confirmation', {
            credentials: 'same-origin'
        });
        
        if (response.ok) {
            const template = await response.json();
            document.getElementById('emailSubject').value = template.subject || '';
            document.getElementById('htmlBody').value = template.htmlBody || '';
            document.getElementById('textBody').value = template.textBody || '';
        } else if (response.status === 404) {
            // Template doesn't exist yet, leave fields empty
            console.log('No template found, using defaults');
        } else {
            showNotification('Failed to load template', 'error');
        }
    } catch (error) {
        console.error('Error loading template:', error);
        showNotification('Error loading template', 'error');
    }
}

// ============================================================================
// TEMPLATE SAVING
// ============================================================================

async function saveTemplate() {
    const subject = document.getElementById('emailSubject').value.trim();
    const htmlBody = document.getElementById('htmlBody').value.trim();
    const textBody = document.getElementById('textBody').value.trim();
    
    if (!subject || !htmlBody || !textBody) {
        showNotification('All fields are required', 'error');
        return;
    }
    
    try {
        const response = await fetch('/api/email-templates/registration-confirmation', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-Token': csrfToken
            },
            credentials: 'same-origin',
            body: JSON.stringify({
                subject,
                htmlBody,
                textBody
            })
        });
        
        if (response.ok) {
            showNotification('Template saved successfully!', 'success');
        } else {
            const error = await response.json();
            showNotification(error.error || 'Failed to save template', 'error');
        }
    } catch (error) {
        console.error('Error saving template:', error);
        showNotification('Error saving template', 'error');
    }
}

// ============================================================================
// TEMPLATE PREVIEW
// ============================================================================

async function previewTemplate() {
    const subject = document.getElementById('emailSubject').value.trim();
    const htmlBody = document.getElementById('htmlBody').value.trim();
    const textBody = document.getElementById('textBody').value.trim();
    
    if (!subject || !htmlBody || !textBody) {
        showNotification('All fields are required for preview', 'error');
        return;
    }
    
    try {
        const response = await fetch('/api/email-templates/preview', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-Token': csrfToken
            },
            credentials: 'same-origin',
            body: JSON.stringify({
                subject,
                htmlBody,
                textBody
            })
        });
        
        if (response.ok) {
            const preview = await response.json();
            
            document.getElementById('previewSubject').textContent = preview.subject;
            document.getElementById('previewHtml').innerHTML = preview.htmlBody;
            document.getElementById('previewText').textContent = preview.textBody;
            
            document.getElementById('previewModal').style.display = 'flex';
        } else {
            showNotification('Failed to generate preview', 'error');
        }
    } catch (error) {
        console.error('Error generating preview:', error);
        showNotification('Error generating preview', 'error');
    }
}

// ============================================================================
// MODAL MANAGEMENT
// ============================================================================

function closeModal() {
    document.getElementById('previewModal').style.display = 'none';
}

// ============================================================================
// NOTIFICATIONS
// ============================================================================

function showNotification(message, type = 'info') {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.className = `notification notification-${type}`;
    notification.style.display = 'block';
    
    setTimeout(() => {
        notification.style.display = 'none';
    }, 5000);
}
