-- Migration: add_productsource_htmlhash
-- Adds htmlHash column to ProductSource for HTML change detection caching.

ALTER TABLE "ProductSource" ADD COLUMN "htmlHash" TEXT;
