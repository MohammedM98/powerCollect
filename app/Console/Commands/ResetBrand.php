<?php

namespace App\Console\Commands;

use App\Support\Branding\Brand;
use Illuminate\Console\Command;

class ResetBrand extends Command
{
    protected $signature = 'brand:reset {--force : Reset without asking}';

    protected $description = 'Put back the identity the application ships with, removing the imported one and its logos';

    public function handle(Brand $brand): int
    {
        if (! $brand->isImported()) {
            $this->components->info('No identity has been imported; the default is already in use.');

            return self::SUCCESS;
        }

        if (! $this->option('force') && ! $this->confirm('Remove '.$brand->profile()['company']['name'].'\'s identity and its logos?')) {
            return self::FAILURE;
        }

        $brand->reset();
        $this->components->info('The default identity is back.');

        return self::SUCCESS;
    }
}
