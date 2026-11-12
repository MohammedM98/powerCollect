<?php

namespace App\Enums;

enum AuditAction: string
{
    case ViewAccounts = 'view_accounts';
    case ViewLedger = 'view_ledger';
    case ViewHistory = 'view_history';
    case ReviewTransfers = 'review_transfers';
    case ApproveBoxes = 'approve_boxes';
    case ApprovePeriods = 'approve_periods';
    case PrintReports = 'print_reports';

    public function label(): string
    {
        return match ($this) {
            self::ViewAccounts => 'View subscribers and their account statements',
            self::ViewLedger => 'View the ledger',
            self::ViewHistory => 'View the transaction change log',
            self::ReviewTransfers => 'Review transfers and record the bank amount',
            self::ApproveBoxes => 'Approve a box audit',
            self::ApprovePeriods => 'Approve a whole period audit',
            self::PrintReports => 'Print boxes, statements and vouchers',
        };
    }

    public function description(): string
    {
        return match ($this) {
            self::ViewAccounts => 'Reads a subscriber\'s details and statement without changing them.',
            self::ViewLedger => 'Follows the selected branches\' payments and transactions.',
            self::ViewHistory => 'Sees who changed a transaction, when and why.',
            self::ReviewTransfers => 'Records what reached the bank and why it differs, in closed boxes.',
            self::ApproveBoxes => 'Approves the box and posts the audit differences to the subscribers\' accounts.',
            self::ApprovePeriods => 'Approves the period\'s boxes together; needs box approval.',
            self::PrintReports => 'Opens the print reports for the data they may view.',
        };
    }
}
