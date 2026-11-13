import Icon from '@/Components/Icon';

/**
 * A long form's index: its sections down the side, the one being read lit,
 * a click scrolling to it. `sections`: [{ id, title, icon }].
 */
export default function FormOutline({ sections, current, onPick }) {
    return (
        <nav className="gl-outline" aria-label="أقسام النموذج">
            {sections.map((section) => (
                <a
                    key={section.id}
                    href={`#${section.id}`}
                    aria-current={section.id === current ? 'true' : undefined}
                    onClick={(event) => {
                        event.preventDefault();
                        onPick(section.id);
                    }}
                >
                    <Icon name={section.icon} className="h-[17px] w-[17px]" />
                    {section.title}
                </a>
            ))}
        </nav>
    );
}
