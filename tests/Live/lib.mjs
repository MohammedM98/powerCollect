import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { appendFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const baseUrl = process.env.BASE_URL;
export const PASSWORD = 'Strong-Pass-2026';
export const uuid = randomUUID;

/**
 * One person's browser: its cookies, its CSRF token and the Inertia version,
 * so every request goes through the same middleware a real page does.
 */
export class Session {
    constructor(name) {
        this.name = name;
        this.cookies = new Map();
        this.version = null;
        // The page a form is sent from: its redirect back must land on a page this person may open, or the errors are lost.
        this.home = '/profile';
    }

    cookieHeader() {
        return [...this.cookies].map(([key, value]) => `${key}=${value}`).join('; ');
    }

    keep(response) {
        for (const cookie of response.headers.getSetCookie()) {
            const [pair] = cookie.split(';');
            const at = pair.indexOf('=');
            this.cookies.set(pair.slice(0, at), pair.slice(at + 1));
        }
    }

    /** A raw request: no redirects followed, cookies kept. */
    async raw(method, url, { body, headers = {}, json = false, csrf = true } = {}) {
        const send = { Accept: 'text/html, application/xhtml+xml', 'X-Requested-With': 'XMLHttpRequest', ...headers };
        if (this.cookies.size) send.Cookie = this.cookieHeader();
        if (csrf && this.cookies.has('XSRF-TOKEN')) send['X-XSRF-TOKEN'] = decodeURIComponent(this.cookies.get('XSRF-TOKEN'));
        if (body !== undefined) send['Content-Type'] = 'application/json';
        if (json) send.Accept = 'application/json';
        const started = performance.now();
        const response = await fetch(url.startsWith('http') ? url : baseUrl + url, {
            method, headers: send, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual',
        });
        this.keep(response);
        const text = await response.text();
        let data = null;
        try { data = JSON.parse(text); } catch { /* an HTML page */ }

        return { status: response.status, headers: response.headers, text, data, ms: performance.now() - started, location: response.headers.get('location') };
    }

    async signIn(username, password = PASSWORD) {
        const page = await this.raw('GET', '/login');
        this.version = /&quot;version&quot;:&quot;([^&]*)&quot;|"version":"([^"]*)"/.exec(page.text)?.slice(1).find(Boolean) ?? null;
        const response = await this.raw('POST', '/login', { body: { username, password } });
        this.username = username;
        // A refused sign-in is sent back to the form; an accepted one goes on to the dashboard.
        response.signedIn = response.status === 302 && /\/dashboard$/.test(response.location ?? '');

        return response;
    }

    /** An Inertia page visit: the page's props, or the status that refused it. */
    async page(url) {
        let response = await this.raw('GET', url, { headers: { 'X-Inertia': 'true', 'X-Inertia-Version': this.version ?? '' } });
        for (let hops = 0; hops < 5 && [301, 302, 303].includes(response.status); hops++) {
            response = await this.raw('GET', response.location, { headers: { 'X-Inertia': 'true', 'X-Inertia-Version': this.version ?? '' } });
        }

        return { ...response, props: response.data?.props ?? null, component: response.data?.component ?? null };
    }

    /**
     * Submit a form as Inertia does, then follow its redirect to read what
     * the page says: the validation errors, the flash and the props.
     */
    async submit(method, url, body = {}, referer = this.home) {
        const response = await this.raw(method, url, { body, headers: { 'X-Inertia': 'true', 'X-Inertia-Version': this.version ?? '', Referer: baseUrl + referer } });
        let after = null;
        if ([302, 303].includes(response.status) && response.location) {
            after = await this.page(response.location);
        }
        const errors = after?.props?.errors ?? response.data?.props?.errors ?? response.data?.errors ?? {};
        const ok = response.status < 400 && Object.keys(errors).length === 0;

        return { ...response, ok, errors, after, flash: after?.data?.flash ?? after?.props?.flash ?? null };
    }

    post(url, body, referer) { return this.submit('POST', url, body, referer); }

    put(url, body, referer) { return this.submit('PUT', url, body, referer); }

    patch(url, body, referer) { return this.submit('PATCH', url, body, referer); }

    delete(url, body, referer) { return this.submit('DELETE', url, body, referer); }

    /** A JSON helper endpoint (what the pages call with useHttp). */
    json(method, url, body) { return this.raw(method, url, { body, json: true }); }
}

/** The field app: a bearer token, JSON only. */
export class MobileClient {
    constructor(name) {
        this.name = name;
        this.token = null;
    }

    async call(method, url, body, headers = {}) {
        const started = performance.now();
        const response = await fetch(`${baseUrl}/api/mobile/v1${url}`, {
            method, body: body === undefined ? undefined : JSON.stringify(body),
            headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-App-Build': '999', ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}), ...headers },
        });
        const text = await response.text();
        let data = null;
        try { data = JSON.parse(text); } catch { /* not JSON */ }

        return { status: response.status, headers: response.headers, text, data, ms: performance.now() - started };
    }

    async signIn(username, password = PASSWORD) {
        const response = await this.call('POST', '/login', { username, password, device_name: 'live-test' });
        this.token = response.data?.token ?? null;

        return response;
    }
}

/** Run SQL on the live database and return the rows (tab-separated values as objects). */
export function sql(query) {
    const out = execFileSync('mariadb', ['-u', process.env.DB_USERNAME, `-p${process.env.DB_PASSWORD}`, '-h', '127.0.0.1', process.env.DB_DATABASE, '--default-character-set=utf8mb4', '--batch', '--raw', '-e', query], { encoding: 'utf8' });
    const [head, ...lines] = out.trimEnd().split('\n');
    if (!head) return [];
    const columns = head.split('\t');

    return lines.map((line) => Object.fromEntries(line.split('\t').map((value, index) => [columns[index], value === 'NULL' ? null : value])));
}

export const one = (query) => sql(query)[0] ?? null;
export const scalar = (query) => Object.values(one(query) ?? { value: null })[0];

/** Run an artisan command against the live database, at the test clock. */
export function artisan(...args) {
    return execFileSync('php', ['artisan', ...args, '--no-interaction'], { cwd: root, encoding: 'utf8', env: process.env });
}

/** The live clock every request and command reads. */
export const clock = {
    now: null,
    set(iso) {
        this.now = new Date(iso);
        writeFileSync(process.env.LIVE_TEST_CLOCK, this.now.toISOString());
    },
    advance({ days = 0, hours = 0, minutes = 0 }) {
        this.set(new Date(this.now.getTime() + ((days * 24 + hours) * 60 + minutes) * 60000).toISOString());
    },
    date() { return this.now.toISOString().slice(0, 10); },
};

/** Collects every check with its evidence, and writes the run's report. */
export class Report {
    constructor(suite) {
        this.suite = suite;
        this.checks = [];
        this.findings = [];
        this.section = '';
        this.file = process.env.LIVE_TEST_OUT ? path.join(process.env.LIVE_TEST_OUT, `${suite}.jsonl`) : null;
        if (this.file) writeFileSync(this.file, '');
    }

    begin(section) {
        this.section = section;
        console.log(`\n── ${section}`);
    }

    check(name, passed, evidence = '') {
        const entry = { suite: this.suite, section: this.section, name, passed: Boolean(passed), evidence: String(evidence).slice(0, 600) };
        this.checks.push(entry);
        if (this.file) appendFileSync(this.file, `${JSON.stringify(entry)}\n`);
        console.log(`  ${entry.passed ? '✓' : '✗ FAIL'} ${name}${entry.passed && !evidence ? '' : `  [${entry.evidence}]`}`);

        return entry.passed;
    }

    equal(name, actual, expected) {
        return this.check(name, String(actual) === String(expected), `expected ${expected}, got ${actual}`);
    }

    /** A request that must go through. */
    done(name, response) {
        return this.check(name, response.ok ?? response.status < 400, `HTTP ${response.status} ${JSON.stringify(response.errors ?? response.data?.errors ?? response.data?.message ?? '')}`);
    }

    /** A request that must be refused, without a server error. */
    refused(name, response, statuses = null) {
        const refused = statuses ? statuses.includes(response.status) : (response.status >= 400 && response.status < 500) || (response.ok === false && response.status < 400);

        return this.check(name, refused, `HTTP ${response.status} ${JSON.stringify(response.errors ?? response.data?.errors ?? response.data?.message ?? '').slice(0, 300)}`);
    }

    finding(severity, title, detail) {
        this.findings.push({ severity, title, detail });
        console.log(`  ⚑ [${severity}] ${title}: ${detail}`);
    }

    finish() {
        const failed = this.checks.filter((check) => !check.passed);
        console.log(`\n${this.suite}: ${this.checks.length - failed.length}/${this.checks.length} checks passed, ${this.findings.length} findings`);
        if (process.env.LIVE_TEST_OUT) {
            writeFileSync(path.join(process.env.LIVE_TEST_OUT, `${this.suite}.summary.json`), JSON.stringify({ suite: this.suite, total: this.checks.length, failed, findings: this.findings }, null, 2));
        }

        return failed.length;
    }
}

export const cents = (amount) => Math.round(Number(amount) * 100);
export const money = (inCents) => (inCents / 100).toFixed(2);
