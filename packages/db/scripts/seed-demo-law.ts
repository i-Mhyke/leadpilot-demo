import { neon } from "@neondatabase/serverless";

const DEMO_SERVICES = [
  {
    name: "Startup Advisory",
    slug: "startup-advisory",
    description: "Company formation, founder agreements, and early-stage commercial support.",
    visitor_examples: ["We're raising a seed round", "Need help setting up a Nigerian startup"],
    qualification_questions: ["Is the company already incorporated?", "What stage is the raise?"],
    urgency_signals: ["term sheet deadline", "investor closing date"],
    routing_group: "corporate",
  },
  {
    name: "Privacy and Data Protection",
    slug: "privacy-data-protection",
    description: "NDPR compliance, privacy policies, and data processing agreements.",
    visitor_examples: ["NDPR audit", "Privacy policy for our app"],
    qualification_questions: ["Do you process personal data in Nigeria?", "Are you a controller or processor?"],
    urgency_signals: ["regulator inquiry", "breach notification"],
    routing_group: "regulatory",
  },
  {
    name: "Corporate Commercial",
    slug: "corporate-commercial",
    description: "Commercial contracts, vendor agreements, and transaction support.",
    visitor_examples: ["Reviewing a vendor contract", "SAFE note questions"],
    qualification_questions: ["Is this pre- or post-signature?", "Who is the counterparty?"],
    urgency_signals: ["signing this week", "dispute risk"],
    routing_group: "corporate",
  },
  {
    name: "Intellectual Property",
    slug: "intellectual-property",
    description: "Trademark, copyright, and IP protection for technology businesses.",
    visitor_examples: ["Trademark filing", "Protecting our brand"],
    qualification_questions: ["What assets need protection?", "Any existing filings?"],
    urgency_signals: ["infringement notice", "launch date"],
    routing_group: "ip",
  },
  {
    name: "Technology and Innovation",
    slug: "technology-innovation",
    description: "Technology transactions, platform terms, and innovation policy matters.",
    visitor_examples: ["SaaS terms of service", "API licensing"],
    qualification_questions: ["What is the product model?", "Any cross-border users?"],
    urgency_signals: ["product launch", "partner integration deadline"],
    routing_group: "technology",
  },
  {
    name: "Regulatory Compliance and Filings",
    slug: "regulatory-compliance",
    description: "Licensing, regulatory filings, and compliance advisory.",
    visitor_examples: ["Fintech licensing", "CAC filings"],
    qualification_questions: ["Which regulator is involved?", "Current licensing status?"],
    urgency_signals: ["filing deadline", "regulator meeting"],
    routing_group: "regulatory",
  },
] as const;

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }

  const sql = neon(databaseUrl);

  const firms = await sql<{ id: string }[]>`
    INSERT INTO firms (name, slug, industry, jurisdiction, website_url, status)
    VALUES (
      'E&C Legal',
      'demo-law',
      'legal',
      'Nigeria',
      'https://eandclegal.africa/',
      'active'
    )
    ON CONFLICT (slug) DO UPDATE SET updated_at = now()
    RETURNING id
  `;
  const firmId = firms[0]!.id;

  await sql`
    INSERT INTO firm_booking_policies (firm_id)
    VALUES (${firmId})
    ON CONFLICT (firm_id) DO NOTHING
  `;

  await sql`
    INSERT INTO firm_pricing_policies (firm_id, can_discuss_fees, requires_human_for_fee_questions)
    VALUES (${firmId}, false, true)
    ON CONFLICT (firm_id) DO NOTHING
  `;

  await sql`
    INSERT INTO firm_agent_tone_profiles (firm_id, preferred_greeting, signature_disclaimer)
    VALUES (
      ${firmId},
      'Hi, I''m the intake assistant for E&C Legal. Tell me what you''re working through, and I''ll help you understand the next step.',
      'I''m an assistant, not a lawyer. I can share general guidance, but a practitioner will need your specific facts before giving advice.'
    )
    ON CONFLICT (firm_id) DO UPDATE SET
      preferred_greeting = EXCLUDED.preferred_greeting,
      signature_disclaimer = EXCLUDED.signature_disclaimer,
      updated_at = now()
  `;

  for (const service of DEMO_SERVICES) {
    await sql`
      INSERT INTO firm_services (
        firm_id, name, slug, description, visitor_examples,
        qualification_questions, urgency_signals, routing_group
      )
      VALUES (
        ${firmId},
        ${service.name},
        ${service.slug},
        ${service.description},
        ${JSON.stringify(service.visitor_examples)},
        ${JSON.stringify(service.qualification_questions)},
        ${JSON.stringify(service.urgency_signals)},
        ${service.routing_group}
      )
      ON CONFLICT (firm_id, slug) DO UPDATE SET
        description = EXCLUDED.description,
        visitor_examples = EXCLUDED.visitor_examples,
        updated_at = now()
    `;
  }

  console.log(`Seeded demo firm demo-law (${firmId}) with ${DEMO_SERVICES.length} services.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
