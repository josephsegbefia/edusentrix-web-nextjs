/**
 * Clerk `<SignUp />` appearance tokens aligned with `src/app/sign-in/[[...sign-in]]/page.tsx`.
 */

export const signUpInputClass =
  "h-12 w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-sm text-white outline-none transition-all duration-200 placeholder:text-white/30 focus:border-brand focus:bg-white/[0.07] focus:ring-2 focus:ring-brand/20 focus:shadow-[0_0_20px_rgba(14,165,233,0.1)] disabled:cursor-not-allowed disabled:opacity-50";

export const signUpOtpInputClass =
  "h-14 w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-center font-mono text-lg tracking-[0.45em] text-white outline-none transition-all duration-200 placeholder:text-white/20 focus:border-brand focus:bg-white/[0.07] focus:ring-2 focus:ring-brand/20 focus:shadow-[0_0_20px_rgba(14,165,233,0.1)] disabled:cursor-not-allowed disabled:opacity-50";

export const signUpPrimaryButtonClass =
  "inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-brand px-4 text-sm font-semibold text-black shadow-lg shadow-brand/25 transition-all duration-200 hover:bg-sky-300 hover:shadow-brand/40 hover:scale-[1.01] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50";

export const signUpSocialButtonClass =
  "group flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3.5 text-left text-sm text-white/82 transition-all duration-200 hover:border-white/20 hover:bg-white/10 hover:shadow-lg hover:shadow-black/20";

export const signUpAppearanceElements = {
  rootBox: "w-full",
  card: "bg-transparent shadow-none border-0 p-0 gap-6",
  headerTitle: "hidden",
  headerSubtitle: "hidden",
  main: "gap-6",
  formHeaderTitle:
    "text-2xl font-semibold tracking-tight text-white sm:text-[1.65rem]",
  formHeaderSubtitle: "text-sm leading-6 text-white/60",
  formFieldLabel:
    "text-[11px] font-semibold uppercase tracking-[0.22em] text-white/45",
  formFieldInput: signUpInputClass,
  formFieldInputShowPasswordButton:
    "text-white/40 transition-colors hover:text-white/80",
  formFieldRow: "gap-5",
  formFieldSuccessText: "text-xs text-emerald-300",
  formFieldHintText: "text-xs text-white/45",
  formFieldErrorText: "text-xs text-red-300",
  formButtonPrimary: signUpPrimaryButtonClass,
  formButtonReset:
    "text-sm font-medium text-white/55 hover:text-white underline-offset-4 hover:underline",
  footer: "hidden",
  footerAction: "text-center",
  footerActionText: "text-sm text-white/50",
  footerActionLink: "text-brand font-medium hover:text-sky-300",
  socialButtonsRoot: "gap-3",
  socialButtonsBlockButton: signUpSocialButtonClass,
  socialButtonsBlockButtonText: "text-sm font-medium text-white",
  dividerRow: "my-2",
  dividerLine: "bg-white/10",
  dividerText: "text-[11px] font-semibold uppercase tracking-[0.2em] text-white/35",
  identityPreview: "rounded-2xl border border-white/10 bg-white/5 p-4",
  identityPreviewText: "text-sm text-white/85",
  identityPreviewEditButton:
    "text-brand text-sm font-medium hover:text-sky-300",
  formResendCodeLink: "text-brand text-sm font-medium hover:text-sky-300",
  otpCodeFieldInputs: "gap-3",
  otpCodeFieldInput: signUpOtpInputClass,
  alternativeMethodsBlockButton: signUpSocialButtonClass,
  formFieldInputGroup: "gap-3",
  navbar: "hidden",
  navbarButtons: "hidden",
  scrollBox: "rounded-2xl",
  alertText: "rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-100",
  formFieldInfoText: "text-xs text-white/45",
  spinner: "text-brand",
  userPreview: "rounded-2xl border border-white/10 bg-white/[0.04] p-4",
  userPreviewTextContainer: "text-white",
  userPreviewMainIdentifier: "text-base font-semibold text-white",
  userButtonPopoverCard: "border border-white/10 bg-card text-white",
  userButtonPopoverActionButton: "text-white hover:bg-white/10",
} as const;
