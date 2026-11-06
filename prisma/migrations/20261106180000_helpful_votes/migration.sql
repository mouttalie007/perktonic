-- "Was this guide helpful?" votes reuse the reaction counters.
ALTER TYPE "ReactionEmoji" ADD VALUE IF NOT EXISTS 'HELPFUL';
ALTER TYPE "ReactionEmoji" ADD VALUE IF NOT EXISTS 'NOT_HELPFUL';
