'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { GameFilters } from '@/lib/api';
import FilterPicker from './FilterPicker';

interface PreGameScreenProps {
  onPlayAll: () => void;
  onSubmitFilters: (filters: GameFilters) => void;
  canSelectCategories: boolean;
  onRequireCategorySignIn: () => void;
  isSubmitting: boolean;
  submitError: string | null;
}

/**
 * Shown on the TV before a song is picked - lets the player choose between
 * an unrestricted "Play All" round or a category round. Only once one of
 * these resolves does the caller start the black-screen/year/views reveal
 * sequence.
 */
export default function PreGameScreen({
  onPlayAll,
  onSubmitFilters,
  canSelectCategories,
  onRequireCategorySignIn,
  isSubmitting,
  submitError,
}: PreGameScreenProps) {
  const [step, setStep] = useState<'choice' | 'filters'>('choice');

  return (
    <div className="flex w-full max-w-lg flex-col items-center px-4">
      <AnimatePresence mode="wait">
        {step === 'choice' ? (
          <motion.div
            key="choice"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="w-full rounded-lg border-2 border-[#6f7a8d] bg-[#111820]/90 p-5 sm:p-8 text-center shadow-[0_12px_28px_rgba(0,0,0,0.45),inset_0_0_20px_rgba(255,255,255,0.04)] backdrop-blur-sm"
          >
            <p className="mb-5 text-xs sm:text-sm font-semibold uppercase tracking-widest text-[#9aa3b2]">
              Choose a mode
            </p>
            <div className="flex flex-col gap-3 sm:gap-4">
              <button
                type="button"
                onClick={onPlayAll}
                className="w-full rounded-md bg-gradient-to-r from-primary to-secondary py-3 text-sm sm:text-base font-bold uppercase tracking-widest text-white shadow-[0_8px_18px_rgba(99,102,241,0.35)] transition hover:opacity-90"
              >
                Play All
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!canSelectCategories) {
                    onRequireCategorySignIn();
                    return;
                  }
                  setStep('filters');
                }}
                className="w-full rounded-md border-2 border-[#6f7a8d] bg-transparent py-3 text-sm sm:text-base font-bold uppercase tracking-widest text-white transition hover:border-white"
              >
                Select Category
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="filters"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="w-full"
          >
            <FilterPicker
              onBack={() => setStep('choice')}
              onSubmit={onSubmitFilters}
              isSubmitting={isSubmitting}
              submitError={submitError}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
