# INCA Variable Studio

A local browser tool for reviewing and updating `INCAvar` values in an ETAS INCA `.prj` using names declared in an `.a2l` file.

## Start

1. Install Node.js 24 or later.
2. In this folder, run `npm ci`.
3. Run `npm run dev:local` and open `http://127.0.0.1:5173/`.
4. Add a `.prj` and `.a2l`, select **Analyze files**, review the proposed values, and download the revised project.

The files are analyzed in your browser. The original files are not overwritten.

## Matching and edits

- Replacement names come from actual A2L `MEASUREMENT` declarations. The tool accepts an exact name, case-only match, a `SYMBOL_LINK` alias, or a close match that shares the name stem after a common INCA suffix such as `_out` or `_IRV`.
- If several declared names match, one is randomly selected for each DID and reused for duplicate records of that DID with the same stem. The selection shown in the review is the one written to the download.
- If no declared name matches, that record stays unchanged. Records without an editable `INCAvar` value also stay unchanged.
- ECU-TEST's editor displays string expressions inside single quotes. Its PRJ XML stores the name without those quote characters, so the download writes the bare name. The review shows the quoted editor form.
- The app changes only the contents of `INCAvar` value elements. It checks that all text outside those values remains identical before allowing the download. Projects must be UTF-8 so this can be verified byte for byte.

## Check the app

Run `npm run typecheck`, `npm run test:prj`, and `npm run build`.
