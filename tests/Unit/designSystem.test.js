import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const root = new URL('../../', import.meta.url);
const design = JSON.parse(readFileSync(new URL('resources/brand/design-system.superpower.json', root), 'utf8'));

/** "Users/Create.jsx, Edit.jsx" → the files it names, each part after the first in the folder of the one before. */
function pageFiles(entry) {
    let folder = '';

    return entry
        .split(',')
        .map((part) => part.trim())
        .filter((part) => part.endsWith('.jsx'))
        .map((part) => {
            if (part.includes('/')) {
                folder = part.slice(0, part.lastIndexOf('/') + 1);

                return part;
            }

            return folder + part;
        })
        .map((file) => (file.startsWith('Layouts/') ? `resources/js/${file}` : `resources/js/Pages/${file}`));
}

test('every component the design system lists with a file exists', () => {
    const listed = design.components.filter((component) => component.file);

    assert.ok(listed.length > 20);
    for (const component of listed) {
        assert.ok(existsSync(new URL(component.file, root)), `${component.name}: ${component.file}`);
    }
});

test('every page the design system maps exists', () => {
    const files = design.pages.flatMap((page) => pageFiles(page.page));

    assert.ok(files.length > 40);
    for (const file of files) {
        assert.ok(existsSync(new URL(file, root)), file);
    }
});

test('the glass stylesheet is loaded and the identity files are where the design system says', () => {
    assert.match(readFileSync(new URL('resources/css/app.css', root), 'utf8'), /@import '\.\/glass\.css';/);
    assert.ok(existsSync(new URL(design.stylesheet.file, root)));
    assert.ok(existsSync(new URL(design.identity.logo, root)));
    assert.ok(existsSync(new URL(design.identity.favicon, root)));
});
