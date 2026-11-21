<?php

namespace App\Support\Exports;

/**
 * A CSV row a spreadsheet opens safely: text that starts like a formula
 * (= + @ - tab or return) is written with a leading quote so it shows as
 * text, while numbers, negative ones included, stay numbers.
 */
class CsvCells
{
    /**
     * @param  array<int, mixed>  $cells
     * @return array<int, mixed>
     */
    public static function safe(array $cells): array
    {
        return array_map(
            fn (mixed $cell): mixed => is_string($cell) && ! is_numeric($cell) && preg_match('/^[=+@\-\t\r]/u', $cell) ? "'".$cell : $cell,
            $cells,
        );
    }
}
