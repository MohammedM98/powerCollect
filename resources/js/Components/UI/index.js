/**
 * The app's component kit, built on HeroUI and the MA design: every page
 * takes its keys, fields, figures and windows from here, so the same part
 * looks and behaves the same everywhere and is changed in one place.
 *
 *     import { EditKey, DeleteKey, PrimaryKey, CheckBox, ChoiceSelect, Figure } from '@/Components/UI';
 */

// Keys
export { default as PrimaryKey, primaryButtonClass } from '@/Components/UI/PrimaryButton';
export { default as SecondaryKey, secondaryButtonClass } from '@/Components/UI/SecondaryButton';
export { default as DangerKey } from '@/Components/UI/DangerButton';
export { default as AddKey, addButtonClass } from '@/Components/UI/AddButton';
export { default as PayKey } from './PayKey';
export { SaveButton as SaveKey } from '@/Components/Settings/SettingsKit';
export { ViewKey, EditKey, DeleteKey, PrintKey, ExcelKey, MenuKey, RowActionKey } from './ActionKeys';

// Fields and choices
export { default as TextInput } from '@/Components/UI/TextInput';
export { default as CheckBox } from '@/Components/UI/CheckBox';
export { default as ChoiceSelect } from '@/Components/UI/ChoiceSelect';
export { default as SearchableSelect } from '@/Components/UI/SearchableSelect';
export { default as SegmentedChoice } from '@/Components/UI/SegmentedChoice';
export { default as Switch } from '@/Components/UI/Switch';
export { default as TabStrip } from './TabStrip';
export { default as RadioCards } from './RadioCards';

// Tables
export { default as ListTable, ListHeader, ListColumn, ListBody, ListRow, ListCell, BandRow } from './ListTable';

// Display
export { default as Figure } from './Figure';
export { default as StatusPill } from '@/Components/DataTable/StatusPill';

// Windows
export { default as Window } from './Window';
export { default as ConfirmDialog, SaveConfirmDialog } from '@/Components/UI/ConfirmDialog';
