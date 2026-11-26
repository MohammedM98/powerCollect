import '../css/app.css';
import { createInertiaApp, router } from '@inertiajs/react';
import { I18nProvider } from '@heroui/react';
import { createRoot } from 'react-dom/client';
import FlashNotifications from '@/Components/Layout/FlashNotifications';
import NavigationProgress from '@/Components/Layout/NavigationProgress';
import AppShell from '@/Layouts/AppShell';
import { notify } from '@/lib/notify';

// Pages load ahead of time when a link is hovered. A save can change any
// list or count, so forget those early copies once it finishes.
router.on('finish', (event) => {
    if (event.detail.visit.method !== 'get') {
        router.flushAll();
    }
});

// A visit that never reached the server (no connection, a dropped request)
// would otherwise end silently; say so, and keep the page as it was.
router.on('networkError', (event) => {
    event.preventDefault();
    notify('تعذّر الاتصال بالخادم. تحقق من الاتصال ثم أعد المحاولة.', 'error');
});

createInertiaApp({
    // Each page's code is downloaded only when that page is first opened.
    resolve: (name) => {
        // Forms and modals are imported by their pages, rather than compiled as separate route entries.
        const pages = import.meta.glob(['./Pages/**/*.jsx', '!./Pages/**/*Modal.jsx', '!./Pages/**/*Form.jsx']);
        return pages[`./Pages/${name}.jsx`]();
    },
    // Every page sits in the shell, which stays from one page to the next (Layouts/AppShell.jsx).
    layout: () => AppShell,
    setup({ el, App, props }) {
        // Arabic for every HeroUI part, whatever the browser's own language: its menus, lists and pop-ups open right to left (with Latin digits).
        createRoot(el).render(
            <I18nProvider locale="ar-u-nu-latn-ca-gregory">
                <NavigationProgress />
                <App {...props} />
                <FlashNotifications initialStatus={props.initialPage.props.status} />
            </I18nProvider>,
        );
    },
    // The top bar draws its own loading line (NavigationProgress).
    progress: false,
});
