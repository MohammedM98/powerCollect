<?php

use App\Http\Controllers\Field\FieldHomeController;
use App\Http\Controllers\Field\FieldSessionController;
use Illuminate\Support\Facades\Route;

/*
 * The field app for meter readers, collectors and other field workers: its
 * own sign-in and one home page whose tiles follow the user's permissions.
 */
Route::prefix('field')->name('field.')->group(function () {
    Route::get('manifest.webmanifest', [FieldHomeController::class, 'manifest'])->name('manifest');

    Route::middleware('guest')->group(function () {
        Route::get('login', [FieldSessionController::class, 'create'])->name('login');
        Route::post('login', [FieldSessionController::class, 'store'])->name('login.store');
    });

    Route::middleware('auth')->group(function () {
        Route::get('/', [FieldHomeController::class, 'index'])->name('home');
        Route::post('logout', [FieldSessionController::class, 'destroy'])->name('logout');
    });
});
