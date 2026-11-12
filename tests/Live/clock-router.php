<?php

/**
 * The live tests' web server entry: every request reads the test clock, so
 * the scenarios can move through reading weeks and box periods.
 */
require_once getenv('LIVE_TEST_AUTOLOAD');

$clock = trim((string) @file_get_contents(getenv('LIVE_TEST_CLOCK')));
if ($clock !== '') {
    Illuminate\Support\Facades\Date::setTestNow(new DateTimeImmutable($clock));
}

return require getenv('LIVE_TEST_ROUTER');
