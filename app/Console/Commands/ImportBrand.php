<?php

namespace App\Console\Commands;

use App\Support\Brand;
use Illuminate\Console\Command;
use Illuminate\Validation\ValidationException;
use JsonException;

class ImportBrand extends Command
{
    protected $signature = 'brand:import
        {file : The company\'s identity file (JSON, shaped like resources/brand/default.json); logo paths in it are read relative to the file}';

    protected $description = 'Make a JSON file the company\'s identity: its names, logos and colours on every page and printout';

    public function handle(Brand $brand): int
    {
        $file = $this->argument('file');
        $contents = is_file($file) ? file_get_contents($file) : false;

        if ($contents === false) {
            $this->components->error("The file {$file} cannot be read.");

            return self::FAILURE;
        }

        try {
            $data = json_decode($contents, true, flags: JSON_THROW_ON_ERROR);
        } catch (JsonException $exception) {
            $this->components->error('The file is not valid JSON: '.$exception->getMessage());

            return self::FAILURE;
        }

        if (! is_array($data)) {
            $this->components->error('The file must hold one JSON object.');

            return self::FAILURE;
        }

        try {
            $notes = $brand->import($data, dirname(realpath($file)));
        } catch (ValidationException $exception) {
            $this->components->error('The identity was not imported:');

            foreach ($exception->errors() as $field => $messages) {
                $this->line("  • {$field}: ".implode(' ', $messages));
            }

            return self::FAILURE;
        }

        foreach ($notes as $note) {
            $this->components->warn($note);
        }

        $this->components->info('Every page and printout now shows '.$brand->profile()['company']['name'].'.');

        return self::SUCCESS;
    }
}
