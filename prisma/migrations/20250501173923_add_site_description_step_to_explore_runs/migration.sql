-- AlterTable
ALTER TABLE "explore_runs" ADD COLUMN     "siteDescription" TEXT,
ADD COLUMN     "steps" JSONB,
ADD COLUMN     "stepsSummary" JSONB;
