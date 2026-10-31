import BrandLogo from '@/Components/BrandLogo';
import DevelopmentCredits from '@/Components/DevelopmentCredits';
import { useBrand } from '@/hooks/useBrand';
import maker from '../../brand/maker.json' with { type: 'json' };
import './AppFooter.css';

export default function AppFooter({ compact = false }) {
    const year = new Date().getFullYear();
    const brand = useBrand();

    if (compact) {
        return <footer className="af-login-footer" dir="rtl">
            <p>© <span dir="ltr">{year}</span> {brand.name}</p>
            <DevelopmentCredits />
        </footer>;
    }

    return <footer className="af-footer" dir="rtl">
        <div className="af-footer__inner">
            <div className="af-footer__company">
                <BrandLogo className="af-footer__logo" />
                <div className="af-footer__rights">
                    <p>© <span dir="ltr">{year}</span> جميع الحقوق محفوظة لدى <b>{brand.name}</b></p>
                    {brand.nameEnglish && <p className="af-footer__english" dir="ltr">© {year} {brand.nameEnglish}. All rights reserved.</p>}
                </div>
            </div>
            <DevelopmentCredits />
        </div>
        <p className="af-footer__wordmark" dir="ltr" aria-hidden="true">{maker.product.toUpperCase()}</p>
    </footer>;
}
