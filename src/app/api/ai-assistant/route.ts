import { NextResponse } from 'next/server';
import { aiAssistantSchema } from '@/lib/security/schemas';
import { checkRateLimit } from '@/lib/security/rateLimiter';
import { readJsonBodyWithLimit } from '@/lib/security/requestLimits';

export type StroIntent =
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

const STRO_SYSTEM_PROMPT = `
You are STRO, Strovyn Painting Co.'s digital assistant ("Your guide to better finishes.").

CONFIRMED COMPANY & SERVICE INFORMATION:
- Business: Strovyn Painting Co. — Adelaide, South Australia (serving Greater Adelaide).
- Confirmed Contact: WhatsApp +61 406 646 061 (https://wa.me/61406646061) and the Quotation Request form (/contact).
- Interactive Tools:
  - Wall Colour Visualiser (/visualiser): browser-based preview where visitors can upload a room photo (processed locally in the browser), test illustrative wall finishes/sheens, and send their chosen finish directly into /contact or WhatsApp. Digital previews are illustrative only due to lighting and screen variance.
  - Portfolio (/projects), Insights (/insights), Careers Expression of Interest (/careers).
- Published Services (/services):
  1. Interior Architectural Painting (precision wall & ceiling finishes, clean junctions, dust-controlled preparation).
  2. Exterior Facade Restoration & Coatings (protective mineral silicates and weather-resistant exterior systems for South Australian UV conditions).
  3. Fine Cabinetry & Millwork Lacquering (spray-applied 2K polyurethane and satin/velvet joinery finishes).
  4. Artisanal Plasters & Lime Washes (trowelled mineral lime plasters and natural matte wall textures).
  5. Historic & Heritage Conservation (substrate preservation, period molding repair, breathable mineral finishes).
  6. Commercial & Hospitality Finishes (durable low-VOC coatings for retail, hospitality, and gallery spaces).
- Preparation & Process Principles: Substrate assessment, repair/skimming, dust-controlled sanding, directional light checks, and multi-coat architectural application.

STRICT INTEGRITY RULES:
1. NEVER invent or state prices, estimates, hourly rates, availability, business opening hours, warranties, licences, qualifications, insurance details, unconfirmed completed project counts, fake testimonials, or unconfirmed policies.
2. If asked for information not confirmed above (such as pricing, scheduling/opening hours, warranties, licences, or insurance), state honestly that STRO does not have those details and invite the visitor to confirm directly with the Adelaide team via WhatsApp (+61 406 646 061) or the quote form (/contact).
3. Ask 1–2 concise clarifying follow-up questions when a visitor is starting a project enquiry (e.g., interior or exterior, approximate rooms/scope, suburb in Greater Adelaide, surface condition) to help them organise their requirements for /contact.
4. Keep responses concise, calm, architectural, and practical (2–4 sentences).
`;

interface HistoryTurn {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

function inferServiceFromText(text: string): string | undefined {
  const t = text.toLowerCase();
  if (/\b(cabinet|joinery|millwork|kitchen|lacquer)\b/.test(t)) return 'Cabinet Refinishing & Spraying';
  if (/\b(exterior|facade|outside|render|masonry|cladding)\b/.test(t)) return 'Exterior Cladding & Facade Protection';
  if (/\b(commercial|heritage|hospitality|retail|office|villa|restor)\b/.test(t)) return 'Commercial & Heritage Painting';
  if (/\b(interior|wall|ceiling|room|bedroom|living|plaster|paint)\b/.test(t)) return 'Interior Precision Painting';
  return undefined;
}

function isPurePricingQuestion(q: string): boolean {
  const mentionsCostTerms = /\b(price|pricing|cost|costs|how much|rate|rates|per sqm|square met(?:re|er)|budget|cheap|expensive|fee|fees)\b/.test(q);
  const asksForEstimateNumber = /\b(estimate|estimates|ballpark|rough figure|cost estimate|price range|how expensive)\b/.test(q);
  const asksToRequestQuote = /\b(get a quote|request a quote|start a quote|quote form|book a quote|enquir\w*|consult\w*|site visit|inspect\w*)\b/.test(q);

  if (mentionsCostTerms && !asksToRequestQuote) return true;
  if (asksForEstimateNumber && !asksToRequestQuote) return true;
  // Standalone "how much for a quote?" asks price
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

  // 2. Opening hours / live availability
  if (/\b(hour|hours|open|opening|close|closing|weekend|saturday|sunday|monday|available|availability|when can|time slot|schedule)\b/.test(q)) {
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
        'Our Wall Colour Visualiser lets you upload a photograph of your room, select the wall area cleanly in your browser (without auto-uploading your image), and preview illustrative neutral and mineral finish tones. Because daylight direction and screen calibration vary, physical drawdown samples are always confirmed on site before painting.',
      actions: [
        { type: 'link', label: 'Open Wall Visualiser', href: '/visualiser' },
        { type: 'open_quote_builder', label: 'Request Quote', prefillService: 'Interior Precision Painting' },
      ],
    };
  }

  // 5. Request a Quote / Project Enquiry intent (explicitly separate from pricing refusal!)
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

  // 6. Careers / Employment intent
  if (/\b(career|careers|job|jobs|hire|hiring|apprentice|apply|work for strovyn|employment|painter position)\b/.test(q)) {
    return {
      intent: 'careers',
      message:
        'Strovyn welcomes Expressions of Interest from experienced architectural painters and cabinetry spray technicians across Adelaide. You can review current discipline prerequisites and upload your CV securely on our Careers page.',
      actions: [{ type: 'link', label: 'Explore Careers', href: '/careers' }],
    };
  }

  // 7. Portfolio / Completed Projects intent
  if (/\b(project|projects|portfolio|gallery|example|past work|case stud)\b/.test(q)) {
    return {
      intent: 'projects',
      message:
        'You can view our completed Adelaide Residence work alongside architectural finish studies in our Projects portfolio, or compare before-and-after preparation standards on the homepage.',
      actions: [{ type: 'link', label: 'View Portfolio', href: '/projects' }],
    };
  }

  // 8. Paint Finishes / Sheen / Plaster Chemistry
  if (/\b(finish|finishes|sheen|matte|flat|eggshell|satin|gloss|semi-gloss|lime|plaster|venetian|silicate|voc|colour|color|marmorino)\b/.test(q)) {
    return {
      intent: 'finishes',
      message:
        'Finish selection balances daylight reflection and daily wear: ultra-flat and velvet matte (1–3% sheen) soften harsh raking light across walls and ceilings, low-sheen/eggshell adds cleanable durability in hallways, and catalyzed 2K polyurethane or satin enamel protects doors, trim, and cabinetry. Which room or substrate are you planning?',
      actions: [
        { type: 'link', label: 'Preview Tones in Visualiser', href: '/visualiser' },
        { type: 'open_quote_builder', label: 'Enquire About a Finish', prefillService: inferredService },
      ],
    };
  }

  // 9. Surface Preparation & Process
  if (/\b(prep|preparation|sand|skim|level 5|crack|repair|process|how do you|steps|dust|hepa|masking)\b/.test(q)) {
    return {
      intent: 'preparation',
      message:
        'Every Strovyn commission follows structured substrate preparation: moisture and planar diagnostics, targeted repairs or full skim passes where needed, progressive dust-controlled HEPA sanding, directional raking-light checks, and calibrated topcoats. Would you like to arrange an on-site assessment?',
      actions: [
        { type: 'open_quote_builder', label: 'Request On-Site Assessment', prefillService: inferredService },
        { type: 'link', label: 'Our Methodology (/about)', href: '/about' },
      ],
    };
  }

  // 10. Painting Services Overview
  if (/\b(service|services|what do you do|offer|interior|exterior|cabinet|joinery|millwork|commercial|restoration|heritage)\b/.test(q)) {
    if (/\b(cabinet|joinery|millwork|kitchen|lacquer)\b/.test(q)) {
      return {
        intent: 'services',
        message:
          'We provide Fine Cabinetry & Millwork Lacquering using spray-applied 2K polyurethane and fine-finish satin or velvet systems inside controlled containment zones. Are you refinishing existing joinery or specifying new cabinetry?',
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
          'Our Exterior Facade Restoration & Coatings service uses breathable mineral silicates and UV-resilient elastomeric systems engineered for South Australian weather exposure. Is your facade rendered masonry, brick, or timber cladding?',
        actions: [
          { type: 'link', label: 'Exterior Service Specs', href: '/services/exterior-facade-restoration' },
          { type: 'open_quote_builder', label: 'Organise Exterior Quote', prefillService: 'Exterior Cladding & Facade Protection' },
        ],
      };
    }
    return {
      intent: 'services',
      message:
        'Strovyn Painting Co. delivers six architectural disciplines across Greater Adelaide: Interior Architectural Painting, Exterior Facade Restoration, Fine Cabinetry & Millwork Lacquering, Artisanal Plasters & Lime Washes, Historic Heritage Conservation, and Commercial Finishes. Which discipline matches your scope?',
      actions: [
        { type: 'link', label: 'All Services', href: '/services' },
        { type: 'open_quote_builder', label: 'Request a Quote', prefillService: inferredService },
      ],
    };
  }

  // 11. Contact Strovyn / Service Area
  if (/\b(contact|whatsapp|phone|call|reach|adelaide|location|where|suburb|south australia)\b/.test(q)) {
    return {
      intent: 'contact',
      message:
        'Strovyn Painting Co. serves Greater Adelaide, South Australia. You can reach our team directly on WhatsApp (+61 406 646 061) or send your project plans and scope through our Consultation Portal at /contact.',
      actions: [
        { type: 'whatsapp', label: 'WhatsApp +61 406 646 061' },
        { type: 'link', label: 'Go to /contact', href: '/contact' },
      ],
    };
  }

  // 12. Conversational Follow-up Context (e.g. suburb/scale reply after scoping question)
  if (
    /\b(quote|enquir|interior|exterior|finish|service|cabinet|plaster|assess)\b/.test(combined) &&
    /\b(bedroom|room|storey|story|adelaide|norwood|unley|burnside|glenelg|hills|wall|ceiling|kitchen|house|home|villa|apartment|crafers|stirling|prospect|walkerville|henley|brighton)\b/.test(q)
  ) {
    return {
      intent: 'quote',
      message:
        'Noted—having your location and spaces in mind makes it straightforward for our estimating team to prepare an on-site check. You can submit these project details cleanly right here, upload drawings at /contact, or message them via WhatsApp (+61 406 646 061).',
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
      'I am STRO, Strovyn Painting Co.’s digital assistant for Adelaide painting services, finish guidance, surface preparation, the Wall Colour Visualiser, and project enquiries. For direct quotes or specific project timing, message us on WhatsApp (+61 406 646 061) or use /contact.',
    actions: [
      { type: 'open_quote_builder', label: 'Start Quote Enquiry' },
      { type: 'link', label: 'Explore Services', href: '/services' },
    ],
  };
}

export async function POST(req: Request) {
  try {
    // 1. Persistent Rate Limiting (15 requests per minute per IP)
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'local-client';
    const rateCheck = await checkRateLimit(`ai_${clientIp}`, 15, 60000);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: 'Too many requests in a short period. Please wait a moment before sending another message.',
        },
        { status: 429 }
      );
    }

    // 2. Enforce Raw Request Size Limit (32 KB) & Parse JSON
    const bodyResult = await readJsonBodyWithLimit(req, 32 * 1024);
    if (!bodyResult.ok) {
      return NextResponse.json(
        { success: false, error: bodyResult.error || 'Invalid request format.' },
        { status: bodyResult.status || 400 }
      );
    }

    const parseResult = aiAssistantSchema.safeParse(bodyResult.data);
    if (!parseResult.success) {
      const firstError = parseResult.error.issues[0]?.message || 'Invalid query format.';
      return NextResponse.json(
        { success: false, error: firstError },
        { status: 400 }
      );
    }

    const { message, history = [] } = parseResult.data;

    // Sanitize client history: only allow user/assistant turns
    const cleanHistory: HistoryTurn[] = history
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({
        role: m.role,
        content: m.content.slice(0, 1000),
      }));

    // Classify intent cleanly upfront for suggested contextual actions (and deterministic fallback)
    const classified = classifyStroIntent(message, cleanHistory);

    const apiKey = process.env.AI_API_KEY;
    const model = process.env.AI_MODEL || 'gemini-2.0-flash';

    // 3. Optional External Gemini API with timeout & defensive JSON handling
    if (apiKey && apiKey.trim().length > 0) {
      const geminiHistory = cleanHistory.map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      try {
        const geminiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

        const response = await fetch(geminiEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey.trim(),
          },
          signal: controller.signal,
          body: JSON.stringify({
            systemInstruction: {
              parts: [{ text: STRO_SYSTEM_PROMPT }],
            },
            contents: [
              ...geminiHistory,
              {
                role: 'user',
                parts: [{ text: message }],
              },
            ],
            generationConfig: {
              temperature: 0.2,
              maxOutputTokens: 350,
            },
          }),
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          const aiData = await response.json().catch(() => null);
          const candidate = aiData?.candidates?.[0];
          const generatedText = candidate?.content?.parts?.[0]?.text;
          if (typeof generatedText === 'string' && generatedText.trim().length > 0) {
            return NextResponse.json({
              success: true,
              connected: true,
              provider: 'gemini',
              intent: classified.intent,
              actions: classified.actions,
              message: generatedText.trim(),
            });
          }
        } else {
          console.error('Gemini API returned error status:', response.status);
        }
      } catch (e) {
        clearTimeout(timeoutId);
        console.error('External AI API failure, engaging STRO contextual fallback:', e);
      }
    }

    // 4. Contextual Architectural Fallback
    return NextResponse.json({
      success: true,
      connected: false,
      provider: 'fallback',
      intent: classified.intent,
      actions: classified.actions,
      message: classified.message,
    });
  } catch (err: unknown) {
    console.error('AI assistant route internal error:', err instanceof Error ? err.message : 'Unknown error');
    return NextResponse.json(
      { success: false, error: 'Unable to process inquiry at this moment.' },
      { status: 500 }
    );
  }
}
