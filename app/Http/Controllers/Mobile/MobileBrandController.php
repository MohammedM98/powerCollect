<?php

namespace App\Http\Controllers\Mobile;

use App\Http\Controllers\Controller;
use App\Support\Branding\MobileBrand;
use Illuminate\Http\JsonResponse;

class MobileBrandController extends Controller
{
    /**
     * The company's names, logos, fonts and colours, for the app to look like
     * the website. Public: the sign-in screen shows it before anyone signs in.
     */
    public function show(MobileBrand $brand): JsonResponse
    {
        return response()->json($brand->payload());
    }
}
