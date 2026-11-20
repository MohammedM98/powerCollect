/**
 * The app's component kit, built on HeroUI and the MA design: every page
 * takes its keys, fields, figures and windows from here, so the same part
 * looks and behaves the same everywhere and is changed in one place.
 *
 *     import { EditKey, DeleteKey, PrimaryKey, CheckBox, ChoiceSelect, Figure } from '@/Components/UI';
 */

// Keys
export { default as PrimaryKey, primaryButtonClass } from '@/Components/PrimaryButton';
export { default as SecondaryKey, secondaryButtonClass } from '@/Components/SecondaryButton';
export { default as DangerKey } from '@/Components/DangerButton';
export { default as AddKey, addButtonClass } from '@/Components/AddButton';
export { default as PayKey } from './PayKey';
export { SaveButton as SaveKey } from '@/Components/Settings/SettingsKit';
export { ViewKey, EditKey, DeleteKey, PrintKey, ExcelKey, MenuKey, RowActionKey } from './ActionKeys';

// Fields and choices
export { default as TextInput } from '@/Components/TextInput';
export { default as CheckBox } from '@/Components/CheckBox';
export { default as ChoiceSelect } from '@/Components/ChoiceSelect';
export { default as SearchableSelect } from '@/Components/SearchableSelect';
export { default as SegmentedChoice } from '@/Components/SegmentedChoice';
export { default as Switch } from '@/Components/Switch';

// Display
export { default as Figure } from './Figure';
export { default as StatusPill } from '@/Components/DataTable/StatusPill';

// Windows
export { default as ConfirmDialog, SaveConfirmDialog } from '@/Components/ConfirmDialog';
