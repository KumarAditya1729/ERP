# Operations And Compliance

This document is a practical checklist for school pilots and production onboarding. It is not legal advice.

## Data protection baseline

- Publish a privacy notice for schools, staff, parents, and students.
- Document lawful purpose for each major data category collected by the product.
- Record data retention periods for admissions, attendance, finance, HR, transport, hostel, and audit logs.
- Provide an internal process for access, correction, export, and deletion requests.
- Restrict production support access to named operators with audit logging.
- Disable demo accounts and seed utilities outside explicitly approved internal environments.

## India-specific compliance notes

- The Digital Personal Data Protection Act, 2023 and the Digital Personal Data Protection Rules, 2025 should be reviewed with counsel before go-live because commencement dates are staggered across provisions and rules.
- CERT-In directions require cyber incident readiness, log retention discipline, and a defined reporting process. Treat incident response ownership as a launch blocker, not a future enhancement.
- If the product ever uses Aadhaar or other government-issued identifiers in workflows, get legal approval before collecting or processing them.

## Security operations checklist

- Rotate application secrets on a defined schedule.
- Enforce MFA for all admin and operator accounts.
- Send Sentry alerts to a monitored channel and define severity thresholds.
- Review audit logs regularly for cross-tenant access attempts and billing webhook failures.
- Keep vendor credentials scoped to least privilege.

## Backup and recovery expectations

- Enable daily database backups and point-in-time recovery where available.
- Version uploaded documents in object storage.
- Treat Redis as transient infrastructure, never the only copy of business data.
- Run a restore drill at least once per quarter.
- Set target recovery objectives before onboarding a paying school.

Recommended starting targets:

- RPO: 15 to 60 minutes
- RTO: 4 hours for core academic and finance workflows

## Contracts and rollout pack

Before onboarding a school, prepare:

- privacy notice
- terms of service
- data processing addendum
- support and escalation contacts
- backup and restore statement
- incident notification workflow
- implementation checklist for DNS, billing, and user provisioning
