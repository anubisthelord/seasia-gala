# Project Structure

```
├── public/
│   ├── file.svg
│   ├── globe.svg
│   ├── next.svg
│   ├── vercel.svg
│   └── window.svg
├── src/
│   ├── app/
│   │   ├── (admin)/
│   │   │   └── admin/
│   │   │       ├── dashboard/
│   │   │       ├── partner-verification/
│   │   │       │   ├── page.tsx
│   │   │       │   └── partner-verification-client.tsx
│   │   │       ├── qr-passes/
│   │   │       │   ├── page.tsx
│   │   │       │   └── qr-passes-client.tsx
│   │   │       ├── registrations/
│   │   │       │   ├── [id]/
│   │   │       │   │   └── page.tsx
│   │   │       │   ├── page.tsx
│   │   │       │   └── registrations-client.tsx
│   │   │       ├── scanner/
│   │   │       │   ├── entry-records/
│   │   │       │   │   └── page.tsx
│   │   │       │   └── food-records/
│   │   │       │       ├── food-records-client.tsx
│   │   │       │       └── page.tsx
│   │   │       ├── staff/
│   │   │       │   ├── page.tsx
│   │   │       │   └── staff-client.tsx
│   │   │       └── layout.tsx
│   │   ├── (auth)/
│   │   │   └── admin-login/
│   │   │       └── page.tsx
│   │   ├── (employee)/
│   │   │   ├── register/
│   │   │   │   └── page.tsx
│   │   │   └── layout.tsx
│   │   ├── (scanner)/
│   │   │   ├── entry-scanner/
│   │   │   │   ├── entry-scanner-client.tsx
│   │   │   │   ├── layout.tsx
│   │   │   │   └── page.tsx
│   │   │   └── food-scanner/
│   │   │       ├── food-scanner-client.tsx
│   │   │       ├── layout.tsx
│   │   │       └── page.tsx
│   │   ├── api/
│   │   │   ├── admin/
│   │   │   │   ├── email-domains/
│   │   │   │   │   └── route.ts
│   │   │   │   ├── login/
│   │   │   │   │   └── route.ts
│   │   │   │   ├── logout/
│   │   │   │   │   └── route.ts
│   │   │   │   ├── partner-verification/
│   │   │   │   │   ├── [attendeeId]/
│   │   │   │   │   │   └── document/
│   │   │   │   │   │       └── route.ts
│   │   │   │   │   └── route.ts
│   │   │   │   ├── qr-passes/
│   │   │   │   │   ├── issue/
│   │   │   │   │   │   └── route.ts
│   │   │   │   │   └── route.ts
│   │   │   │   ├── registrations/
│   │   │   │   │   ├── [id]/
│   │   │   │   │   │   ├── audit/
│   │   │   │   │   │   │   └── route.ts
│   │   │   │   │   │   ├── review/
│   │   │   │   │   │   │   └── route.ts
│   │   │   │   │   │   └── route.ts
│   │   │   │   │   └── route.ts
│   │   │   │   ├── scanner/
│   │   │   │   │   ├── entry-records/
│   │   │   │   │   │   └── route.ts
│   │   │   │   │   └── food-records/
│   │   │   │   │       └── route.ts
│   │   │   │   └── staff/
│   │   │   │       ├── [id]/
│   │   │   │       │   └── route.ts
│   │   │   │       └── route.ts
│   │   │   ├── employee/
│   │   │   │   ├── register/
│   │   │   │   │   └── route.ts
│   │   │   │   ├── send-otp/
│   │   │   │   │   └── route.ts
│   │   │   │   └── verify-otp/
│   │   │   │       └── route.ts
│   │   │   ├── health/
│   │   │   │   └── db/
│   │   │   │       └── route.ts
│   │   │   └── scanner/
│   │   │       ├── entry/
│   │   │       │   └── check-in/
│   │   │       │       └── route.ts
│   │   │       └── food/
│   │   │           └── check-in/
│   │   │               └── route.ts
│   │   ├── favicon.ico
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/
│   │   ├── admin/
│   │   │   ├── scanner/
│   │   │   │   └── ScannerRecordsPage.tsx
│   │   │   └── AdminSidebar.tsx
│   │   ├── employee/
│   │   ├── scanner/
│   │   │   └── ScannerHeader.tsx
│   │   └── shared/
│   ├── config/
│   │   └── official-email-domains.ts
│   ├── lib/
│   │   ├── auth/
│   │   │   ├── employee-registration-session.ts
│   │   │   └── session.ts
│   │   ├── scanner/
│   │   │   ├── config.ts
│   │   │   ├── export-csv.ts
│   │   │   ├── record-scan.ts
│   │   │   └── scan-request.ts
│   │   ├── security/
│   │   │   ├── email-domain.ts
│   │   │   ├── otp.ts
│   │   │   └── qr-token.ts
│   │   ├── storage/
│   │   │   └── partner-documents.ts
│   │   ├── validation/
│   │   ├── email.ts
│   │   └── mongodb.ts
│   ├── models/
│   │   ├── Admin.ts
│   │   ├── AdminSession.ts
│   │   ├── Attendee.ts
│   │   ├── EmailDomain.ts
│   │   ├── EmailOtp.ts
│   │   ├── Employee.ts
│   │   ├── PartnerDocument.ts
│   │   ├── QRPass.ts
│   │   ├── Registration.ts
│   │   ├── RegistrationAudit.ts
│   │   └── ScannerScanLog.ts
│   ├── scripts/
│   │   ├── check-database-models.ts
│   │   ├── check-mongodb-capabilities.ts
│   │   ├── create-super-admin.ts
│   │   ├── manage-email-domains.ps1
│   │   ├── test-qr-pass-model.ts
│   │   ├── test-qr-token.ts
│   │   └── test-sendgrid.ts
│   ├── services/
│   └── types/
├── storage/
│   └── private/
│       └── partner-documents/
│           ├── bef9f812-1b20-47a5-9247-af6411ca5450.png
│           └── fb667179-2caa-454e-8312-69cf129fe861.png
├── .gitignore
├── AGENTS.md
├── eslint.config.mjs
├── next-env.d.ts
├── next.config.ts
├── package.json
├── README.md
├── tsconfig.json
└── tsconfig.tsbuildinfo
```
