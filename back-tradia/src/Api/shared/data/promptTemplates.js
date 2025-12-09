module.exports = [
  {
    key: "patents",
    label: "Patents",
    description: "Patent filings, claims, abstracts, PCT responses.",
    version: 1,
    prompt:
      "Act as a bilingual patent attorney. Translate the document preserving every claim number, reference numeral, and formal tone. Maintain \"Claim\" headings, section titles, and avoid interpreting inventive scope. For terms without a direct translation, keep the original term in parentheses.",
    glossary: [
      { source: "claim", target: "reivindicación" },
      { source: "embodiment", target: "realización" },
      { source: "wherein", target: "en el que" },
      { source: "comprising", target: "que comprende" },
    ],
    styleGuidance: [
      "Use present tense and neutral, formal language.",
      "Preserve numbering, paragraph spacing, and reference signs.",
      "Do not add explanations; mirror the legal precision of the source.",
    ],
    examples: [
      {
        source: "Claim 1. A method for controlling an autonomous vehicle comprising:",
        translation:
          "Reivindicación 1. Un procedimiento para controlar un vehículo autónomo que comprende:",
      },
      {
        source: "The invention further provides a computer-readable medium storing instructions.",
        translation:
          "La invención proporciona adicionalmente un medio legible por ordenador que almacena instrucciones.",
      },
    ],
  },
  {
    key: "customs",
    label: "Customs",
    description: "Customs rulings, tariff classifications, import/export notices.",
    version: 1,
    prompt:
      "You are a customs compliance specialist. Translate using trade, tariff, and logistics terminology. Cite HS codes exactly as written and keep measurement units. Maintain the formal notice tone.",
    glossary: [
      { source: "tariff heading", target: "partida arancelaria" },
      { source: "customs broker", target: "agente aduanal" },
      { source: "bonded warehouse", target: "depósito fiscal" },
      { source: "clearance", target: "despacho" },
    ],
    styleGuidance: [
      "Keep regulatory references (HS, CFR, EU) unchanged.",
      "Use concise sentences similar to administrative rulings.",
      "Maintain passive voice when present in the source.",
    ],
    examples: [
      {
        source:
          "The goods are classified under tariff heading 9027.10.40 as gas analysis apparatus.",
        translation:
          "Las mercancías se clasifican bajo la partida arancelaria 9027.10.40 como aparatos para análisis de gases.",
      },
      {
        source:
          "Release is conditional upon presentation of the sanitary certificate at clearance.",
        translation:
          "La liberación queda condicionada a la presentación del certificado sanitario durante el despacho.",
      },
    ],
  },
  {
    key: "contracts",
    label: "Contracts",
    description: "Commercial agreements, NDAs, service contracts.",
    version: 1,
    prompt:
      "Translate as a contract lawyer. Preserve defined terms with consistent capitalization, mirror numbering, and keep shall/shall not constructions. Ensure the result can be executed without additional editing.",
    glossary: [
      { source: "hereinafter", target: "en lo sucesivo" },
      { source: "witnesseth", target: "atestigua" },
      { source: "severability", target: "divisibilidad" },
      { source: "governing law", target: "legislación aplicable" },
    ],
    styleGuidance: [
      "Keep long sentences intact but ensure clarity.",
      "Do not translate party names; keep them as defined.",
      "Respect uppercase emphasis for defined terms.",
    ],
    examples: [
      {
        source:
          "This Agreement shall commence on the Effective Date and shall continue for an initial term of two (2) years.",
        translation:
          "El presente Contrato entrará en vigor en la Fecha de Entrada en Vigor y continuará durante un plazo inicial de dos (2) años.",
      },
      {
        source: "Each Party shall comply with all Applicable Laws.",
        translation: "Cada Parte cumplirá con todas las Leyes Aplicables.",
      },
    ],
  },
  {
    key: "judgements",
    label: "Judgements",
    description: "Court decisions, appellate opinions, orders.",
    version: 1,
    prompt:
      "Translate as a judicial translator. Keep citations intact, respect procedural terminology, and reflect the persuasive style of the issuing court. Maintain paragraph numbering and headings.",
    glossary: [
      { source: "holding", target: "fallo" },
      { source: "obiter dictum", target: "obiter dictum" },
      { source: "injunction", target: "medida cautelar" },
      { source: "remand", target: "devolver para nueva consideración" },
    ],
    styleGuidance: [
      "Preserve formal register and third-person narration.",
      "Do not simplify Latinisms or case citations.",
      "Mirror emphasis (italics/uppercase) used in the source.",
    ],
    examples: [
      {
        source: "The Court hereby grants the preliminary injunction requested by the Plaintiff.",
        translation:
          "El Tribunal concede por la presente la medida cautelar preliminar solicitada por la Parte Actora.",
      },
      {
        source: "Accordingly, the judgment of the lower court is reversed and remanded.",
        translation:
          "En consecuencia, se revoca la sentencia del tribunal inferior y se devuelve para nueva consideración.",
      },
    ],
  },
  {
    key: "administrative",
    label: "Administrative",
    description: "Administrative rulings, agency notices, compliance reports.",
    version: 1,
    prompt:
      "You are translating administrative determinations. Emphasize procedural clarity, cite regulations verbatim, and keep the neutral bureaucratic tone. Highlight deadlines and obligations as in the source.",
    glossary: [
      { source: "filing", target: "presentación" },
      { source: "notice of deficiency", target: "requerimiento por deficiencia" },
      { source: "compliance unit", target: "unidad de cumplimiento" },
      { source: "oversight", target: "supervisión" },
    ],
    styleGuidance: [
      "Prefer impersonal constructions (e.g., \"se dispone\").",
      "Keep bullet lists and tables intact.",
      "Always include dates in ISO format unless specified otherwise.",
    ],
    examples: [
      {
        source:
          "The compliance unit shall issue a notice of deficiency within ten (10) business days.",
        translation:
          "La unidad de cumplimiento emitirá un requerimiento por deficiencia dentro de diez (10) días hábiles.",
      },
      {
        source: "Failure to respond may result in administrative sanctions.",
        translation: "La falta de respuesta podrá resultar en sanciones administrativas.",
      },
    ],
  },
  {
    key: "trademarks",
    label: "Trademarks",
    description: "Trademark applications, office actions, oppositions.",
    version: 1,
    prompt:
      "Translate as an IP specialist focused on marks. Preserve mark spellings, Nice classes, and examiner references. Keep persuasive tone when addressing office actions.",
    glossary: [
      { source: "specimen", target: "muestra de uso" },
      { source: "likelihood of confusion", target: "probabilidad de confusión" },
      { source: "word mark", target: "marca denominativa" },
      { source: "figurative mark", target: "marca figurativa" },
    ],
    styleGuidance: [
      "Keep class numbers and Nice headings as provided.",
      "Do not translate registered marks; use uppercase formatting.",
      "Clarify persuasive arguments with concise sentences mirroring source structure.",
    ],
    examples: [
      {
        source:
          "Applicant submits that the cited mark differs phonetically and conceptually from the applied-for mark.",
        translation:
          "El Solicitante sostiene que la marca citada difiere fonéticamente y conceptualmente de la marca solicitada.",
      },
      {
        source:
          "Class 35: retail store services featuring eco-friendly household goods.",
        translation:
          "Clase 35: servicios de tienda minorista que ofrecen artículos domésticos ecológicos.",
      },
    ],
  },
];
