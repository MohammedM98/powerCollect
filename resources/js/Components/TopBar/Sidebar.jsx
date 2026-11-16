import { useEffect, useRef, useState } from 'react';
import { Link } from '@inertiajs/react';
import BrandLogo from '@/Components/BrandLogo';
import Icon from '@/Components/Icon';
import { groupLandingLink, HOME_LINK, sectionLinks, shouldPrefetchPage } from '@/lib/navigation';
import { LogoutForm } from './AccountMenu';

let entered = false;

function sidebarItems(groups, lastPages) {
    return [
        { ...HOME_LINK, id: 'home' },
        ...groups.map((group) => ({
            ...group,
            href: groupLandingLink(group, lastPages[group.id]).href,
            pages: sectionLinks(group),
        })),
    ];
}

export function SidebarLinks({ groups, currentId, lastPages, badges, onNavigate, showTips = false }) {
    const navRef = useRef(null);
    const glideRef = useRef(null);

    function placeHighlight(link = navRef.current?.querySelector('[aria-current]')) {
        const highlight = glideRef.current;
        if (highlight) {
            highlight.style.opacity = link ? '1' : '0';
            if (link && navRef.current) {
                const nav = navRef.current;
                const offset = link.getBoundingClientRect().top - nav.getBoundingClientRect().top + nav.scrollTop;
                highlight.style.transform = 'translateY(' + offset + 'px)';
            }
        }
    }

    const items = sidebarItems(groups, lastPages);
    return (
        <nav
            aria-label="أقسام النظام"
            className="gl-sidebar-links"
            ref={navRef}
            data-tour="sections"
            onPointerLeave={() => placeHighlight()}
        >
            <span className="gl-sidebar-glide" ref={glideRef} aria-hidden="true" />
            {items.map((item, index) => {
                const current = item.id === currentId;
                const count = item.pages?.reduce((sum, link) => sum + (badges[link.href] ?? 0), 0) ?? 0;
                return (
                    <div key={item.id} className="gl-sidebar-entry" style={{ '--i': index }}>
                        <Link
                            href={item.href}
                            className="gl-sidebar-link"
                            aria-label={item.label}
                            data-section-index={index}
                            data-tour={current ? 'current' : undefined}
                            aria-current={current ? (item.id === 'home' ? 'page' : 'true') : undefined}
                            onPointerEnter={(event) => placeHighlight(event.currentTarget)}
                            prefetch={shouldPrefetchPage(item.href) || undefined}
                            onClick={onNavigate}
                        >
                            <Icon name={item.icon} className="h-[21px] w-[21px] shrink-0" />
                            <span className="gl-sidebar-label">{item.label}</span>
                            {count > 0 && <span className="tn-badge" dir="ltr">{count}</span>}
                        </Link>
                        {showTips && item.pages && <div className="gl-sidebar-tip">
                            <b>{item.label}</b>
                            {item.pages.map((link) => <Link key={link.href} href={link.href}>{link.label}</Link>)}
                        </div>}
                    </div>
                );
            })}
        </nav>
    );
}

export function SidebarBrand({ brand, onNavigate }) {
    return (
        <Link href={HOME_LINK.href} className="gl-sidebar-brand" onClick={onNavigate} data-tour="brand" aria-label={brand.name + '، الصفحة الرئيسية'}>
            <BrandLogo alt="" markSize={48} className="w-12 shrink-0 object-contain" />
            <span className="gl-sidebar-identity">
                <b>{brand.name}</b>
                {brand.tagline && <small>{brand.tagline}</small>}
            </span>
        </Link>
    );
}

export function SidebarFooter({ onHelp }) {
    return (
        <footer className="gl-sidebar-footer">
            <p className="gl-sidebar-online"><i aria-hidden="true" /><span className="gl-sidebar-label">جلسة نشطة</span></p>
            <button type="button" className="gl-sidebar-link" onClick={onHelp} aria-label="مركز المساعدة">
                <Icon name="info" className="h-5 w-5 shrink-0" /><span className="gl-sidebar-label">مركز المساعدة</span>
            </button>
            <LogoutForm>
                <button type="submit" className="gl-sidebar-link gl-sidebar-logout" aria-label="تسجيل الخروج">
                    <Icon name="logout" className="h-5 w-5 shrink-0" /><span className="gl-sidebar-label">تسجيل الخروج</span>
                </button>
            </LogoutForm>
        </footer>
    );
}

export default function Sidebar({ brand, collapsed, onCollapse, onHelp, ...navigation }) {
    const [animate] = useState(() => !entered);
    useEffect(() => { entered = true; }, []);

    return (
        <aside className="gl-sidebar hidden min-[900px]:flex" data-entering={animate || undefined} aria-label="الشريط الجانبي">
            <SidebarBrand brand={brand} />
            <SidebarLinks showTips={collapsed} {...navigation} />
            <SidebarFooter onHelp={onHelp} />
            <button type="button" className="gl-sidebar-collapse" onClick={onCollapse} aria-label={collapsed ? 'توسيع الشريط الجانبي' : 'طي الشريط الجانبي'} aria-expanded={!collapsed}>
                <Icon name={collapsed ? 'chevron-left' : 'chevron-right'} className="h-4 w-4" />
            </button>
        </aside>
    );
}
