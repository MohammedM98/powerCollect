<?php

namespace App\Console\Commands;

use App\Support\Brand;
use Illuminate\Console\Command;

class ExportBrand extends Command
{
    protected $signature = 'brand:export
        {file? : Where to write the identity file; without one it is printed}';

    protected $description = 'Write the company\'s identity as one JSON file, its logos inside it, to edit and import again';

    public function handle(Brand $brand): int
    {
        $json = json_encode($brand->export(), JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)."\n";
        $file = $this->argument('file');

        if ($file === null) {
            $this->output->write($json);

            return self::SUCCESS;
        }

        if (file_put_contents($file, $json) === false) {
            $this->components->error("The file {$file} cannot be written.");

            return self::FAILURE;
        }

        $this->components->info("The identity of {$brand->profile()['company']['name']} is in {$file}.");

        return self::SUCCESS;
    }
}
