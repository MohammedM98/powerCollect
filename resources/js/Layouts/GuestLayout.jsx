import { useState } from 'react';
import BrandLogo from '@/Components/BrandLogo';
import MaMark from '@/Components/MaMark';
import ThemeToggle from '@/Components/ThemeToggle';
import { useBrandDocument } from '@/hooks/useBrand';

const arc = Array.from({ length: 23 }, (_, index) => -90 + (index * 180) / 22);

function BrandStage({ brand }) {
    const [replay, setReplay] = useState(0);
    const useMaMark = brand.logos.main === '/images/logo-ma.svg';

    return (
        <aside className="gl-auth-stage" aria-label={brand.name}>
            <div className="gl-auth-emblem">
                <div className="gl-auth-arc" key={'arc-' + replay} aria-hidden="true">
                    {arc.map((angle, index) => <i key={angle} style={{ '--angle': angle + 'deg', '--i': index }} />)}
                </div>
                {useMaMark ? (
                    <button type="button" className="gl-auth-replay" onClick={() => setReplay(replay + 1)} aria-label="إعادة حركة الشعار">
                        <MaMark key={replay} size={340} animated />
                    </button>
                ) : (
                    <BrandLogo className="gl-auth-custom-logo" markSize={240} alt={brand.name} />
                )}
                <div className="gl-auth-lockup" key={'name-' + replay}>
                    <strong>{brand.name}</strong>
                    {brand.tagline && <span>{brand.tagline}</span>}
                </div>
            </div>
        </aside>
    );
}

export default function GuestLayout({ title = 'تسجيل الدخول', subtitle = 'ادخل باسم المستخدم الذي أعطاك إياه مدير النظام.', children }) {
    const brand = useBrandDocument();

    return (
        <div className="gl-auth">
            <main className="gl-auth-main">
                <div className="gl-auth-top">
                    <div className="gl-auth-mobile-brand">
                        <span><BrandLogo markSize={26} alt="" className="h-6 w-auto" /></span>
                        <b>منصّة الإدارة الموحّدة</b>
                    </div>
                    <ThemeToggle />
                </div>
                <div className="gl-auth-card">
                    {title && (
                        <header className="gl-auth-head">
                            <h1>{title}</h1>
                            {subtitle && <p>{subtitle}</p>}
                        </header>
                    )}
                    {children}
                </div>
                <footer className="gl-auth-foot">
                    © <span dir="ltr">{new Date().getFullYear()}</span> {brand.name} {brand.tagline}
                </footer>
            </main>
            <BrandStage brand={brand} />
        </div>
    );
}
