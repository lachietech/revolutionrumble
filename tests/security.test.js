import { test, before, after, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import session from 'express-session';
import nodemailer from 'nodemailer';
import { createApp } from '../backend/app.js';
import Bowler from '../backend/models/Bowler.js';
import AdminSession from '../backend/models/AdminSession.js';
import Tournament from '../backend/models/Tournament.js';
import Registration from '../backend/models/Registration.js';
import TournamentResult from '../backend/models/TournamentResult.js';
import EmailTemplate from '../backend/models/EmailTemplate.js';
import SpotReservation from '../backend/models/SpotReservation.js';
import { getResendClient } from '../backend/middleware/resend.js';
import * as limiters from '../backend/middleware/ratelimiters.js';
import { sanitizeEmail, validateInteger, validateObjectIdArray } from '../backend/middleware/validation.js';
import { hashOtp } from '../backend/utils/otp.js';
import { sendRegistrationConfirmation } from '../backend/utils/emailService.js';

const store = new session.MemoryStore();
let server, base;
const id = '507f1f77bcf86cd799439011';
const tournamentId = '507f1f77bcf86cd799439012';
before(async () => {
    process.env.ADMIN_EMAILS = 'admin@example.com';
    process.env.RESEND_API_KEY = 're_test_fixture_only';
    server = createApp({ store, sessionSecret: 'test-only-secret-with-at-least-32-characters' }).listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
    mock.restoreAll();
    await new Promise(resolve => server.close(resolve));
});
beforeEach(() => {
    mock.restoreAll();
    for (const limiter of Object.values(limiters)) limiter.resetKey('127.0.0.1');
});

async function client(auth = {}) {
    const response = await fetch(`${base}/api/csrf-token`);
    const cookie = response.headers.get('set-cookie').split(';')[0];
    const { csrfToken } = await response.json();
    const sid = decodeURIComponent(cookie.split('=')[1]).slice(2).split('.')[0];
    const stored = await new Promise((resolve, reject) => store.get(sid, (err, value) => err ? reject(err) : resolve(value)));
    await new Promise((resolve, reject) => store.set(sid, { ...stored, ...auth }, err => err ? reject(err) : resolve()));
    return { cookie, csrfToken, sid };
}
function request(url, user, body, method = 'POST') {
    return fetch(base + url, {
        method, redirect: 'manual',
        headers: { 'Content-Type': 'application/json', Cookie: user.cookie, 'X-CSRF-Token': user.csrfToken },
        ...(body === undefined ? {} : { body: JSON.stringify(body) })
    });
}

test('public pages and their local script/style/image references load', async () => {
    const admin = await client({ isAdmin: true });
    const pages = ['/', '/register', '/player-stats', '/bowler-hub', '/events', '/squads', '/results', '/admin/login', '/admin/tournaments', '/admin/registrations', '/admin/results', '/admin/email-templates'];
    const assets = new Set();
    for (const page of pages) {
        const response = await fetch(base + page, { headers: { Cookie: admin.cookie } });
        assert.equal(response.status, 200, page);
        assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
        const html = await response.text();
        for (const match of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
            if (/\.(?:js|css|png|jpg|svg|mp4)(?:\?|$)/i.test(match[1]) && !match[1].startsWith('http')) assets.add(new URL(match[1], base + page).href);
        }
    }
    for (const asset of assets) {
        const response = await fetch(asset, { method: 'HEAD' });
        assert.equal(response.status, 200, asset);
    }
});

test('private APIs and admin HTML aliases deny anonymous access', async () => {
    const user = await client();
    for (const url of ['/api/registrations', '/api/email-templates']) {
        const response = await request(url, user, undefined, 'GET');
        assert.equal(response.status, 403, url);
        assert.match(response.headers.get('content-type'), /json/);
        assert.equal(response.headers.get('cache-control'), 'no-store');
    }
    for (const url of ['/admin/tournaments', '/admin-tournaments.html', '/admin/admin-email-templates.html', '/%61dmin-tournaments.html']) {
        const response = await request(url, user, undefined, 'GET');
        assert.equal(response.status, 302, url);
        assert.equal(response.headers.get('location'), '/admin/login');
    }
});

test('all login endpoints reject requests without a CSRF token', async () => {
    for (const url of ['/admin/request-otp', '/admin/verify-otp', '/api/bowlers/request-otp', '/api/bowlers/verify-otp']) {
        const response = await fetch(base + url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
        assert.equal(response.status, 403, url);
    }
});

test('malformed JSON and oversized requests return client errors', async () => {
    for (const [body, status] of [['{', 400], [JSON.stringify({ text: 'x'.repeat(1024 * 1024) }), 413]]) {
        const response = await fetch(base + '/api/registrations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
        assert.equal(response.status, status);
    }
});

test('strict validation rejects operator objects, malformed email and truncated numbers', () => {
    for (const email of [{ $ne: null }, 'a@b@c.com', 'a\r@b.com', 'a<b>@example.com']) assert.equal(sanitizeEmail(email), null);
    assert.equal(sanitizeEmail(' Person@Example.com '), 'person@example.com');
    assert.equal(sanitizeEmail('a$b@example.com'), 'a$b@example.com');
    for (const value of ['23junk', '2.4', [], {}, true, null, '']) assert.equal(validateInteger(value), null);
    assert.equal(validateInteger('0'), 0);
    assert.deepEqual(validateObjectIdArray([id, id.toUpperCase()]), [id]);
});

test('first-time bowler OTP record validates and provider failures are not reported as success', async () => {
    mock.method(console, 'error', () => {});
    await new Bowler({ email: 'new@example.com', playerName: '' }).validate();
    mock.method(Bowler, 'findOne', async () => null);
    mock.method(Bowler.prototype, 'save', async function () { await this.validate(); return this; });
    mock.method(getResendClient().emails, 'send', async () => ({ error: { message: 'test delivery failure' } }));
    const response = await request('/api/bowlers/request-otp', await client(), { email: 'new@example.com' });
    assert.equal(response.status, 500);
});

test('admin OTP validates types before querying and rotates sessions on success', async () => {
    const user = await client();
    for (const body of [{ emailIndex: 'constructor', otp: '123456' }, { emailIndex: 0, otp: {} }]) {
        assert.equal((await request('/admin/verify-otp', user, body)).status, 400);
    }
    mock.method(AdminSession, 'findOneAndUpdate', async () => ({ _id: id, otpCode: hashOtp('123456'), otpAttempts: 1 }));
    mock.method(AdminSession, 'findOneAndDelete', async () => ({ _id: id }));
    const response = await request('/admin/verify-otp', user, { emailIndex: 0, otp: '123456' });
    assert.equal(response.status, 200);
    assert.notEqual(response.headers.get('set-cookie').split(';')[0], user.cookie);
    assert.equal((await request('/api/registrations', user, undefined, 'GET')).status, 403);
});

test('concurrent bowler OTP reuse permits one login and returns a usable new CSRF token', async () => {
    const user = await client();
    let consumed = false;
    mock.method(Bowler, 'findOneAndUpdate', async (filter) => {
        if (filter.email) return { _id: id, email: 'bowler@example.com', otpCode: hashOtp('123456'), otpAttempts: 1 };
        if (consumed) return null;
        consumed = true;
        return { _id: id };
    });
    const responses = await Promise.all([1, 2].map(() => request('/api/bowlers/verify-otp', user, { email: 'bowler@example.com', otp: '123456' })));
    assert.deepEqual(responses.map(r => r.status).sort(), [200, 400]);
    const success = responses.find(r => r.status === 200);
    const data = await success.json();
    const cookie = success.headers.get('set-cookie').split(';')[0];
    assert.notEqual(cookie, user.cookie);
    assert.equal((await request('/api/bowlers/logout', { cookie, csrfToken: data.csrfToken }, {})).status, 200);
});

test('OTP attempt exhaustion rejects even the correct code', async () => {
    mock.method(Bowler, 'findOneAndUpdate', async () => null);
    const response = await request('/api/bowlers/verify-otp', await client(), { email: 'bowler@example.com', otp: '123456' });
    assert.equal(response.status, 400);
});

test('guest registration cannot replace an existing bowler profile', async () => {
    const bowler = new Bowler({ _id: id, email: 'owner@example.com', playerName: 'Original Name', phone: '0400000000' });
    mock.method(Bowler, 'findOne', async () => bowler);
    mock.method(Bowler.prototype, 'save', async function () { return this; });
    mock.method(Tournament, 'findById', async () => ({ _id: tournamentId, status: 'upcoming', squads: [], name: 'Test', startDate: new Date() }));
    mock.method(Registration, 'findOne', async () => null);
    mock.method(Registration.prototype, 'save', async function () { return this; });
    mock.method(Registration, 'findById', () => ({ populate: () => ({ populate: async () => ({ _id: id }) }) }));
    mock.method(EmailTemplate, 'findOne', async () => ({ subject: 'Test', htmlBody: '{{bowlerName}}', textBody: '{{bowlerName}}' }));
    mock.method(nodemailer, 'createTransport', () => ({ sendMail: async () => ({ messageId: 'test' }) }));
    const response = await request('/api/registrations', await client(), { tournamentId, playerName: 'Attacker Name', email: 'owner@example.com', phone: '0411111111', gender: 'female', assignedSquads: [] });
    assert.equal(response.status, 201);
    assert.equal(bowler.playerName, 'Original Name');
    assert.equal(bowler.phone, '0400000000');
});

test('default confirmation email renders fees and escapes user HTML', async () => {
    let sent;
    mock.method(EmailTemplate, 'findOne', async () => null);
    mock.method(EmailTemplate, 'create', async data => data);
    mock.method(nodemailer, 'createTransport', () => ({ sendMail: async data => { sent = data; return { messageId: 'test' }; } }));
    const result = await sendRegistrationConfirmation({ to: 'test@example.com', bowler: { name: '<img src=x onerror=alert(1)>' }, tournament: { name: 'Test', entryFee: 25, startDate: new Date() }, squads: [], registrationId: id });
    assert.equal(result.success, true);
    assert.match(sent.html, /\$25/);
    assert.ok(!sent.html.includes('<img'));
    assert.ok(sent.html.includes('&lt;img'));
});

test('force-sync leaves other bowlers results in the same tournament untouched', async () => {
    const owner = { _id: id, email: 'owner@example.com', playerName: 'Owner' };
    const otherId = '507f1f77bcf86cd799439099';
    const records = [{ registration: id, tournament: tournamentId, bowler: null }, { registration: otherId, tournament: tournamentId, bowler: otherId }];
    function query(value) {
        return { then: resolve => Promise.resolve(value).then(resolve), select() { return this; }, lean() { return this; }, populate() { return this; } };
    }
    mock.method(Bowler, 'findOne', async () => owner);
    mock.method(Bowler, 'findById', async () => owner);
    mock.method(Bowler, 'findByIdAndUpdate', async () => owner);
    mock.method(Registration, 'updateMany', async () => ({ modifiedCount: 1 }));
    mock.method(Registration, 'find', () => query([{ _id: id, tournament: tournamentId, stageScores: [] }]));
    mock.method(TournamentResult, 'find', () => query([]));
    mock.method(TournamentResult, 'updateMany', async (filter, update) => {
        assert.ok(filter.registration?.$in, 'Result relinking must require a matching registration');
        for (const record of records) if (filter.registration.$in.includes(record.registration)) record.bowler = update.$set.bowler;
        return { modifiedCount: 1 };
    });
    const response = await request('/api/bowlers/force-sync', await client({ isAdmin: true }), { email: owner.email });
    assert.equal(response.status, 200);
    assert.equal(records[0].bowler, id);
    assert.equal(records[1].bowler, otherId);
});

test('reservation access requires the owning browser session', async () => {
    const user = await client();
    for (const method of ['GET', 'DELETE']) assert.equal((await request('/api/reservations/not-your-session', user, undefined, method)).status, 403);
});

test('admin sign-out uses CSRF-protected POST and destroys authentication', async () => {
    const user = await client({ isAdmin: true });
    assert.equal((await request('/admin/logout', user, undefined, 'GET')).status, 404);
    assert.equal((await request('/admin/logout', user, {})).status, 302);
    assert.equal((await request('/api/registrations', user, undefined, 'GET')).status, 403);
});

test('React routes preserve legacy aliases and unknown APIs stay JSON', async () => {
    const user = await client({ isAdmin: true });
    for (const [from, to] of [['/events.html', '/events'], ['/admin-results.html', '/admin/results'], ['/results?tab=stats', '/player-stats']]) {
        const response = await request(from, user, undefined, 'GET');
        assert.equal(response.status, 301);
        assert.equal(response.headers.get('location'), to);
    }
    const missing = await request('/api/does-not-exist', user, undefined, 'GET');
    assert.equal(missing.status, 404);
    assert.match(missing.headers.get('content-type'), /json/);
    assert.equal((await request('/src/App.jsx', user, undefined, 'GET')).status, 404);
    assert.deepEqual(await (await request('/api/admin/session', user, undefined, 'GET')).json(), { authenticated: true });
});

test('score writes preserve zeroes, allow clearing, and reject misaligned bonus arrays', async () => {
    const user = await client({ isAdmin: true });
    const registration = { stageScores: [], save: async () => {}, populate: async () => {} };
    mock.method(Registration, 'findById', async () => registration);
    let response = await request(`/api/registrations/${id}`, user, { stageScores: { stageIndex: 0, scores: [0, 200, 210], bonusPins: [0, 30, 0], handicap: 0 } }, 'PUT');
    assert.equal(response.status, 200);
    assert.deepEqual(registration.stageScores[0].scores, [0, 200, 210]);
    response = await request(`/api/registrations/${id}`, user, { stageScores: { stageIndex: 0, scores: [200], bonusPins: [30, 0] } }, 'PUT');
    assert.equal(response.status, 400);
    response = await request(`/api/registrations/${id}`, user, { stageScores: { stageIndex: 0, scores: [], bonusPins: [] } }, 'PUT');
    assert.equal(response.status, 200);
    assert.deepEqual(registration.stageScores[0].scores, []);
});

test('reservations reject full squads before creating a hold', async () => {
    const user = await client();
    const squadId = '507f1f77bcf86cd799439013';
    const tournament = new Tournament({ _id: tournamentId, name: 'Fixture', location: 'Test', startDate: '2099-01-01', squads: [{ _id: squadId, name: 'A', date: '2099-01-01', time: '09:00', capacity: 2, isQualifying: true }] });
    mock.method(Tournament, 'findById', async () => tournament);
    mock.method(Registration, 'countDocuments', async () => 1);
    mock.method(SpotReservation, 'countDocuments', async () => 1);
    const response = await request('/api/reservations', user, { tournamentId, squads: [squadId] });
    assert.equal(response.status, 409);
    assert.match((await response.json()).error, /full/);
});
