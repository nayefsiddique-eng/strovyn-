import { NextResponse } from 'next/server';
import { aiAssistantSchema } from '@/lib/security/schemas';
import { readJsonBodyWithLimit } from '@/lib/security/requestLimits';
import {
  checkStroPublicAbuseLimits,
  generateStroConversationalReply,
  type StroHistoryTurn,
} from '@/lib/ai/stroChatService';
import { normalizeStroAssistantText } from '@/lib/ai/stroResponseNormalizer';

export type StroIntent =
  | 'greeting'
  | 'quote'
  | 'pricing_refusal'
  | 'scheduling_refusal'
  | 'policy_refusal'
  | 'visualiser'
  | 'finishes'
  | 'services'
  | 'preparation'
  | 'contact'
  | 'careers'
  | 'projects'
  | 'general';

export interface StroSuggestedAction {
  type: 'open_quote_builder' | 'link' | 'whatsapp';
  label: string;
  href?: string;
  prefillService?: string;
}

interface HistoryTurn {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

function inferServiceFromText(text: string): string | undefined {
  const t = text.toLowerCase();
  if (/\b(cabinet|joinery|millwork|lacquer)\b/.test(t)) return 'Cabinet Refinishing & Spraying';
  if (/\b(exterior|facade|outside|render|masonry|cladding)\b/.test(t)) return 'Exterior Cladding & Facade Protection';
  if (/\b(commercial|heritage|hospitality|retail|office|villa|restor)\b/.test(t)) return 'Commercial & Heritage Painting';
  if (/\b(interior|wall|ceiling|room|bedroom|living|kitchen|plaster|paint)\b/.test(t)) return 'Interior Precision Painting';
  return undefined;
}

function isPurePricingQuestion(q: string): boolean {
  const mentionsCostTerms = /\b(price|pricing|cost|costs|how much|rate|rates|per sqm|square met(?:re|er)|budget|cheap|expensive|fee|fees)\b/.test(q);
  const asksForEstimateNumber = /\b(estimate|estimates|ballpark|rough figure|cost estimate|price range|how expensive)\b/.test(q);
  const asksToRequestQuote = /\b(get a quote|request a quote|start a quote|quote form|book a quote|enquir\w*|consult\w*|site visit|inspect\w*)\b/.test(q);

  if (mentionsCostTerms && !asksToRequestQuote) return true;
  if (asksForEstimateNumber && !asksToRequestQuote) return true;
  if (/\bquote\b/.test(q) && /\b(how much|cost|price|rate|ballpark|cheap|expensive)\b/.test(q)) {
    return true;
  }
  return false;
}

export function classifyStroIntent(
  message: string,
  history: HistoryTurn[] = []
): {
  intent: StroIntent;
  message: string;
  actions: StroSuggestedAction[];
} {
  const q = message.trim().toLowerCase();
  const prevText = history.map((h) => h.content.toLowerCase()).join(' ');
  const combined = `${prevText} ${q}`;
  const inferredService = inferServiceFromText(combined);

  // 0. Simple conversational greeting
  if (
    q.length <= 45 &&
    /^(?:hi|hello|hey|g'day|good\s+(?:morning|afternoon|evening)|howdy)\b[!.,?\s]*(?:stro|there)?[!.,?\s]*$/i.test(q)
  ) {
    return {
      intent: 'greeting',
      message:
        'Hello! I’m STRO, Strovyn’s AI guide for paint finishes, colour selection, and surface preparation in Greater Adelaide. What kind of space or project are you working on?',
      actions: [],
    };
  }

  // 1. Explicit cost/pricing queries -> honest refusal without inventing numbers
  if (isPurePricingQuestion(q)) {
    return {
      intent: 'pricing_refusal',
      message:
        'Pricing depends on substrate condition, ceiling heights, access requirements, and finish specification, so I cannot provide cost estimates or rates here. Our Adelaide team issues itemised written quotations after inspecting your site—would you like to organise your project details for an assessment?',
      actions: [
        { type: 'open_quote_builder', label: 'Organise Quote Request', prefillService: inferredService },
        { type: 'whatsapp', label: 'Ask via WhatsApp' },
      ],
    };
  }

  // 2. Opening hours / live availability (avoids "open-plan", "hours between coats")
  const asksOpeningHours =
    /\b(?:business|studio|office|trading|opening)\s+hours?\b|\bwhat\s+(?:are\s+your\s+)?hours\b|\b(?:open|closed?)\s+(?:on\s+)?(?:weekends?|saturdays?|sundays?|mondays?|public\s+holidays?)\b|\b(?:available\s+)?time\s*slots?\b|\bbook\s+(?:a\s+)?time\b|\bbooking\s+calendar\b/i.test(q) &&
    !/\b(?:open[- ](?:plan|layout|living|concept|space)|hours?\s+(?:between|to\s+dry|dry|cure))\b/i.test(q);

  if (asksOpeningHours) {
    return {
      intent: 'scheduling_refusal',
      message:
        'I do not have confirmed studio opening hours or live calendar availability here. You can arrange an on-site consultation time directly with our Adelaide team on WhatsApp (+61 406 646 061) or by submitting your preferred details via /contact.',
      actions: [
        { type: 'whatsapp', label: 'Confirm Timing on WhatsApp' },
        { type: 'link', label: 'Open Consultation Form', href: '/contact' },
      ],
    };
  }

  // 3. Warranty / Licence / Insurance / Policy specifics
  if (/\b(warrant\w*|guarantee\w*|licen[cs]\w*|insur\w*|abn|policy|policies|refund\w*|terms)\b/.test(q)) {
    return {
      intent: 'policy_refusal',
      message:
        'I do not hold verified warranty, licensing, insurance, or formal policy documentation in this chat. Please confirm any specific tender or regulatory documentation directly with our Adelaide team via WhatsApp (+61 406 646 061) or through /contact.',
      actions: [
        { type: 'whatsapp', label: 'Message Team on WhatsApp' },
        { type: 'link', label: 'Contact Page', href: '/contact' },
      ],
    };
  }

  // 4. Wall Colour Visualiser intent
  if (/\b(visuali[sz]\w*|colour preview\w*|color preview\w*|preview.*wall|upload.*photo|try.*colou?r|test.*wall)\b/.test(q)) {
    return {
      intent: 'visualiser',
      message:
        'Our Wall Colour Visualiser lets you upload a photograph of your room, select the wall area cleanly in your browser, and preview illustrative neutral and mineral finish tones. Because daylight direction and screen calibration vary, physical drawdown samples are always confirmed on site before painting.',
      actions: [
        { type: 'link', label: 'Open Wall Visualiser', href: '/visualiser' },
        { type: 'open_quote_builder', label: 'Request Quote', prefillService: 'Interior Precision Painting' },
      ],
    };
  }

  // 5. Request a Quote / Project Enquiry intent
  if (/\b(quote\w*|enquir\w*|consult\w*|start a project|book.*visit|site visit|inspect\w*|assessment|help me plan|organi[sz]\w*)\b/.test(q)) {
    const hasScope = /\b(interior|exterior|cabinet|joinery|plaster|commercial|heritage|room|bedroom|house|facade|wall|ceiling|kitchen|villa)\b/.test(q);
    if (!hasScope) {
      return {
        intent: 'quote',
        message:
          'I can help organise your project enquiry right here before sending it to our Adelaide team. To start, is your project interior painting, exterior facade work, cabinetry/joinery, or artisanal plaster—and which Greater Adelaide suburb is it in?',
        actions: [
          { type: 'open_quote_builder', label: 'Start Guided Quote Brief' },
          { type: 'link', label: 'Go to Full Form (/contact)', href: '/contact' },
        ],
      };
    }

    return {
      intent: 'quote',
      message:
        'Thank you—that gives a clear starting scope. If you can also share approximate room counts, ceiling height, or existing surface condition, you can send your brief right from this assistant, attach plans on /contact, or discuss it directly on WhatsApp (+61 406 646 061).',
      actions: [
        { type: 'open_quote_builder', label: 'Send Guided Quote Brief', prefillService: inferredService },
        { type: 'link', label: 'Attach Plans on /contact', href: '/contact' },
        { type: 'whatsapp', label: 'Discuss on WhatsApp' },
      ],
    };
  }

  // 6. Careers / Employment intent (avoids "paint job", "how long will the job take")
  const asksCareers =
    /\b(?:careers?|join\s+(?:the\s+)?team|employment|apprentices?|internships?|job\s+(?:openings?|vacanc(?:y|ies)|opportunities?|applications?)|work\s+for\s+strovyn|painter\s+positions?)\b/i.test(q) &&
    !/\b(?:paint\s+jobs?|interior\s+job|exterior\s+job|quote\s+for\s+the\s+job|how\s+long\s+(?:will|does)\s+the\s+job|finish\s+the\s+job)\b/i.test(q);

  if (asksCareers) {
    return {
      intent: 'careers',
      message:
        'Strovyn welcomes Expressions of Interest from experienced architectural painters and cabinetry spray technicians across Adelaide. You can review current discipline prerequisites and upload your CV securely on /careers.',
      actions: [{ type: 'link', label: 'Explore Careers', href: '/careers' }],
    };
  }

  // 7. Portfolio / Completed Projects intent
  if (/\b(project|projects|portfolio|gallery|example|past work|case stud)\b/.test(q)) {
    return {
      intent: 'projects',
      message:
        'You can view our completed Adelaide residential and architectural finish studies in our /projects portfolio, or compare before-and-after preparation standards on the homepage.',
      actions: [{ type: 'link', label: 'View Portfolio', href: '/projects' }],
    };
  }

  // 8a. Australian Solar Orientation (North/South/East/West-facing rooms)
  if (/\b(north[- ]facing|south[- ]facing|east[- ]facing|west[- ]facing|orientation|natural light|sunlight)\b/.test(q)) {
    return {
      intent: 'finishes',
      message:
        'In Adelaide (Southern Hemisphere), north-facing rooms receive the most direct, warm sunlight across the day—especially in winter when the sun sits lower in the northern sky—making paint colours read warmer and brighter.\n\n- **North-facing:** Balanced or slightly cooler neutrals prevent warm creams from looking overly yellow.\n- **South-facing:** Softer, cooler indirect light suits warmer neutrals that add gentle warmth.\n- **East & West:** East rooms brighten in the morning, while west rooms receive strong afternoon glare.\n\nBecause eaves, glazing tint, and LED colour temperature also shift undertones, always test physical sample boards on the wall at different times of day.',
      actions: [
        { type: 'link', label: 'Preview Tones in Visualiser', href: '/visualiser' },
      ],
    };
  }

  // 8b. Level 4 vs Level 5 Plasterboard (AS/NZS 2589)
  if (/\b(level\s*4|level\s*5|as\/nzs\s*2589|skim\s*coat)\b/.test(q)) {
    return {
      intent: 'preparation',
      message:
        'Under Australian plasterboard standard AS/NZS 2589, **Level 4** is the standard residential finish (taped joints with three coats of compound) suited to flat or low-sheen wall paints in normal lighting.\n\n**Level 5** adds a thin skim coat across the entire plasterboard surface to equalise texture and porosity between the paper face and recessed joints. It is recommended where harsh raking light—such as floor-to-ceiling windows, skylights, or wall-washing downlights—or higher-sheen wall paints would otherwise highlight joint banding. For Strovyn projects, Level 5 skimming is a specialised specification quoted when lighting and plans require it.',
      actions: [
        { type: 'link', label: 'Our Methodology (/about)', href: '/about' },
        { type: 'open_quote_builder', label: 'Request On-Site Assessment', prefillService: 'Interior Precision Painting' },
      ],
    };
  }

  // 8c. Paint Finishes / Sheen / Kitchen Paint
  if (/\b(finish|finishes|sheen|matte|flat|eggshell|satin|gloss|semi-gloss|lime|plaster|venetian|silicate|voc|colour|color|marmorino|kitchen)\b/.test(q)) {
    if (/\bkitchen\b/.test(q) && !/\b(matte|velvet)\b/.test(q)) {
      return {
        intent: 'finishes',
        message:
          'For kitchen spaces, finish selection depends on the surface:\n\n- **Walls & Ceilings:** A washable **low-sheen or satin moisture-resistant acrylic** resists cooking steam, grease, and frequent wiping without harsh glare.\n- **Doors, Trim & Skirting:** **Waterborne acrylic-polyurethane satin or semi-gloss enamel** offers non-yellowing scuff protection.\n- **Cabinetry & Joinery:** Where specified, spray-applied **2K polyurethane** provides a hard, chemical-resistant surface.\n\nAre you repainting kitchen walls and trim, or refinishing cabinetry as well?',
        actions: [
          { type: 'link', label: 'Open Wall Visualiser', href: '/visualiser' },
          { type: 'open_quote_builder', label: 'Start Quote Brief', prefillService: inferredService },
        ],
      };
    }

    if (/\bmatte\b/.test(q) && /\bsatin\b/.test(q)) {
      return {
        intent: 'finishes',
        message:
          '**Matte** and **satin** finishes balance light diffusion against cleanability:\n\n- **Matte (1–5% sheen):** Absorbs light to soften minor wall irregularities and deliver a calm, velvety look. Ideal for ceilings, bedrooms, and formal living spaces, though it requires gentle blotting with a damp microfibre cloth when cleaning.\n- **Satin (25–35% sheen):** Reflects a soft pearl lustre and withstands frequent wiping, moisture, and knocks. Best suited to kitchens, bathrooms, hallways, doors, and architectural trim.\n\nFor many Adelaide living areas, a washable **low-sheen or eggshell** sits neatly between the two.',
        actions: [
          { type: 'link', label: 'Preview Tones in Visualiser', href: '/visualiser' },
        ],
      };
    }

    return {
      intent: 'finishes',
      message:
        'Finish selection balances daylight reflection and daily wear:\n\n- **Ultra-flat & Matte:** Soften raking light across ceilings and low-traffic bedrooms.\n- **Low-Sheen & Eggshell:** Add washable everyday durability for living rooms and hallways.\n- **Satin / Semi-Gloss Enamel & 2K Polyurethane:** Protect doors, skirting, wet zones, and joinery.\n\nWhich room or surface are you planning?',
      actions: [
        { type: 'link', label: 'Preview Tones in Visualiser', href: '/visualiser' },
        { type: 'open_quote_builder', label: 'Enquire About a Finish', prefillService: inferredService },
      ],
    };
  }

  // 9. Surface Preparation & Process
  if (/\b(prep|preparation|sand|crack|repair|process|how do you|steps|dust|hepa|masking)\b/.test(q)) {
    return {
      intent: 'preparation',
      message:
        'Thorough surface preparation typically follows four structured stages:\n\n1. **Cleaning & Diagnostics:** Degreasing surfaces, checking moisture levels, and masking floors and fixtures.\n2. **Substrate Repairs:** Filling dents, bridging hairline cracks, and scraping loose or flaking paint.\n3. **Dust-Controlled Sanding:** Progressive HEPA-extracted sanding to level repairs and key glossy surfaces.\n4. **Spot & Full Priming:** Sealing bare plaster, timber, or stains before applying two even topcoats.',
      actions: [
        { type: 'open_quote_builder', label: 'Request On-Site Assessment', prefillService: inferredService },
        { type: 'link', label: 'Our Methodology (/about)', href: '/about' },
      ],
    };
  }

  // 10. Painting Services Overview
  if (/\b(service|services|what do you do|offer|interior|exterior|cabinet|joinery|millwork|commercial|restoration|heritage)\b/.test(q)) {
    if (/\b(cabinet|joinery|millwork|lacquer)\b/.test(q)) {
      return {
        intent: 'services',
        message:
          'Our Fine Cabinetry & Millwork service covers degreasing, mechanical key sanding, high-build adhesion priming, and controlled spray application to help minimise brush or roller marks. Are you refinishing existing kitchen joinery or specifying built-in robes?',
        actions: [
          { type: 'link', label: 'Cabinetry Service Specs', href: '/services/fine-cabinetry-millwork' },
          { type: 'open_quote_builder', label: 'Organise Cabinetry Quote', prefillService: 'Cabinet Refinishing & Spraying' },
        ],
      };
    }
    if (/\b(exterior|facade|outside|render|masonry|cladding)\b/.test(q)) {
      return {
        intent: 'services',
        message:
          'Our Exterior Facade Restoration service uses breathable mineral silicates and UV-resilient exterior membranes suited to South Australian conditions. Is your facade rendered masonry, heritage stone, brick, or timber cladding?',
        actions: [
          { type: 'link', label: 'Exterior Service Specs', href: '/services/exterior-facade-restoration' },
          { type: 'open_quote_builder', label: 'Organise Exterior Quote', prefillService: 'Exterior Cladding & Facade Protection' },
        ],
      };
    }
    return {
      intent: 'services',
      message:
        'Strovyn Painting Co. delivers six disciplines across Greater Adelaide: Interior Architectural Painting, Exterior Facade Restoration, Fine Cabinetry & Millwork, Artisanal Plasters & Lime Washes, Historic Heritage Conservation, and Commercial Finishes. Which area matches your project?',
      actions: [
        { type: 'link', label: 'All Services', href: '/services' },
        { type: 'open_quote_builder', label: 'Request a Quote', prefillService: inferredService },
      ],
    };
  }

  // 11a. Service-Area Boundaries: Stirling, Adelaide Hills & Outer Suburbs
  if (/\b(stirling|adelaide hills|mount barker|crafers|aldgate|outer suburbs?|regional sa|fleurieu|barossa)\b/i.test(q)) {
    return {
      intent: 'contact',
      message:
        'Strovyn operates primarily across Greater Adelaide, South Australia. Availability for specific outer suburbs or the Adelaide Hills (such as Stirling or Mount Barker) requires direct confirmation with our Adelaide team via WhatsApp (+61 406 646 061) or /contact.',
      actions: [
        { type: 'whatsapp', label: 'Confirm Hills Availability on WhatsApp' },
        { type: 'link', label: 'Go to /contact', href: '/contact' },
      ],
    };
  }

  // 11b. General Contact Details / Location Inquiry
  const asksContactOrLocation =
    /\b(?:contact\s+(?:strovyn|you|team|details|info)|phone\s+number|call\s+you|how\s+(?:can|do)\s+i\s+(?:contact|reach)|where\s+are\s+you\s+located|where\s+is\s+strovyn|what\s+(?:areas?|suburbs?)\s+do\s+you\s+(?:service|serve|paint))\b/i.test(q);

  if (asksContactOrLocation) {
    return {
      intent: 'contact',
      message:
        'Strovyn Painting Co. serves Greater Adelaide, South Australia. You can reach our team directly on WhatsApp (+61 406 646 061) or send your project plans and scope through /contact.',
      actions: [
        { type: 'whatsapp', label: 'WhatsApp +61 406 646 061' },
        { type: 'link', label: 'Go to /contact', href: '/contact' },
      ],
    };
  }

  // 12. Conversational Follow-up Context
  if (
    /\b(quote|enquir|interior|exterior|finish|service|cabinet|plaster|assess)\b/.test(combined) &&
    /\b(bedroom|room|storey|story|adelaide|norwood|unley|burnside|glenelg|hills|wall|ceiling|kitchen|house|home|villa|apartment|crafers|stirling|prospect|walkerville|henley|brighton)\b/.test(q)
  ) {
    return {
      intent: 'quote',
      message:
        'Noted—having your location and spaces in mind makes it straightforward for our estimating team to prepare an on-site check. You can submit these project details right here, upload drawings at /contact, or message us via WhatsApp (+61 406 646 061).',
      actions: [
        { type: 'open_quote_builder', label: 'Complete Quote Handoff', prefillService: inferredService },
        { type: 'whatsapp', label: 'Send via WhatsApp' },
      ],
    };
  }

  // 13. Honest General Fallback
  return {
    intent: 'general',
    message:
      'I’m STRO, Strovyn Painting Co.’s AI assistant for Adelaide painting services, finish selection, surface preparation, the /visualiser tool, and project enquiries. How can I help with your painting questions today?',
    actions: [
      { type: 'open_quote_builder', label: 'Start Quote Enquiry' },
      { type: 'link', label: 'Explore Services', href: '/services' },
    ],
  };
}

function buildErrorResponse(errorMessage: string, status: number) {
  return NextResponse.json(
    {
      success: false,
      error: errorMessage,
      reply: {
        role: 'assistant' as const,
        content: errorMessage,
      },
    },
    { status }
  );
}

export async function POST(req: Request) {
  try {
    const contentType = req.headers.get('content-type') || '';
    if (!contentType.toLowerCase().includes('application/json')) {
      return buildErrorResponse('Unsupported content type. Expected application/json.', 415);
    }

    // 1. Enforce Raw Request Size Limit (32 KB) & Parse JSON
    const bodyResult = await readJsonBodyWithLimit(req, 32 * 1024);
    if (!bodyResult.ok) {
      return buildErrorResponse(bodyResult.error || 'Invalid request format.', bodyResult.status || 400);
    }

    const parseResult = aiAssistantSchema.safeParse(bodyResult.data);
    if (!parseResult.success) {
      const firstError = parseResult.error.issues[0]?.message || 'Invalid query format.';
      return buildErrorResponse(firstError, 400);
    }

    const { message, history = [], sessionId, website } = parseResult.data;

    // 2. Bot/Honeypot & Spam Guard
    if (website && website.trim().length > 0) {
      return buildErrorResponse('Invalid submission.', 400);
    }
    if (/(.)\1{24,}/.test(message)) {
      return buildErrorResponse('Please enter a valid question for STRO.', 400);
    }

    // 3. Cross-Instance Rate Limiting & Daily Usage Protection
    const clientIp =
      req.headers.get('x-nf-client-connection-ip')?.trim() ||
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      'local-client';

    const abuseCheck = await checkStroPublicAbuseLimits({ clientIp, sessionId });
    if (!abuseCheck.allowed) {
      return buildErrorResponse(
        abuseCheck.reason ||
          'Too many requests in a short period. Please wait a moment before sending another message.',
        429
      );
    }

    // 4. Sanitize & normalize client history (strips serialized JSON objects if any existed)
    const cleanHistory: StroHistoryTurn[] = history
      .filter((m): m is { role: 'user' | 'assistant'; content: string } =>
        m.role === 'user' || m.role === 'assistant'
      )
      .slice(-10)
      .map((m) => {
        if (m.role === 'assistant') {
          const normalized = normalizeStroAssistantText(m.content);
          return {
            role: 'assistant' as const,
            content: (normalized.ok ? normalized.content : '').slice(0, 900),
          };
        }
        return {
          role: 'user' as const,
          content: m.content.slice(0, 600),
        };
      })
      .filter((m) => m.content.trim().length > 0);

    // 5. Classify intent for contextual fallback & suggested action chips
    const classified = classifyStroIntent(message, cleanHistory);

    const result = await generateStroConversationalReply({
      message,
      history: cleanHistory,
      fallbackMessage: classified.message,
      fallbackActions: classified.actions,
    });

    if (!result.success) {
      const status =
        result.errorCode === 'CONCURRENCY_LIMIT'
          ? 429
          : result.errorCode === 'PROVIDER_TIMEOUT'
            ? 504
            : 502;
      return buildErrorResponse(result.message, status);
    }

    // Consistent customer-facing contract:
    // - `reply: { role: 'assistant', content }` provides structured role+content envelope
    // - `message: string` maintains compatibility with existing string consumers
    // - Internal provider/model identifiers are omitted from public HTTP output
    return NextResponse.json({
      success: true,
      reply: {
        role: 'assistant' as const,
        content: result.message,
      },
      message: result.message,
      intent: classified.intent,
      actions: result.actions,
    });
  } catch (err: unknown) {
    console.error('AI assistant route internal error:', err instanceof Error ? err.message : 'Unknown error');
    return buildErrorResponse(
      'STRO could not process your question right now. Please try again in a moment or contact our Adelaide team on WhatsApp (+61 406 646 061).',
      500
    );
  }
}
