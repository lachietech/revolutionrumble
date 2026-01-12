import express from 'express';
import EmailTemplate from '../models/EmailTemplate.js';
import { sanitizeString } from '../middleware/validation.js';

const router = express.Router();

/**
 * GET /api/email-templates
 * Get all email templates
 */
router.get('/email-templates', async (req, res) => {
    try {
        const templates = await EmailTemplate.find();
        res.json(templates);
    } catch (error) {
        console.error('Error fetching email templates:', error);
        res.status(500).json({ error: 'Failed to fetch email templates' });
    }
});

/**
 * GET /api/email-templates/:name
 * Get a specific email template by name
 */
router.get('/email-templates/:name', async (req, res) => {
    try {
        const template = await EmailTemplate.findOne({ name: req.params.name });
        if (!template) {
            return res.status(404).json({ error: 'Template not found' });
        }
        res.json(template);
    } catch (error) {
        console.error('Error fetching email template:', error);
        res.status(500).json({ error: 'Failed to fetch email template' });
    }
});

/**
 * PUT /api/email-templates/:name
 * Update an email template
 */
router.put('/email-templates/:name', async (req, res) => {
    try {
        const { subject, htmlBody, textBody } = req.body;
        
        // Validate inputs
        if (!subject || !htmlBody || !textBody) {
            return res.status(400).json({ error: 'Subject, HTML body, and text body are required' });
        }
        
        // Sanitize inputs (basic length limits)
        const sanitizedSubject = sanitizeString(subject, 200);
        const sanitizedHtmlBody = sanitizeString(htmlBody, 50000);
        const sanitizedTextBody = sanitizeString(textBody, 50000);
        
        // Find and update template
        let template = await EmailTemplate.findOne({ name: req.params.name });
        
        if (!template) {
            // Create new template if it doesn't exist
            template = await EmailTemplate.create({
                name: req.params.name,
                subject: sanitizedSubject,
                htmlBody: sanitizedHtmlBody,
                textBody: sanitizedTextBody
            });
        } else {
            template.subject = sanitizedSubject;
            template.htmlBody = sanitizedHtmlBody;
            template.textBody = sanitizedTextBody;
            await template.save();
        }
        
        res.json(template);
    } catch (error) {
        console.error('Error updating email template:', error);
        res.status(500).json({ error: 'Failed to update email template' });
    }
});

/**
 * POST /api/email-templates/preview
 * Preview an email template with sample data
 */
router.post('/email-templates/preview', async (req, res) => {
    try {
        const { subject, htmlBody, textBody } = req.body;
        
        // Sample data for preview
        const sampleData = {
            bowlerName: 'John Smith',
            tournamentName: 'Logan City Cup 2026',
            tournamentLocation: 'Logan City Bowl',
            tournamentDate: 'Saturday, 15 February 2026',
            entryFee: '120',
            squadsList: 'Squad A (Saturday 9:00 AM), Squad B (Saturday 2:00 PM)',
            paymentInstructions: 'Please transfer payment to BSB: 123-456 Account: 12345678. Reference: Your name and registration ID.',
            registrationId: 'REG123456'
        };
        
        // Replace variables
        const replaceVariables = (template, data) => {
            return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
                return data[key] !== undefined ? data[key] : match;
            });
        };
        
        const previewSubject = replaceVariables(subject, sampleData);
        const previewHtml = replaceVariables(htmlBody, sampleData);
        const previewText = replaceVariables(textBody, sampleData);
        
        res.json({
            subject: previewSubject,
            htmlBody: previewHtml,
            textBody: previewText
        });
    } catch (error) {
        console.error('Error generating preview:', error);
        res.status(500).json({ error: 'Failed to generate preview' });
    }
});

export default router;
