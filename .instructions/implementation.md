# Implementation Discipline

## Pre-Implementation Checklist
- Identify affected files
- Map integration points and risks
- Design minimal change path
- Confirm root cause

## Execution Rules
- Smallest valid diff
- Follow existing conventions
- Preserve formatting
- Add minimal comments only
- Include validation steps

## Post-Implementation
- Validate architecture consistency
- Check regressions
- Verify edge cases
- Confirm no unintended side effects

Never:
- Perform large refactors in one change
- Edit unrelated files
- Introduce dependencies without justification
