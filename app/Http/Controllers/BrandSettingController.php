<?php

namespace App\Http\Controllers;

use App\Http\Requests\ImportBrandRequest;
use App\Http\Requests\UpdateBrandRequest;
use App\Notifications\ActionCompleted;
use App\Support\Branding\Brand;
use App\Support\Branding\BrandDesign;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response as InertiaResponse;
use JsonException;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * The company's identity and look, set by the Super Admin from Settings:
 * the names, logos and colours, and the layout and components the whole
 * interface is drawn with. The same identity file `brand:import` reads, so
 * it can also be downloaded, uploaded or put back to the default here.
 */
class BrandSettingController extends Controller
{
    public function edit(Brand $brand): InertiaResponse
    {
        Gate::authorize('manage-brand');

        $profile = $brand->profile();

        return Inertia::render('Settings/Appearance', [
            'profile' => [
                'company' => $profile['company'],
                'colors' => $profile['colors'],
                'design' => $profile['design'],
                // Which logos the company has of its own; the others fall back to the main one.
                'ownLogos' => array_keys(array_filter($profile['logos'])),
            ],
            'isImported' => $brand->isImported(),
            'options' => BrandDesign::translatedOptions(),
            'presets' => BrandDesign::translatedPresets(),
            'themePrimary' => Brand::THEME_PRIMARY,
        ]);
    }

    /**
     * Save the identity. A logo with no new file keeps the one saved, unless
     * it is marked to be removed.
     */
    public function update(UpdateBrandRequest $request, Brand $brand): RedirectResponse
    {
        $saved = $brand->profile()['logos'];
        $removed = $request->validated('remove_logos', []);
        $logos = [];

        foreach (Brand::LOGOS as $variant) {
            $file = $request->file("logos.{$variant}");
            $logos[$variant] = match (true) {
                $file instanceof UploadedFile => 'data:'.$file->getMimeType().';base64,'.base64_encode($file->getContent()),
                in_array($variant, $removed, true) => null,
                default => $saved[$variant],
            };
        }

        $brand->import([
            'version' => Brand::VERSION,
            'company' => $request->validated('company'),
            'colors' => $request->validated('colors', []),
            'design' => $request->validated('design', []),
            // The screen sets the choices; the exact values and the company's own CSS come only from the file, and stay.
            'tokens' => $brand->profile()['tokens'],
            'customCss' => $brand->profile()['customCss'],
            'logos' => $logos,
        ]);

        $request->user()->notify(new ActionCompleted('brand-updated'));

        return redirect()->route('settings.appearance.edit')->with('status', 'brand-updated');
    }

    /**
     * The identity as a file, its logos inside it.
     */
    public function export(Brand $brand): StreamedResponse
    {
        Gate::authorize('manage-brand');

        $json = json_encode($brand->export(), JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

        return response()->streamDownload(fn () => print ($json), 'brand-'.now()->format('Y-m-d').'.json', ['Content-Type' => 'application/json']);
    }

    /**
     * Make an uploaded identity file the company's, as `brand:import` does.
     */
    public function import(ImportBrandRequest $request, Brand $brand): RedirectResponse
    {

        try {
            $data = json_decode($request->file('file')->getContent(), true, flags: JSON_THROW_ON_ERROR);
        } catch (JsonException) {
            $data = null;
        }

        if (! is_array($data)) {
            throw ValidationException::withMessages(['file' => __('The file is not a brand identity JSON file.')]);
        }

        $brand->import($data);
        $request->user()->notify(new ActionCompleted('brand-updated'));

        return redirect()->route('settings.appearance.edit')->with('status', 'brand-updated');
    }

    /**
     * Put back the identity the application ships with.
     */
    public function reset(Request $request, Brand $brand): RedirectResponse
    {
        Gate::authorize('manage-brand');

        $brand->reset();
        $request->user()->notify(new ActionCompleted('brand-reset'));

        return redirect()->route('settings.appearance.edit')->with('status', 'brand-reset');
    }
}
