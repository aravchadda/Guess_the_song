'use client';

import { useEffect, useState } from 'react';
import { getFilterOptions } from '@/lib/api';
import type { FilterOptions, GameFilters } from '@/lib/api';
import AnalogToggle from './AnalogToggle';

interface FilterPickerProps {
  onSubmit: (filters: GameFilters) => void;
  onBack: () => void;
  isSubmitting: boolean;
  submitError: string | null;
}

/**
 * Decades on the left (multi-select, at least `minDecadesSelected` required,
 * not counting `decadeExcludedFromMinimum`), genres on the right (checkboxes,
 * none ticked = no genre restriction), plus a Hindi include/exclude toggle.
 */
export default function FilterPicker({ onSubmit, onBack, isSubmitting, submitError }: FilterPickerProps) {
  const [options, setOptions] = useState<FilterOptions | null>(null);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [selectedDecades, setSelectedDecades] = useState<number[]>([]);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [includeHindi, setIncludeHindi] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getFilterOptions()
      .then((opts) => {
        if (!cancelled) setOptions(opts);
      })
      .catch((err) => {
        if (!cancelled) setOptionsError(err.message || 'Failed to load filter options');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const minDecadesSelected = options?.minDecadesSelected ?? 2;
  const excludedDecade = options?.decadeExcludedFromMinimum ?? 1970;

  const countingDecades = selectedDecades.filter((d) => d !== excludedDecade);
  const isValid = countingDecades.length >= minDecadesSelected;
  const remaining = Math.max(0, minDecadesSelected - countingDecades.length);

  const toggleDecade = (decade: number) => {
    setSelectedDecades((prev) =>
      prev.includes(decade) ? prev.filter((d) => d !== decade) : [...prev, decade]
    );
  };

  const toggleGenre = (genre: string) => {
    setSelectedGenres((prev) =>
      prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre]
    );
  };

  const handleStart = () => {
    if (!isValid || isSubmitting) return;
    onSubmit({
      decades: selectedDecades,
      genres: selectedGenres.length > 0 ? selectedGenres : undefined,
      includeHindi,
    });
  };

  return (
    <div className="relative w-full max-w-lg rounded-lg border-2 border-[#6f7a8d] bg-[#111820]/90 p-4 sm:p-6 shadow-[0_12px_28px_rgba(0,0,0,0.45),inset_0_0_20px_rgba(255,255,255,0.04)] backdrop-blur-sm">
      <div className="absolute inset-0 pointer-events-none rounded-md opacity-20 bg-[radial-gradient(circle_at_22%_18%,rgba(255,255,255,0.14),transparent_24%),linear-gradient(rgba(255,255,255,0.07)_1px,transparent_1px)] bg-[length:100%_100%,100%_5px]" />

      <div className="relative">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm sm:text-base font-bold uppercase tracking-widest text-white">
            Play with Filters
          </h2>
          <button
            type="button"
            onClick={onBack}
            disabled={isSubmitting}
            className="text-[10px] sm:text-xs font-semibold uppercase tracking-widest text-[#9aa3b2] transition hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            &larr; Back
          </button>
        </div>

        {optionsError && (
          <p className="mb-3 text-xs sm:text-sm text-red-400">❌ {optionsError}</p>
        )}

        {!options && !optionsError && (
          <p className="mb-3 text-xs sm:text-sm text-[#9aa3b2]">Loading filters...</p>
        )}

        {options && (
          <>
            <div className="grid grid-cols-2 gap-4">
              {/* Decades - left */}
              <div>
                <p className="mb-2 text-[10px] sm:text-xs font-semibold uppercase tracking-widest text-[#9aa3b2]">
                  Decades
                </p>
                <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto pr-1">
                  {options.decades.map((decade) => {
                    const isSelected = selectedDecades.includes(decade);
                    const isExcluded = decade === excludedDecade;
                    return (
                      <button
                        key={decade}
                        type="button"
                        onClick={() => toggleDecade(decade)}
                        className={`flex items-center justify-between rounded-md border px-2.5 py-1.5 text-left text-xs sm:text-sm font-semibold transition-colors ${
                          isSelected
                            ? 'border-primary bg-primary/25 text-white'
                            : 'border-[#3d4451] bg-transparent text-[#c7ccd6] hover:border-[#6f7a8d]'
                        }`}
                      >
                        <span>{decade}s</span>
                        {isSelected && (
                          <span className="ml-1 text-[10px] leading-none text-white">✓</span>
                        )}
                        {isExcluded && (
                          <span className="ml-1 shrink-0 text-[8px] font-normal normal-case text-[#9aa3b2]">
                            (doesn't count)
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Genres - right */}
              <div>
                <p className="mb-2 text-[10px] sm:text-xs font-semibold uppercase tracking-widest text-[#9aa3b2]">
                  Genres
                </p>
                <div className="flex flex-col gap-1.5">
                  {options.genres.map((genre) => {
                    const isSelected = selectedGenres.includes(genre);
                    return (
                      <button
                        key={genre}
                        type="button"
                        onClick={() => toggleGenre(genre)}
                        className="flex items-center gap-2 rounded-md border border-transparent px-1 py-1.5 text-left text-xs sm:text-sm font-semibold text-[#c7ccd6] transition-colors hover:text-white"
                      >
                        <span
                          className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-[3px] border-2 transition-colors ${
                            isSelected ? 'border-secondary bg-secondary' : 'border-[#6f7a8d] bg-transparent'
                          }`}
                        >
                          {isSelected && <span className="text-[10px] leading-none text-white">✓</span>}
                        </span>
                        {genre}
                      </button>
                    );
                  })}
                  <p className="mt-1 text-[9px] sm:text-[10px] leading-snug text-[#9aa3b2]">
                    None ticked = no genre restriction.
                  </p>
                </div>
              </div>
            </div>

            {options.hindiToggle && (
              <div className="mt-4 flex items-center justify-center rounded-md border border-[#3d4451] bg-black/20 py-3">
                <AnalogToggle checked={includeHindi} onChange={setIncludeHindi} label="Hindi" />
              </div>
            )}

            <div className="mt-4">
              {!isValid && (
                <p className="mb-2 text-center text-[10px] sm:text-xs text-amber-400">
                  Select {remaining} more decade{remaining === 1 ? '' : 's'} to continue
                  {excludedDecade ? ` (${excludedDecade}s doesn't count toward the minimum)` : ''}.
                </p>
              )}
              {submitError && (
                <p className="mb-2 text-center text-[10px] sm:text-xs text-red-400">❌ {submitError}</p>
              )}
              <button
                type="button"
                onClick={handleStart}
                disabled={!isValid || isSubmitting}
                className="w-full rounded-md bg-gradient-to-r from-primary to-secondary py-2.5 text-sm sm:text-base font-bold uppercase tracking-widest text-white shadow-[0_8px_18px_rgba(99,102,241,0.35)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:opacity-30"
              >
                {isSubmitting ? 'Starting...' : 'Start'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
