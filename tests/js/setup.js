import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
import { resetInertia } from './inertia.jsx';

vi.mock('@inertiajs/react', async () => import('./inertia.jsx'));

afterEach(() => {
    cleanup();
    resetInertia();
});

// jsdom has no layout: dialogs that scroll fields into view or measure themselves get harmless stand-ins.
window.HTMLElement.prototype.scrollIntoView = () => {};
window.matchMedia ??= () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
window.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
