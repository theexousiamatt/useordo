## Add "Confirm Password" to Sign Up

Add a confirm-password field to the Sign Up screen (`src/pages/auth/SignUp.tsx`), matching the uploaded reference where Password and Confirm Password sit side-by-side.

### Changes
- Add `confirm` state alongside the existing `password` state.
- Render Password and Confirm Password in a two-column row (`grid grid-cols-1 sm:grid-cols-2 gap-4`) using the existing `OrdoPasswordInput`. Keep the live strength meter on the Password field only; show an inline "Passwords don't match" error on the Confirm field when it diverges.
- Update submit validation: block submission and show an error if `password !== confirm` (in addition to the existing strength check), before calling `supabase.auth.signUp`.

### Out of scope
- I'll keep the current single-step layout and copy. The reference also shows a "Step 1 of 2" progress bar and "Continue to next step" button — I'm not adding the multi-step flow unless you want it, since you only asked for the confirm-password input.
