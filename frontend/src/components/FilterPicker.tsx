'use client';

import { useEffect, useState } from 'react';
import { getFilterOptions } from '@/lib/api';
import type { FilterOptions, GameFilters } from '@/lib/api';

interface FilterPickerProps {
  onSubmit: (filters: GameFilters) => void;
  onBack: () => void;
  isSubmitting: boolean;
  submitError: string | null;
}

type CategoryMode = 'genre' | 'decade';

const primaryButtonClass =
  'w-full rounded-md bg-gradient-to-r from-primary to-secondary py-3 text-sm sm:text-base font-bold uppercase tracking-widest text-white shadow-[0_8px_18px_rgba(99,102,241,0.35)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:opacity-40';

const outlineButtonClass =
  'w-full rounded-md border-2 border-[#6f7a8d] bg-transparent py-3 text-sm sm:text-base font-bold uppercase tracking-widest text-white transition hover:border-white disabled:cursor-not-allowed disabled:opacity-40';

/**
 * Category-first song picker: choose whether to play by genre or decade, then
 * choose the specific value from the options actually present in MongoDB.
 */
export default function FilterPicker({ onSubmit, onBack, isSubmitting, submitError }: FilterPickerProps) {
  const [options, setOptions] = useState<FilterOptions | null>(null);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [categoryMode, setCategoryMode] = useState<CategoryMode | null>(null);

  useEffect(() => {
    let cancelled = false;
    getFilterOptions()
      .then((opts) => {
        if (!cancelled) setOptions(opts);
      })
      .catch((err) => {
        if (!cancelled) setOptionsError(err.message || 'Failed to load category options');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleGenre = (genre: string) => {
    if (isSubmitting) return;
    onSubmit({ mode: 'genre', genres: [genre] });
  };

  const handleDecade = (decade: number) => {
    if (isSubmitting) return;
    onSubmit({ mode: 'decade', decades: [decade] });
  };

  const title = categoryMode === 'genre' ? 'Select Genre' : categoryMode === 'decade' ? 'Select Decade' : 'Select Category';

  return (
    <div className="relative w-full max-w-lg rounded-lg border-2 border-[#6f7a8d] bg-[#111820]/90 p-5 sm:p-8 text-center shadow-[0_12px_28px_rgba(0,0,0,0.45),inset_0_0_20px_rgba(255,255,255,0.04)] backdrop-blur-sm">
      <div className="absolute inset-0 pointer-events-none rounded-md opacity-20 bg-[radial-gradient(circle_at_22%_18%,rgba(255,255,255,0.14),transparent_24%),linear-gradient(rgba(255,255,255,0.07)_1px,transparent_1px)] bg-[length:100%_100%,100%_5px]" />

      <div className="relative">
        <div className="mb-5 flex items-center justify-between gap-3">
          <p className="text-xs sm:text-sm font-semibold uppercase tracking-widest text-[#9aa3b2]">
            {title}
          </p>
          <button
            type="button"
            onClick={categoryMode ? () => setCategoryMode(null) : onBack}
            disabled={isSubmitting}
            className="shrink-0 text-[10px] sm:text-xs font-semibold uppercase tracking-widest text-[#9aa3b2] transition hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            &larr; Back
          </button>
        </div>

        {optionsError && (
          <p className="mb-3 text-xs sm:text-sm text-red-400">Error: {optionsError}</p>
        )}

        {!options && !optionsError && (
          <p className="mb-3 text-xs sm:text-sm text-[#9aa3b2]">Loading categories...</p>
        )}

        {options && !categoryMode && (
          <div className="flex flex-col gap-3 sm:gap-4">
            <button
              type="button"
              onClick={() => setCategoryMode('decade')}
              disabled={isSubmitting}
              className={outlineButtonClass}
            >
              Based on Decade
            </button>
            <button
              type="button"
              onClick={() => setCategoryMode('genre')}
              disabled={isSubmitting}
              className={outlineButtonClass}
            >
              Based on Genre
            </button>
          </div>
        )}

        {options && categoryMode === 'genre' && (
          <div className="flex flex-col gap-3 sm:gap-4">
            {options.genres.map((genre) => (
              <button
                key={genre}
                type="button"
                onClick={() => handleGenre(genre)}
                disabled={isSubmitting}
                className={primaryButtonClass}
              >
                {isSubmitting ? 'Starting...' : genre}
              </button>
            ))}
          </div>
        )}

        {options && categoryMode === 'decade' && (
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            {options.decades.map((decade) => (
              <button
                key={decade}
                type="button"
                onClick={() => handleDecade(decade)}
                disabled={isSubmitting}
                className={primaryButtonClass}
              >
                {isSubmitting ? 'Starting...' : `${decade}s`}
              </button>
            ))}
          </div>
        )}

        {submitError && (
          <p className="mt-4 text-center text-[10px] sm:text-xs text-red-400">Error: {submitError}</p>
        )}
      </div>
    </div>
  );
}
