# Legacy Checkpoint Template

## Checkpoint ID

<!-- Example: legacy-to-v1.5.0 -->

## Supported Source Range

<!-- Example: v1.0.0 - v1.4.x -->

## Target Baseline

<!-- Example: v1.5.0 -->

## Main Architectural Differences

<!-- Describe the major changes between the source range and target baseline -->
<!-- Example: -->
<!-- - Migration from Express to NestJS -->
<!-- - Introduction of MikroORM -->
<!-- - New OpenAPI generator architecture -->

## High-Risk Areas

<!-- Areas that require careful attention during migration -->
<!-- Example: -->
<!-- - Database schema changes -->
<!-- - Authentication flow modifications -->
<!-- - Custom middleware compatibility -->

## Applicability Checks

<!-- Explicit checks to determine if this checkpoint applies -->
<!-- Example: -->
<!-- - Project version is between v1.0.0 and v1.4.x -->
<!-- - Project uses the old module structure -->

## Manual Decisions Required

<!-- List decisions that require human input -->
<!-- Example: -->
<!-- - Whether to keep custom authentication logic -->
<!-- - Database migration strategy selection -->

## Reference Paths

<!-- Key files to compare between source and target -->
<!-- Example: -->
<!-- - `apps/api/src/` - Main API structure -->
<!-- - `packages/` - Shared packages architecture -->

## Suggested AI Workflow

<!-- Ordered steps for the AI agent -->
<!-- Example: -->
<!-- 1. Review architectural differences -->
<!-- 2. Assess project divergence in high-risk areas -->
<!-- 3. Apply structural changes incrementally -->
<!-- 4. Validate each major change -->

## Validation Strategy

<!-- How to verify the migration succeeded -->
<!-- Example: -->
<!-- - `pnpm lint` passes -->
<!-- - `pnpm typecheck` passes -->
<!-- - `pnpm build` succeeds -->
<!-- - API starts without errors -->
