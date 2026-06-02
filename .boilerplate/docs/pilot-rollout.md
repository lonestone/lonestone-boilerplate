# Pilot Rollout Guide

## Overview

This guide describes how to validate the AI-assisted boilerplate upgrade workflow on a real project before broader adoption.

## Prerequisites

- At least one release with reviewed migration intentions
- A consumer project created from the boilerplate
- Access to the boilerplate CLI (`pnpm boilerplate`)
- An AI agent capable of executing migration intentions (e.g., Claude, Cursor, Copilot)

## Pilot Project Selection

Choose a project that:
- Was created from an older boilerplate version (ideally v1.0.0 or earlier)
- Has some divergence from the boilerplate (custom features, modifications)
- Is not critical production (safe to experiment)
- Has a representative feature set (API, frontend, etc.)

## Pilot Workflow

### Step 1: Initialize Tracking

```bash
cd /path/to/pilot-project
pnpm boilerplate upgrade init --project .
```

This creates `boilerplate.json` with the project's current state.

**Observe:**
- Was source version detection correct?
- Are tracked domains appropriate for this project?

### Step 2: Check Current Status

```bash
pnpm boilerplate upgrade status --project .
```

**Observe:**
- Does the status accurately reflect the project state?
- Are there any existing applied/skipped intentions?

### Step 3: Resolve Upgrade Path

```bash
pnpm boilerplate upgrade path --to 1.6.0 --project .
```

**Observe:**
- Is the upgrade path reasonable?
- Are legacy checkpoints used if the project is old?
- Are the pending intentions relevant to this project?

### Step 4: Prepare Upgrade Context

```bash
# Ensure clean worktree
git status --porcelain
# Should be empty

pnpm boilerplate upgrade prepare --project . --to 1.6.0
```

**Observe:**
- Does `.boilerplate/` directory get created correctly?
- Is `upgrade-session.md` clear and actionable?
- Are reference files present and useful?

### Step 5: Execute AI Agent

Provide the AI agent with:
- Access to the `.boilerplate/` directory
- The `upgrade-session.md` file
- Permission to make changes and commits

**Agent workflow:**
1. Agent reads `.boilerplate/upgrade-session.md`
2. For each intention:
   - Reads the intention file
   - Checks applicability
   - Applies changes if applicable
   - Runs validation
   - Commits the change
   - Updates `boilerplate.json`

**Observe:**
- Did the agent preserve project-specific behavior?
- Were intentions precise enough?
- Did the agent stop appropriately when needed?
- Were commits atomic and clear?

### Step 6: Review Results

```bash
# Check commit history
git log --oneline upgrade/v1.0.0-to-v1.6.0

# Check status
pnpm boilerplate upgrade status --project .

# Review changes
git diff main..upgrade/v1.0.0-to-v1.6.0
```

**Observe:**
- Are the changes correct and minimal?
- Did validation pass?
- Is `boilerplate.json` updated correctly?
- Can reviewers understand what changed and why?

### Step 7: Create PR (Optional)

If the upgrade looks good:

```bash
git push origin upgrade/v1.0.0-to-v1.6.0
# Create PR for review
```

## Observation Checklist

### Source Version Detection

- [ ] Detection was correct
- [ ] Confidence level was appropriate
- [ ] Manual confirmation worked well

### Upgrade Path

- [ ] Path was explainable and logical
- [ ] Checkpoints helped (if applicable)
- [ ] Domain filtering worked correctly
- [ ] Applied/skipped intentions were respected

### Migration Intentions

- [ ] Intentions were precise enough
- [ ] Applicability checks were clear
- [ ] Stop conditions were useful
- [ ] Reference files were helpful
- [ ] Validation steps were appropriate

### Agent Execution

- [ ] Agent preserved project-specific behavior
- [ ] Changes were minimal and safe
- [ ] Commits were atomic
- [ ] Agent stopped when appropriate
- [ ] Skipped intentions had clear reasons

### Validation and Reporting

- [ ] Validation caught issues (if any)
- [ ] Status reports were useful
- [ ] Blocked reports were actionable
- [ ] Final summary was comprehensive

### Git Workflow

- [ ] Clean worktree check worked
- [ ] Upgrade branch created correctly
- [ ] One commit per intention
- [ ] No automatic push/merge
- [ ] Partial success preserved safely

## Common Issues and Solutions

### Issue: Agent overwrites project-specific code

**Solution:** Improve intention's "Do not apply when" section and add explicit preservation instructions.

### Issue: Validation fails on project-specific setup

**Solution:** Make validation checks conditional or add project-specific validation overrides.

### Issue: Too many intentions for large version gaps

**Solution:** Use legacy checkpoints to reduce the number of steps.

### Issue: Intentions not applicable to project

**Solution:** Improve domain filtering and applicability checks in intentions.

## Feedback Collection

After the pilot, collect feedback on:

1. **Time to complete**: How long did the full upgrade take?
2. **Confidence level**: How confident was the team in the changes?
3. **Manual intervention**: How many intentions required manual work?
4. **Value delivered**: Were the upgrades worth the effort?
5. **Pain points**: What was frustrating or unclear?

## Next Steps

Based on pilot results:

1. **Improve intentions**: Refine unclear or problematic intentions
2. **Update templates**: Adjust templates based on learnings
3. **Enhance CLI**: Add missing features or improve UX
4. **Document patterns**: Capture successful patterns for future upgrades
5. **Plan broader rollout**: Gradually expand to more projects

## Success Criteria

The pilot is successful if:

- [ ] The workflow completes without data loss
- [ ] Project-specific behavior is preserved
- [ ] Validation passes after upgrade
- [ ] Team understands and trusts the process
- [ ] Clear improvements are identified for next iteration
