import { Tabs } from '@heroui/react';

/**
 * A row of tabs: HeroUI's Tabs (arrow keys, Home and End, the selected tab
 * focusable), drawn by the page's own class. `tabs` are `{ id, label }`;
 * the page shows the chosen tab's content itself, as a role="tabpanel"
 * named by the tab's words. `onSelectionChange` gets the chosen id.
 */
export default function TabStrip({ tabs, selectedKey, onSelectionChange, label, className = '', tabClassName = '' }) {
    return (
        <Tabs selectedKey={selectedKey} onSelectionChange={(key) => onSelectionChange(String(key))} className="gl-tabstrip">
            <Tabs.List aria-label={label} className={className}>
                {tabs.map((tab) => (
                    <Tabs.Tab key={tab.id} id={tab.id} className={typeof tabClassName === 'function' ? tabClassName(tab, tab.id === selectedKey) : tabClassName}>
                        {tab.label}
                    </Tabs.Tab>
                ))}
            </Tabs.List>
        </Tabs>
    );
}
