# FacilityFlow — Fix & Restore Task

IMPORTANT: Work ONLY inside the `Facility Service App` folder.

- Treat `Facility Service App` as the ONLY source/project folder.
- Do NOT search, copy, import, or use files from any other folder/project.
- All application-related files must remain inside `Facility Service App`.
- Do not create application files outside this folder.
- Before changing anything, inspect the existing project structure and source files.
- If files/features from the previous implementation are missing, restore/recreate them FIRST using the existing project/Git history if available. Do not look in other folders.

## 1. RESTORE THE UI

My previous FacilityFlow UI used the "Earth + Industrial" design.

Restore it consistently across the application.

Use:
- Deep Pine: `#173F38`
- Terracotta: `#B9553D`
- Burnt Clay hover: `#96432F`
- Warm Sand background: `#F3EFE7`
- Warm Ivory cards: `#FFFDF8`
- Muted Brass: `#C9A66B`
- Charcoal text: `#172522`
- Sage gray: `#66736D`
- Warm gray borders: `#DED8CC`

UI direction:
- Premium professional B2B operations SaaS
- Dark pine collapsible sidebar
- Warm sand main background
- Ivory cards
- Terracotta primary actions
- Inter/Geist + Lucide icons
- 10–14px radius
- Subtle shadows/borders
- Clean, modern, distinctive
- Responsive/mobile friendly

DO NOT revert to:
- Plain white background + white cards
- Blue/purple SaaS colors
- Generic admin dashboard
- Neon colors
- Excessive gradients/glassmorphism

Check `global.css` and existing UI components first and restore the intended design rather than creating an unrelated new design.

## 2. FIX EXISTING APP ISSUES

After restoring the UI, run and inspect the application.

Fix these known problems:

### Dashboard
Dashboard previously showed:
"Unable to load"

Find the actual cause and fix the complete flow:
Frontend → API → Backend → Database.

Dashboard must load real data or proper zero/empty states.

Do NOT hide the error with fake/hardcoded data.

### Service Requests
Creating a Service Request previously failed.

Fix the complete flow:
Form → validation → API → backend → database → UI update.

A newly created request must actually be saved and displayed.

Do not bypass authentication, RBAC, validation, or database logic.

## 3. IMPORTANT RULES

- Do not rebuild the whole application.
- Do not change the architecture unnecessarily.
- Do not add new features.
- Do not create fake production data.
- Do not replace working functionality.
- Do not modify unrelated modules unless required to fix the issues.
- Preserve the existing FacilityFlow MVP.
- Keep all application files inside `Facility Service App`.

Prioritize:
1. Restore UI/design system
2. Fix Dashboard
3. Fix Service Request creation
4. Verify everything works

Before finishing, test the affected functionality and report:
- Files changed
- Problems found
- Root causes
- Fixes made
- Verification performed
- Any remaining errors