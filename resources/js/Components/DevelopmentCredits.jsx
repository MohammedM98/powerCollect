import { useState } from 'react';
import DialogFrame from '@/Components/DialogFrame';
import Icon from '@/Components/Icon';
import maker from '../../brand/maker.json' with { type: 'json' };


/**
 * Who made the application (resources/brand/maker.json): the same on every
 * company's copy, whatever that company's own identity. The button opens
 * the maker's company and the development team.
 */
export default function DevelopmentCredits() {
    const [open, setOpen] = useState(false);

    return <>
        <button type="button" className="af-footer__credits" aria-haspopup="dialog" onClick={() => setOpen(true)}>
            <Icon name="users" className="h-4 w-4" />
            {maker.company.name ? `تطوير ${maker.company.name}` : 'فريق التطوير'}
        </button>
        <DialogFrame show={open} onClose={() => setOpen(false)} title="فريق التطوير" icon="users" maxWidth="md">
            {maker.company.name && <div className="af-team-dialog__maker">
                <b>{maker.company.name}</b>
                {maker.company.nameEnglish && <span dir="ltr">{maker.company.nameEnglish}</span>}
                {maker.company.website && <a href={maker.company.website} target="_blank" rel="noopener noreferrer" dir="ltr">{maker.company.website.replace(/^https?:\/\//, '')}</a>}
                {maker.company.phone && <a href={`tel:${maker.company.phone}`} dir="ltr">{maker.company.phone}</a>}
                {maker.company.email && <a href={`mailto:${maker.company.email}`} dir="ltr">{maker.company.email}</a>}
            </div>}
            <ul className="af-team-dialog__names">
                {maker.team.map((member) => <li key={member.name} className="af-team-dialog__member">
                    <span className="af-team-dialog__name">{member.name}</span>
                    {member.role && <span className="text-sm text-gray-500">{member.role}</span>}
                    {member.phone && <a className="af-team__contact" href={`tel:${member.phone}`} aria-label={`اتصال بـ${member.name}: ${member.phoneLabel}`}>
                        <Icon name="phone" className="h-4 w-4" />
                        <span dir="ltr">{member.phoneLabel}</span>
                    </a>}
                </li>)}
            </ul>
        </DialogFrame>
    </>;
}
