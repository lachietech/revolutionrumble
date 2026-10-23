// Isolated Edge smoke check. Uses fixture data and never loads .env or sends mail.
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import session from 'express-session';
import { createApp } from '../backend/app.js';
import Tournament from '../backend/models/Tournament.js';
import Registration from '../backend/models/Registration.js';
import Bowler from '../backend/models/Bowler.js';
import EmailTemplate from '../backend/models/EmailTemplate.js';
import * as limiters from '../backend/middleware/ratelimiters.js';

const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const fixture = new Tournament({
    name: 'Audit Test Tournament', location: 'Test Centre', description: 'Fixture event',
    startDate: '2099-01-01', endDate: '2099-01-01', status: 'upcoming',
    entryFee: 25, squads: [], format: { hasStages: false, gamesPerBowler: 3 }
});
function query(value) {
    const result = { then: (resolve, reject) => Promise.resolve(value).then(resolve, reject) };
    for (const method of ['sort', 'select', 'populate', 'lean']) result[method] = () => result;
    return result;
}
Tournament.find = () => query([fixture]);
Tournament.findById = () => query(fixture);
Registration.find = () => query([]);
Registration.countDocuments = async () => 0;
Bowler.find = () => query([]);
EmailTemplate.findOne = async () => ({ subject: 'Test', htmlBody: '<p>Test</p>', textBody: 'Test' });
process.env.ADMIN_EMAILS = 'admin@example.com';
const store = new session.MemoryStore();
const server = createApp({ store, sessionSecret: 'browser-test-only-secret-at-least-32-characters' }).listen(0, '127.0.0.1');
await new Promise(resolve => server.once('listening', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const profile = await mkdtemp(path.join(tmpdir(), 'rumble-audit-'));
let browser, socket;
try {
    const browserPath = process.env.EDGE_PATH || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
    browser = spawn(browserPath, ['--headless=new', '--disable-gpu', '--no-first-run', '--disable-background-networking', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
    let launchError;
    browser.on('error', error => { launchError = error; });
    let debugPort;
    for (let attempt = 0; attempt < 100; attempt++) {
        if (launchError) throw launchError;
        try { debugPort = (await readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; break; }
        catch { await pause(100); }
    }
    if (!debugPort) throw new Error('Browser did not start within 10 seconds');
    const targets = await (await fetch(`http://127.0.0.1:${debugPort}/json`)).json();
    socket = new WebSocket(targets.find(target => target.type === 'page').webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
    let sequence = 0;
    const pending = new Map();
    let errors = [];
    socket.onmessage = event => {
        const message = JSON.parse(event.data);
        if (message.id) {
            const operation = pending.get(message.id);
            pending.delete(message.id);
            if (message.error) operation?.reject(new Error(message.error.message));
            else operation?.resolve(message.result);
        }
        if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
        if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') errors.push(message.params.args.map(arg => arg.value || arg.description).join(' '));
        if (message.method === 'Network.responseReceived' && message.params.response.url.startsWith(base) && message.params.response.status >= 400) errors.push(`${message.params.response.status} ${message.params.response.url}`);
    };
    function cdp(method, params = {}) {
        return new Promise((resolve, reject) => {
            const commandId = ++sequence;
            const timer = setTimeout(() => { pending.delete(commandId); reject(new Error(`Timed out: ${method}`)); }, 10000);
            pending.set(commandId, { resolve: result => { clearTimeout(timer); resolve(result); }, reject: error => { clearTimeout(timer); reject(error); } });
            socket.send(JSON.stringify({ id: commandId, method, params }));
        });
    }
    await cdp('Page.enable');
    await cdp('Runtime.enable');
    await cdp('Network.enable');
    const tokenResponse = await fetch(base + '/api/csrf-token');
    const cookie = tokenResponse.headers.get('set-cookie').split(';')[0];
    const cookieValue = cookie.slice(cookie.indexOf('=') + 1);
    const sid = decodeURIComponent(cookieValue).slice(2).split('.')[0];
    const stored = await new Promise(resolve => store.get(sid, (_, value) => resolve(value)));
    await new Promise(resolve => store.set(sid, { ...stored, isAdmin: true }, resolve));
    await cdp('Network.setCookie', { name: 'connect.sid', value: cookieValue, url: base, httpOnly: true });
    const pages = ['/', '/events', '/register', '/player-stats', '/bowler-hub', '/squads', '/results', '/admin/login', '/admin/tournaments', '/admin/registrations', '/admin/results', '/admin/email-templates'];
    let failures = 0;
    for (const page of pages) {
        for (const limiter of Object.values(limiters)) limiter.resetKey('127.0.0.1');
        errors = [];
        await cdp('Page.navigate', { url: base + page });
        await pause(1000);
        const state = await cdp('Runtime.evaluate', { expression: 'document.readyState', returnByValue: true });
        if (state.result.value !== 'complete') errors.push('Page did not finish loading');
        if (page === '/admin/tournaments') {
            const stageCheck = await cdp('Runtime.evaluate', {
                expression: `(() => {
                    for (const type of ['qualifying', 'round_robin', 'tri_matchplay', 'elimination', 'stepladder']) {
                        resetStageBuilder();
                        document.getElementById('stageType').value = type;
                        syncStageTypeFields();
                        const stage = buildStageFromInputs();
                        if (stage.type !== type) throw new Error('Stage builder type mismatch');
                        currentStages = [stage];
                        renderCustomStagesList();
                        editCustomStage(0);
                    }
                    return true;
                })()`, returnByValue: true
            });
            if (stageCheck.exceptionDetails) errors.push(stageCheck.exceptionDetails.exception?.description || 'Stage builder failed');
        }
        if (errors.length) { failures++; console.error(`FAIL ${page}: ${errors.join('\n')}`); }
        else console.log(`PASS ${page}`);
    }
    if (failures) process.exitCode = 1;
    else console.log(`Browser smoke check passed for ${pages.length} pages with fixture data.`);
} finally {
    socket?.close();
    browser?.kill();
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    // Delete only this run's newly created temporary browser profile.
    if (path.dirname(profile) === path.resolve(tmpdir()) && path.basename(profile).startsWith('rumble-audit-')) {
        await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }).catch(() => {});
    }
}
