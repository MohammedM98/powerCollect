import SegmentedChoice from '@/Components/UI/SegmentedChoice';

/**
 * A segmented control: the period a report covers, the order of the branch
 * cards. HeroUI's ToggleButtonGroup through SegmentedChoice; `options` are
 * `{ value, label }`, `label` names the group for screen readers.
 */
export default function SegmentedTabs({ options, value, onChange, label }) {
    return <SegmentedChoice label={label} value={value} onChange={onChange} options={options} />;
}
