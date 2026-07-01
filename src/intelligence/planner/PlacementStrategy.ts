import { PlacementInput, PlacementResult } from './types';

export type { PlacementInput, PlacementResult };

/**
 * Placement algorithm contract.
 * Implementations: LocalPlacementStrategy (default), GeminiPlacementStrategy (AI + fallback).
 */
export interface PlacementStrategy {
  place(input: PlacementInput): PlacementResult | Promise<PlacementResult>;
}
