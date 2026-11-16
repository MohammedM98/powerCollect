import '../css/app.css';
import { createInertiaApp, router } from '@inertiajs/react';
import { createRoot } from 'react-dom/client';
import FlashNotifications from '@/Components/FlashNotifications';
import NavigationProgress from '@/Components/TopBar/NavigationProgress';
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
    title: (title, page) => {
        const brand = (page.props.brand?.shortName ?? 'العجل والكفارنة').replace(/[&<>]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[character]);
        return title ? title + ' · ' + brand : brand;
    },
    // Each page's code is downloaded only when that page is first opened.
    resolve: (name) => {
        // Forms and modals are imported by their pages, rather than compiled as separate route entries.
        const pages = import.meta.glob(['./Pages/**/*.jsx', '!./Pages/**/*Modal.jsx', '!./Pages/**/*Form.jsx']);
        return pages[`./Pages/${name}.jsx`]();
    },
    setup({ el, App, props }) {
        createRoot(el).render(
            <>
                <NavigationProgress />
                <App {...props} />
                <FlashNotifications initialStatus={props.initialPage.props.status} />
            </>,
        );
    },
    // The top bar draws its own loading line (NavigationProgress).
    progress: false,
});
