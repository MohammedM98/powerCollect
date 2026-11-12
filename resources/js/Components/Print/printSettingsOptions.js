export const FOCUS_RING = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900';

export const ORIENTATIONS = [
    { value: 'portrait', label: 'طولي', icon: 'portrait' },
    { value: 'landscape', label: 'عرضي', icon: 'landscape' },
];

export const DENSITIES = [
    { value: 'compact', label: 'مضغوطة', icon: 'rows-compact' },
    { value: 'normal', label: 'عادية', icon: 'rows-comfortable' },
    { value: 'relaxed', label: 'واسعة', icon: 'list' },
];

export const BORDERS = [
    { value: 'grid', label: 'شبكة كاملة', icon: 'table' },
    { value: 'rows', label: 'خطوط أفقية', icon: 'list' },
    { value: 'none', label: 'بدون خطوط', icon: 'close' },
];

export const DIRECTIONS = [
    { value: 'asc', label: 'تصاعدي', icon: 'arrow-up' },
    { value: 'desc', label: 'تنازلي', icon: 'arrow-down' },
];

export const ALIGNMENTS = [
    { value: 'auto', label: 'تلقائي' },
    { value: 'start', label: 'يمين' },
    { value: 'center', label: 'وسط' },
    { value: 'end', label: 'يسار' },
];

export const GROUP_HEADINGS = [
    { value: 'inline', label: 'سطر واحد' },
    { value: 'stacked', label: 'سطر لكل مستوى' },
];

export const GROUP_ALIGNMENTS = [
    { value: 'start', label: 'يمين' },
    { value: 'center', label: 'وسط' },
];

export const HEADING_SIZES = [
    { value: '', label: 'عادي' },
    { value: '0.9', label: 'أصغر' },
    { value: '1.15', label: 'كبير' },
    { value: '1.35', label: 'أكبر' },
    { value: '1.6', label: 'كبير جدًا' },
];

/** Soft tints a highlighted row or cell can print in, light enough to read through. */
export const HIGHLIGHT_COLORS = [
    { value: '#fde2e1', label: 'أحمر فاتح' },
    { value: '#fdf0c8', label: 'أصفر فاتح' },
    { value: '#dcf5e3', label: 'أخضر فاتح' },
    { value: '#dbe8fd', label: 'أزرق فاتح' },
    { value: '#e9eaee', label: 'رمادي فاتح' },
];

export const PAGE_NUMBER_POSITIONS = [
    { value: 'right', label: 'يمين' },
    { value: 'center', label: 'وسط' },
    { value: 'left', label: 'يسار' },
];

export const ACCENTS = [
    { value: '#111827', label: 'أسود' },
    { value: '#A51D26', label: 'عنابي' },
    { value: '#1D4ED8', label: 'أزرق' },
    { value: '#047857', label: 'أخضر' },
    { value: '#6B7280', label: 'رمادي' },
];
