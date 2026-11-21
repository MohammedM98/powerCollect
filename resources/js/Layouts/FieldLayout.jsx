import { Avatar, Dropdown, Label } from '@heroui/react';
import { Head, router, usePage } from '@inertiajs/react';
import Icon from '@/Components/Icon';
import ThemeToggle from '@/Components/ThemeToggle';
import { useBrandDocument } from '@/hooks/useBrand';
import { initials } from '@/lib/format';

/** The web manifest that lets the field app be added to a phone's home screen. */
export function FieldManifest() {
    return <link rel="manifest" href="/field/manifest.webmanifest" />;
}

/**
 * The field app's frame, phone first: the company's name and «تطبيق الميدان»,
 * the theme key and the account menu (the full website, signing out), over a
 * single column of content. Every field page sits in it.
 */
export default function FieldLayout({ title, children }) {
    const brand = useBrandDocument();
    const { auth } = usePage().props;
    const user = auth?.user;

    function openAccountItem(key) {
        if (key === 'website') {
            router.visit('/dashboard');
        } else if (key === 'logout') {
            router.post('/field/logout');
        }
    }

    return (
        <div className="fa-app">
            <Head title={title}>
                <FieldManifest />
            </Head>

            <header className="fa-bar">
                <div className="fa-bar-brand">
                    <img src={brand.logos.icon} alt="" className="fa-bar-logo" />
                    <span>
                        <b>{brand.shortName}</b>
                        <small>تطبيق الميدان</small>
                    </span>
                </div>

                <div className="fa-bar-keys">
                    <ThemeToggle />
                    <Dropdown>
                        <Dropdown.Trigger className="fa-account" aria-label={`حساب ${user?.name ?? ''}`}>
                            <Avatar size="sm" className="fa-avatar">
                                <Avatar.Fallback>{initials(user?.name)}</Avatar.Fallback>
                            </Avatar>
                        </Dropdown.Trigger>
                        <Dropdown.Popover className="gl-pop fa-account-pop" placement="bottom start">
                            <div className="fa-account-head">
                                <b>{user?.name}</b>
                                <small>{user?.roleLabel}{user?.branchName ? ` · ${user.branchName}` : ''}</small>
                            </div>
                            <Dropdown.Menu aria-label="الحساب" onAction={(key) => openAccountItem(String(key))}>
                                <Dropdown.Item id="website" textValue="الموقع الكامل">
                                    <Icon name="grid" className="h-4 w-4" />
                                    <Label>الموقع الكامل</Label>
                                </Dropdown.Item>
                                <Dropdown.Item id="logout" textValue="تسجيل الخروج" variant="danger">
                                    <Icon name="logout" className="h-4 w-4" />
                                    <Label>تسجيل الخروج</Label>
                                </Dropdown.Item>
                            </Dropdown.Menu>
                        </Dropdown.Popover>
                    </Dropdown>
                </div>
            </header>

            <main className="fa-main">{children}</main>
        </div>
    );
}
