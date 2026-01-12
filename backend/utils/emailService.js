import nodemailer from 'nodemailer';
import EmailTemplate from '../models/EmailTemplate.js';

// Create email transporter using Resend
const createTransporter = () => {
    // If using Resend API
    if (process.env.RESEND_API_KEY) {
        return nodemailer.createTransport({
            host: 'smtp.resend.com',
            port: 465,
            secure: true,
            auth: {
                user: 'resend',
                pass: process.env.RESEND_API_KEY
            }
        });
    }
    
    // Fallback to custom SMTP if configured
    return nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: process.env.EMAIL_PORT || 587,
        secure: process.env.EMAIL_SECURE === 'true',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASSWORD
        }
    });
};

/**
 * Replace template variables with actual values
 * @param {string} template - Template string with {{variables}}
 * @param {Object} data - Data object with values to replace
 * @returns {string} Processed template
 */
const replaceVariables = (template, data) => {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
        return data[key] !== undefined ? data[key] : match;
    });
};

/**
 * Send registration confirmation email
 * @param {Object} params - Email parameters
 * @param {string} params.to - Recipient email
 * @param {Object} params.bowler - Bowler information
 * @param {Object} params.tournament - Tournament information
 * @param {Array} params.squads - Selected squads
 * @param {string} params.registrationId - Registration ID
 */
export const sendRegistrationConfirmation = async ({ to, bowler, tournament, squads, registrationId }) => {
    try {
        // Get email template from database
        let template = await EmailTemplate.findOne({ name: 'registration-confirmation' });
        
        // If template doesn't exist, create default one
        if (!template) {
            template = await EmailTemplate.create({
                name: 'registration-confirmation',
                subject: 'Registration Confirmation - {{tournamentName}}',
                htmlBody: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2 style="color: #134b86;">Registration Confirmed!</h2>
                        <p>Hi {{bowlerName}},</p>
                        <p>Thank you for registering for <strong>{{tournamentName}}</strong>.</p>
                        
                        <h3 style="color: #134b86;">Registration Details:</h3>
                        <ul>
                            <li><strong>Tournament:</strong> {{tournamentName}}</li>
                            <li><strong>Location:</strong> {{tournamentLocation}}</li>
                            <li><strong>Date:</strong> {{tournamentDate}}</li>
                            <li><strong>Entry Fee:</strong> ${{entryFee}}</li>
                            <li><strong>Selected Squads:</strong> {{squadsList}}</li>
                        </ul>
                        
                        <h3 style="color: #134b86;">Payment Information:</h3>
                        <p>{{paymentInstructions}}</p>
                        
                        <p>Your registration ID is: <strong>{{registrationId}}</strong></p>
                        
                        <p>If you have any questions, please contact us.</p>
                        
                        <p>Good luck!</p>
                        <p><em>The Revolution Rumble Team</em></p>
                    </div>
                `,
                textBody: `
Registration Confirmed!

Hi {{bowlerName}},

Thank you for registering for {{tournamentName}}.

REGISTRATION DETAILS:
- Tournament: {{tournamentName}}
- Location: {{tournamentLocation}}
- Date: {{tournamentDate}}
- Entry Fee: ${{entryFee}}
- Selected Squads: {{squadsList}}

PAYMENT INFORMATION:
{{paymentInstructions}}

Your registration ID is: {{registrationId}}

If you have any questions, please contact us.

Good luck!
The Revolution Rumble Team
                `
            });
        }
        
        // Prepare template data
        const squadsList = squads.map(s => s.name).join(', ');
        const tournamentDate = new Date(tournament.startDate).toLocaleDateString('en-AU', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        
        const templateData = {
            bowlerName: bowler.name,
            tournamentName: tournament.name,
            tournamentLocation: tournament.location || 'TBA',
            tournamentDate: tournamentDate,
            entryFee: tournament.entryFee || '0',
            squadsList: squadsList,
            paymentInstructions: tournament.paymentInstructions || 'Payment instructions will be provided shortly.',
            registrationId: registrationId
        };
        
        // Replace variables in subject and body
        const subject = replaceVariables(template.subject, templateData);
        const htmlBody = replaceVariables(template.htmlBody, templateData);
        const textBody = replaceVariables(template.textBody, templateData);
        
        // Send email
        const transporter = createTransporter();
        const fromEmail = process.env.FROM_EMAIL || 'noreply@revolutionbowlingsupplies.com';
        const info = await transporter.sendMail({
            from: `"Revolution Rumble" <${fromEmail}>`,
            to: to,
            subject: subject,
            text: textBody,
            html: htmlBody
        });
        
        console.log('✅ Registration confirmation email sent:', info.messageId);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('❌ Error sending registration confirmation email:', error);
        return { success: false, error: error.message };
    }
};
