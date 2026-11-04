import { Link } from '@inertiajs/react';
import { shouldPrefetchPage } from '@/lib/navigation';

/** A figure tile that opens the page it sums up. */
export function TileLink({ href, children }) {
    return (
        <Link
            href={href}
            prefetch={shouldPrefetchPage(href)}
            className="block rounded-panel transition hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900 [&>div]:h-full"
        >
            {children}
        </Link>
    );
}

