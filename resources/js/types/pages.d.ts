/**
 * The props the server sends the most-used pages, read from their
 * controllers' Inertia::render arrays. A prop marked optional is a lazy
 * one (Inertia::optional / defer, or a closure left out of a partial
 * reload). Nested records the page only passes along are typed loosely
 * until their own components are converted.
 */
import type { Option } from '@/lib/types';

/** A Laravel paginator as Inertia receives it. */
export interface Paginated<Row> {
    data: Row[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number | null;
    to: number | null;
    links: { url: string | null; label: string; active: boolean }[];
}

/** DataTableFilters::dataTableState: what a server-backed table was asked for. */
export interface DataTableState {
    search: string;
    sort: string;
    direction: 'asc' | 'desc';
    per_page: number;
    filter: Record<string, string | number | null>;
}

/** DataTableFilters: one dropdown of a table's filter menu. */
export interface FilterOption {
    key: string;
    label: string;
    options: Option[];
}

/** BranchScope::describe / forFilter: whose figures a page shows, said large above it. */
export interface BranchScope {
    level: 'branch' | 'governorate' | 'all';
    all: boolean;
    name: string | null;
    place: string | null;
    phone: string | null;
    isActive: boolean;
    branches: number;
    subscribers: number;
}

/** DashboardController@index */
export interface DashboardProps {
    greeting: string;
    scope: { company: boolean; label: string | null; branches: number; governorates: number; today: string };
    branchScope?: BranchScope | null;
    filters: { days: number; branch: number | null; governorate: number | null; method: string | null; search: string };
    periods: number[];
    branchOptions: (Option & { governorate: number | null })[] | null;
    governorateOptions: Option[] | null;
    sections: Record<string, unknown>;
    debts?: unknown;
    latestPayments?: Paginated<Record<string, unknown>>;
    fieldApp?: { url: string | null } | null;
    canCreateSubscription: boolean;
    canCreateBranch: boolean;
    canCreateUser: boolean;
    branchForm?: Record<string, unknown> | null;
    userForm?: Record<string, unknown> | null;
    statement?: StatementProps | null;
    subscriptionForm?: Record<string, unknown> | null;
    subscriptionEdit?: Record<string, unknown> | null;
}

/** SubscriptionController@index (with SubscriptionForm::subscriptionFormOptions spread in). */
export interface SubscriptionsIndexProps {
    subscriptions: Paginated<Record<string, unknown> & { id: number; display_name: string; status: string }>;
    canCreate: boolean;
    canViewArchived: boolean;
    showArchived: boolean;
    archiveToday: string;
    canRecordReadings: boolean;
    bulkActions: { minimumCharge: boolean; status: boolean; meterBox: boolean; message: boolean };
    statusOptions: Option[];
    filters: DataTableState;
    filterOptions?: FilterOption[];
    branchScope?: BranchScope | null;
    readingWeekOptions?: Record<string, Option[]>;
    statement?: StatementProps | null;
    [formOption: string]: unknown;
}

/** StatementBuilder::subscriptionStatement, the statement page and every statement window. */
export interface StatementProps {
    subscription: Record<string, unknown> & { id: number; fullName: string; accountNumber: string };
    subscriptions: Record<string, unknown>[];
    entries: Record<string, unknown>[];
    summary: Record<string, unknown> & { balance: number | string };
    canRecordPayment: boolean;
    canRecordLatePayment: boolean;
    paymentToday: string;
    canRecordSplitPayment: boolean;
    canAdjustBalance: boolean;
    canAddCharge: boolean;
    canAddDiscount: boolean;
    canAddClearing: boolean;
    canUpdate: boolean;
    currencies: Option[];
    paymentMethods: Option[];
    payableMethods: Option[];
    transferBanks: string[];
    senderBanks: string[];
    chargeTypes: (Option & { usualAmount?: string | null })[];
    discountMethods: Option[];
    discountSegments: string[];
    transactionTypes: Option[];
    correctionReasons: Option[];
    focusLineId?: number | null;
    [more: string]: unknown;
}

/** CashBoxController@index: a collector's own cash boxes. */
export interface CashBoxesProps {
    started: boolean;
    branchName: string | null;
    boxes: Paginated<Record<string, unknown> & { id: number; type: string; status: string }>;
    filters: { type: string | null; state: string | null; per_page: number };
    pendingCount: number;
    collectionUrls: Record<string, string>;
    [count: string]: unknown;
}

/** MeterReadingPage: the weekly readings sheet. */
export interface MeterReadingsIndexProps {
    rows: Paginated<Record<string, unknown> & { id: number; previousReading: number | null }>;
    week: string;
    weekEnd: string;
    weekOptions?: Option[];
    summary?: { total: number; entered: number; amountDue: string };
    canRecord: boolean;
    canApprove: boolean;
    canSendReadingMessages: boolean;
    messageBranchId: number | null;
    seesWhoRecorded: boolean;
    statusSummary?: Record<string, number>;
    pendingApproval?: Record<string, unknown> | null;
    weekIsViewOnly: boolean;
    entryWindow: Record<string, unknown> | null;
    filters: DataTableState;
    filterOptions?: FilterOption[];
}
