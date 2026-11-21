import { Button } from '@heroui/react';
import { useState } from 'react';
import Icon from '@/Components/UI/Icon';
import { formatMoney } from '@/lib/format';
import SplitPaymentDetails from './SplitPaymentDetails';

/**
 * Marks a payment that is one part of a split bank transfer, beside its
 * reference; it opens the transfer's details. `split` is `{ id, total }`.
 */
export default function SplitPaymentBadge({ split, compact = false, className = '' }) {
    const [open, setOpen] = useState(false);

    if (!split) {
        return null;
    }

    return (
        <>
            <Button data-raw="" variant="ghost"
                onClick={(event) => {
                    // A row that opens on click must not open under the badge's own click.
                    event.stopPropagation();
                    setOpen(true);
                }}
                title={`جزء من تحويل واحد بإجمالي ${formatMoney(split.total)} ₪ وُزّع على عدة مشتركين — اضغط لعرض أجزائه`}
                className={`inline-flex max-w-full items-center gap-1 whitespace-nowrap rounded-full border border-violet-500/30 bg-violet-500/10 py-1 text-violet-700 transition hover:bg-violet-500/15 focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900 dark:text-violet-300 ${compact ? 'px-2 text-[12px] font-medium leading-4' : 'px-2 text-xs font-bold'} ${className}`}
            >
                <Icon name="layers" className="h-3! w-3!" />
                <span className="min-w-0 truncate">دفعة مقسّمة{!compact && <>، {formatMoney(split.total)} ₪</>}</span>
            </Button>
            {open && <SplitPaymentDetails id={split.id} onClose={() => setOpen(false)} />}
        </>
    );
}
