import { useBrand } from '@/hooks/useBrand';

/** One quiet line under every page: the year and the product's name. */
export default function AppFooter() {
    const brand = useBrand();

    return (
        <footer className="gl-footer" dir="rtl">
            © <span dir="ltr">{new Date().getFullYear()}</span> {brand.name}، جميع الحقوق محفوظة
        </footer>
    );
}
