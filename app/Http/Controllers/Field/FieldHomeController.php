<?php

namespace App\Http\Controllers\Field;

use App\Http\Controllers\Controller;
use App\Support\Branding\Brand;
use App\Support\Field\FieldTasks;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response as InertiaResponse;

/**
 * The field app's home: one page for every field worker, showing only the
 * tasks their permissions open (FieldTasks), and the web manifest that lets
 * the app be added to a phone's home screen.
 */
class FieldHomeController extends Controller
{
    public function index(Request $request): InertiaResponse
    {
        $now = now(config('app.business_timezone'));

        return Inertia::render('Field/Home', [
            'greeting' => match (true) {
                $now->hour < 12 => __('Good morning'),
                $now->hour < 18 => __('Good afternoon'),
                default => __('Good evening'),
            },
            'today' => $now->toDateString(),
            'sections' => FieldTasks::for($request->user()),
        ]);
    }

    public function manifest(Brand $brand): JsonResponse
    {
        $company = $brand->forPage();

        return response()->json([
            'name' => $company['name'],
            'short_name' => $company['shortName'],
            'description' => 'تطبيق الميدان: القراءات والتحصيل',
            'lang' => 'ar',
            'dir' => 'rtl',
            'start_url' => route('field.home', absolute: false),
            'scope' => '/',
            'display' => 'standalone',
            'background_color' => '#eceef1',
            'theme_color' => $company['primaryColor'] ?? '#24272e',
            'icons' => [
                ['src' => $brand->logoUrl('icon'), 'sizes' => 'any', 'purpose' => 'any'],
            ],
        ], headers: ['Content-Type' => 'application/manifest+json']);
    }
}
