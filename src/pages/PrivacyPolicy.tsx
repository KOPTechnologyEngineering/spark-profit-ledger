import { Link } from "react-router-dom";
import { ArrowLeft, TrendingUp } from "lucide-react";
import PageMeta from "@/components/PageMeta";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="font-heading text-lg font-semibold text-foreground">{title}</h2>
      <div className="space-y-2 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}

export default function PrivacyPolicy() {
  return (
    <main className="min-h-screen bg-background px-4 py-12">
      <PageMeta
        title="Privacy Policy | KOP Ledger"
        description="How KOP Ledger collects, uses, and protects your data."
        path="/privacy"
      />
      <div className="mx-auto max-w-2xl space-y-8">
        <div className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
            <TrendingUp className="h-6 w-6 text-primary-foreground" />
          </div>
          <h1 className="mt-4 font-heading text-3xl font-bold text-foreground">Privacy Policy</h1>
          <p className="mt-1 text-sm text-muted-foreground">Last updated 21 July 2026</p>
        </div>

        <div className="glass-card space-y-6 p-8">
          <Section title="Who we are">
            <p>
              KOP Ledger is an accounting and bookkeeping tool for startups and SMEs, operated by KOP Technology
              ("we", "us"). This policy explains what personal data we collect when you use KOP Ledger, why, and
              what rights you have over it.
            </p>
          </Section>

          <Section title="What we collect">
            <p><strong className="text-foreground">Account data:</strong> your name, email address, and password (your password is hashed by our authentication provider — we never see or store it in plain text).</p>
            <p><strong className="text-foreground">Business data you enter:</strong> transactions, invoices, VAT records, PAYE payroll data (employee names, designations, salary and tax/NI figures), and organization/customer/vendor contact details.</p>
            <p><strong className="text-foreground">Usage data:</strong> sign-in timestamps and approval/audit history, so admins can see who changed what.</p>
          </Section>

          <Section title="Why we collect it">
            <p>
              To provide the bookkeeping service you or your organization signed up for (performance of a
              contract), and, for financial records specifically, to help meet UK accounting record-keeping
              obligations (a legal obligation under the Companies Act 2006). We do not use your data for
              advertising and do not sell it to third parties.
            </p>
          </Section>

          <Section title="Who we share it with">
            <p>
              <strong className="text-foreground">Supabase</strong> hosts our database, authentication, and file
              storage, and processes data on our behalf under its own data processing terms.
            </p>
            <p>
              <strong className="text-foreground">Our transactional email provider</strong> sends account
              notifications (welcome, approval status, password reset) and invoice chase reminders on our behalf,
              from the <code className="rounded bg-secondary px-1 py-0.5 text-xs">kopledger.koptechnology.com</code> domain.
              <strong className="text-foreground"> Lovable</strong> provisions the underlying domain/nameserver
              infrastructure this mail is sent through, as a sub-processor of that pipeline.
            </p>
            <p>We don't share your data with anyone else, and never for marketing purposes.</p>
          </Section>

          <Section title="Data about people who aren't KOP Ledger users">
            <p>
              An organization using KOP Ledger may enter personal data about people who don't hold an account
              themselves and can't sign in to manage it directly — for example a payroll employee's name and
              salary details, or a customer/vendor contact's name and email. That data is processed by the
              organization as part of running its accounts, under the same legal bases described above.
            </p>
            <p>
              If you're one of these people and want to access, correct, or request erasure of data held about
              you, contact the organization's KOP Ledger administrator (see "How to exercise your rights" below) —
              they can look up and action your request directly in the app on your behalf.
            </p>
          </Section>

          <Section title="How long we keep it">
            <p>
              Your account data is kept for as long as your account is active. If your account is deleted, we
              remove your personal identity (name, email, credentials) entirely — unless your account has linked
              financial records (invoices, transactions, payroll entries) that we're legally required to retain;
              in that case we anonymize your identity on those records rather than deleting them, so the
              underlying financial record can still meet statutory retention requirements.
            </p>
          </Section>

          <Section title="Your rights">
            <p>Under UK/EU data protection law, you have the right to:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>Access the personal data we hold about you</li>
              <li>Correct inaccurate data (most fields are editable directly in the app)</li>
              <li>Export your data (CSV export is available throughout the app)</li>
              <li>Request erasure of your account (see "How long we keep it" above for what this means in practice)</li>
              <li>Object to or restrict certain processing</li>
            </ul>
          </Section>

          <Section title="How to exercise your rights">
            <p>
              If you're part of an organization using KOP Ledger, your organization's administrator can action
              most requests directly from User Management, including account deletion. If you are an
              administrator, or need to reach us directly about your data, contact{" "}
              <span className="text-foreground">[your organization's KOP Ledger administrator or data protection contact]</span>.
            </p>
          </Section>

          <Section title="Technical and diagnostic logs">
            <p>
              To keep the service reliable we record technical logs of activity in the app: the date and time,
              the action or page requested, whether it succeeded, how long it took, your account email, and the
              IP address and browser the request came from. Errors are recorded with technical detail so we can
              diagnose them.
            </p>
            <p>
              These logs are used only to operate, secure and troubleshoot the service — never for marketing or
              profiling. They are visible only to your organization's administrators, are automatically deleted
              after the retention period configured by your administrator (30 days by default), and we
              deliberately exclude passwords and authentication tokens from them.
            </p>
          </Section>

          <Section title="Cookies and local storage">
            <p>
              We don't use advertising or tracking cookies. We use your browser's local storage only to keep you
              signed in between visits (an authentication token), which is strictly necessary for the app to
              function.
            </p>
          </Section>

          <Section title="Changes to this policy">
            <p>If this policy changes, we'll update the date at the top of this page.</p>
          </Section>
        </div>

        <div className="text-center">
          <Link to="/auth" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
            <ArrowLeft className="h-3 w-3" /> Back to sign in
          </Link>
        </div>
      </div>
    </main>
  );
}
