<?php

namespace Tests\Feature;

use Symfony\Component\Finder\Finder;
use Tests\TestCase;

class ArabicCopyConventionTest extends TestCase
{
    /**
     * Arabic that is data rather than wording: the letters Arabic search
     * folds, the Arabic-Indic digits phone and reference numbers are read
     * with, the placeholders people type into message templates, and the
     * column names saved print layouts refer to.
     *
     * @var list<string>
     */
    private const ARABIC_DATA = [
        'Support/ArabicSearch.php',
        'Support/Messaging/PhoneNumber.php',
        'Support/Closing/AuditTransferSearch.php',
        'Support/Messaging/MessageComposer.php',
        'Support/Disconnections/DisconnectionItemPage.php',
        'Support/Readings/ReadingPrintData.php',
    ];

    public function test_models_and_support_classes_word_their_copy_through_lang_files(): void
    {
        $offenders = [];

        foreach (Finder::create()->files()->in([app_path('Models'), app_path('Support')])->name('*.php') as $file) {
            $path = str_replace(app_path().DIRECTORY_SEPARATOR, '', $file->getPathname());
            if (in_array($path, self::ARABIC_DATA, true)) {
                continue;
            }

            foreach (token_get_all($file->getContents()) as $token) {
                if (is_array($token) && in_array($token[0], [T_CONSTANT_ENCAPSED_STRING, T_ENCAPSED_AND_WHITESPACE], true)
                    && preg_match('/\p{Arabic}/u', $token[1])) {
                    $offenders[] = "{$path}:{$token[2]}";
                }
            }
        }

        $this->assertSame([], $offenders, 'Give the text an English key in lang/ar.json and show it with __().');
    }
}
