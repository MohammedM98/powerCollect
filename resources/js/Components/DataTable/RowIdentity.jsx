import { Button } from '@heroui/react';
import Icon from '@/Components/Icon';
import { initials } from '@/lib/format';

const DOT_CLASSES = {
    green: 'bg-emerald-500',
    amber: 'bg-amber-500',
    gray: 'bg-gray-400',
};

/**
 * The first cell of a row: a graphite tile (an icon, or the name's
 * initials), the name, and a quiet line under it (beside it in compact
 * rows). `status` adds a small dot on the tile (green, amber or gray).
 * `onNameClick` makes the name a link of its own (`nameTitle` says where
 * it goes), apart from what the rest of the row opens. `wrapName` keeps long
 * labels and their meter numbers visible instead of truncating them.
 */
export default function RowIdentity({ icon, name, subtitle, status, subtitleDir, onNameClick, nameTitle, wrapName = false }) {
    return (
        <div className="flex items-center gap-3">
            <span className="row-identity-avatar gl-avatar relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-display text-[14px] font-extrabold">
                {icon ? <Icon name={icon} className="h-[18px] w-[18px]" /> : initials(name)}
                {status && (
                    <span className={`absolute -bottom-0.5 -inset-s-0.5 h-3 w-3 rounded-full border-[2.5px] border-surface ${DOT_CLASSES[status]}`} />
                )}
            </span>
            <span className="row-identity-text min-w-0">
                {onNameClick ? (
                    <Button data-raw="" variant="ghost"
                        onClick={onNameClick}
                        title={nameTitle}
                        className="block min-h-6 max-w-full truncate text-start font-semibold text-gray-900 underline-offset-4 transition hover:text-brand-600 hover:underline focus-visible:rounded focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900"
                    >
                        {name}
                    </Button>
                ) : (
                    <span className={`block font-semibold text-gray-900 ${wrapName ? 'whitespace-normal' : 'truncate'}`}>{name}</span>
                )}
                {subtitle && (
                    <span className="block truncate text-xs text-gray-400">
                        <span dir={subtitleDir}>{subtitle}</span>
                    </span>
                )}
            </span>
        </div>
    );
}
