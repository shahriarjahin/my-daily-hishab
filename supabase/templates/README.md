# Hishab registration email

Subject: **Confirm your email · Hishab**

Template: [confirm-signup.html](confirm-signup.html)

Prepared for Supabase Authentication → Emails → Confirm sign up. The project currently uses Supabase's default mail service, which locks template editing. The owner selected preparing the template without configuring SMTP.

After setting up custom SMTP with a verified sender, paste this HTML into the Source editor, set the subject above, preview it, and save. Preserve every `{{ .ConfirmationURL }}` placeholder: Supabase inserts the real confirmation link. Never replace it with the website address. The logo uses the existing public Hishab asset. Test a new registration email after deployment; previously sent messages do not change.
