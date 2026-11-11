<?php

namespace App\Console\Commands;

use App\Support\Branding\Brand;
use App\Support\Branding\BrandDesign;
use App\Support\Branding\BrandPalette;
use Illuminate\Console\Command;

class BrandOptions extends Command
{
    protected $signature = 'brand:options';

    protected $description = 'List everything an identity file can set: its presets, every design choice and its options, and the colours';

    public function handle(): int
    {
        $this->components->info('Presets ("design": {"preset": "…"}): a whole look; any choice below then changes it.');
        foreach (BrandDesign::PRESETS as $key => $preset) {
            $this->components->twoColumnDetail("<fg=green>{$key}</> {$preset['label']}", $preset['description']);
        }

        $this->newLine();
        $this->components->info('Design choices ("design": {"choice": "option"}), the first of each being today\'s look:');
        foreach (BrandDesign::OPTIONS as $key => $choice) {
            $this->components->twoColumnDetail("<fg=green>{$key}</> {$choice['label']}", implode(' · ', array_keys($choice['options'])));
        }

        $this->newLine();
        $this->components->info('Colours ("colors": {…}), each a six-digit hex such as #CE0D03, all optional:');
        $this->components->twoColumnDetail('<fg=green>primary</>', 'the main colour: buttons, links, focus; every shade is made from it');
        $this->components->twoColumnDetail('<fg=green>print</>', 'the lines on printouts (else the main colour)');
        foreach (Brand::STATUSES as $status) {
            $this->components->twoColumnDetail("<fg=green>{$status}</>", "replaces the {$status} colour");
        }
        $this->components->twoColumnDetail('design.neutral', 'the tone of the greys: '.implode(' · ', ['graphite', ...array_keys(BrandPalette::NEUTRALS)]));

        $this->newLine();
        $this->components->info('Exact values ("tokens": {"name": number}), each within its range; they win over the choices above:');
        foreach (BrandDesign::TOKENS as $key => $token) {
            $this->components->twoColumnDetail("<fg=green>{$key}</> {$token['label']}", "{$token['min']} – {$token['max']} {$token['unit']}");
        }

        $this->newLine();
        $this->components->info('Your own CSS ("customCss": "…"), last of all: anything the choices do not cover.');
        $this->line('  It may use .ui-btn-primary, .ui-btn-secondary, .ui-btn-danger, .ui-switch, .ui-badge, .ui-page-title, .shadow-card,');
        $this->line('  .data-table, .data-table-toolbar, .tn-glass, .sn-panel and every [data-ui-*] attribute on <html>. Links to other sites,');
        $this->line('  @import and escapes are removed; url() may hold data: images only.');

        $this->newLine();
        $this->line('  A complete example: resources/brand/example.json. Import with: php artisan brand:import <file>');

        return self::SUCCESS;
    }
}
