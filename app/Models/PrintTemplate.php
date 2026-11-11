<?php

namespace App\Models;

use Database\Factories\PrintTemplateFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * A saved print design, shared by the whole company: the print designer's
 * whole layout (paper, heading, columns, sorting, grouping, footer) for
 * one list. One template per list may be its default, the design the
 * list's print button starts from.
 */
#[Fillable(['page', 'name', 'layout', 'is_default', 'created_by', 'updated_by'])]
class PrintTemplate extends Model
{
    /** @use HasFactory<PrintTemplateFactory> */
    use HasFactory;

    /**
     * The lists that can be printed, by their address, with the name and
     * icon the templates page shows them under.
     *
     * @var array<string, array{label: string, icon: string}>
     */
    public const PAGES = [
        '/meter-readings' => ['label' => 'Weekly readings', 'icon' => 'chart'],
        '/subscriptions' => ['label' => 'Subscribers', 'icon' => 'users'],
        '/meter-boxes' => ['label' => 'Meter boxes', 'icon' => 'table'],
        '/meter-boxes/subscriptions-print' => ['label' => 'Meter boxes and their subscribers', 'icon' => 'users'],
        '/ledger' => ['label' => 'Ledger', 'icon' => 'ledger'],
        '/reports' => ['label' => 'Financial reports', 'icon' => 'trend'],
        '/receivables' => ['label' => 'Debt ages', 'icon' => 'wallet'],
        '/transaction-audit' => ['label' => 'Audit log', 'icon' => 'history'],
        '/users' => ['label' => 'Users', 'icon' => 'user'],
        '/branches' => ['label' => 'Branches', 'icon' => 'pin'],
        '/circuit-breakers' => ['label' => 'Circuit breakers', 'icon' => 'bolt'],
        '/messages' => ['label' => 'Messages', 'icon' => 'messages'],
        '/payments/cash-boxes/report' => ['label' => 'Cash box details', 'icon' => 'wallet'],
        '/subscriptions/statement-print' => ['label' => 'Subscriber statement', 'icon' => 'ledger'],
        '/reading-cycles/print' => ['label' => 'Reading distribution', 'icon' => 'layers'],
        '/paper-sheets' => ['label' => 'Paper reading sheets', 'icon' => 'printer'],
    ];

    protected function casts(): array
    {
        return [
            'layout' => 'array',
            'is_default' => 'boolean',
        ];
    }

    public static function pageForRequest(Request $request): string
    {
        return $request->routeIs('paper-sheets.show') ? '/paper-sheets' : '/'.trim($request->path(), '/');
    }

    public function updatedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by');
    }

    /**
     * Make this the list's default template, in place of any other.
     */
    public function makeDefault(): void
    {
        DB::transaction(function (): void {
            static::query()->where('page', $this->page)->whereKeyNot($this->getKey())->update(['is_default' => false]);
            $this->update(['is_default' => true]);
        });
    }

    /**
     * The first free name for a copy: "name (نسخة)", then "name (نسخة 2)"…
     */
    public function copyName(): string
    {
        $name = $this->name.__(' (copy)');

        for ($number = 2; static::query()->where('page', $this->page)->where('name', $name)->exists(); $number++) {
            $name = $this->name.__(' (copy ').$number.')';
        }

        return $name;
    }

    /**
     * What the print designer needs to list and apply the template.
     *
     * @return array{id: int, name: string, isDefault: bool, layout: array<string, mixed>, updatedBy: ?string, updatedAt: ?string}
     */
    public function toDesigner(): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'isDefault' => $this->is_default,
            'layout' => $this->layout,
            'updatedBy' => $this->updatedBy?->name,
            'updatedAt' => $this->updated_at?->toIso8601String(),
        ];
    }
}
