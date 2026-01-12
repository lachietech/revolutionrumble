import mongoose from 'mongoose';

const emailTemplateSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
        enum: ['registration-confirmation']
    },
    subject: {
        type: String,
        required: true
    },
    htmlBody: {
        type: String,
        required: true
    },
    textBody: {
        type: String,
        required: true
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Update the updatedAt timestamp before saving
emailTemplateSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

const EmailTemplate = mongoose.model('EmailTemplate', emailTemplateSchema);

export default EmailTemplate;
