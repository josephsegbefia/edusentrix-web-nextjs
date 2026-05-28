export const SUBSCRIPTION_BILLING_GUIDE_SECTIONS = [
  {
    title: "How EduSentrix subscription coverage works",
    body:
      "EduSentrix bills schools in academic term units. Termly billing covers one term. Annual billing covers three consecutive terms, which may cross into the next academic year if the school buys annual coverage in Term 2 or Term 3.",
  },
  {
    title: "Annual billing example",
    body:
      "If a school buys annual billing in Term 2, the subscription covers Term 2, Term 3, and Term 1 of the next academic year. If the school has not created all academic periods, EduSentrix stores estimated billing terms and links them to real academic periods later when available.",
  },
  {
    title: "Minimum fee and per-student pricing",
    body:
      "For each term, EduSentrix compares active students multiplied by the plan's per-student term fee against the plan minimum term fee. The higher amount is used. Annual billing multiplies that term amount by three, then applies any annual discount.",
  },
  {
    title: "Upgrade calculations",
    body:
      "Upgrades unlock immediately after payment. EduSentrix calculates the unused value of the current paid coverage as a credit, calculates the target plan value for the same remaining coverage window, and invoices only the difference due now.",
  },
  {
    title: "Downgrades and cadence changes",
    body:
      "Downgrades are scheduled for the next renewal boundary. Same-tier changes from termly to annual are also scheduled from the next term, so the current paid term remains intact. No automatic refund is issued for downgrades.",
  },
  {
    title: "Worked example",
    body:
      "Enterprise at GHS 25 per student per term with a GHS 2,500 minimum term fee and 65 active students: 65 x GHS 25 = GHS 1,625, which is below the GHS 2,500 minimum. Annual billing is GHS 2,500 x 3 = GHS 7,500. With a 10% annual discount, the final annual charge is GHS 6,750.",
  },
];

export const SUBSCRIPTION_BILLING_GUIDE_TITLE = "EduSentrix Subscription Billing Guide";
