import DialogFrame from '@/Components/UI/DialogFrame';

/** The distribution's windows: the shared dialog, its keys spread to both ends of the foot. */
export default function DistributionDialog({ title, subtitle, busy, onClose, children, footer }) {
    return (
        <DialogFrame
            show
            onClose={onClose}
            title={title}
            description={subtitle}
            icon="grid"
            maxWidth="4xl"
            busy={busy}
            footer={<div className="flex w-full flex-wrap items-center justify-between gap-3">{footer}</div>}
        >
            {children}
        </DialogFrame>
    );
}
