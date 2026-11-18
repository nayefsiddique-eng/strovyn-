import { NextResponse } from 'next/server';
import { aiAssistantSchema } from '@/lib/security/schemas';
import { checkRateLimit } from '@/lib/security/rateLimiter';

const STRO_SYSTEM_PROMPT = `
You are STRO, Strovyn Painting Co.'s digital assistant ("Your guide to better finishes.").

CONFIRMED COMPANY & SERVICE INFORMATION:
- Business: Strovyn Painting Co. — Adelaide, South Australia (serving Greater Adelaide).
- Confirmed Contact: WhatsApp +61 406 646 061 (https://wa.me/61406646061) and the Quotation Request form (/contact).
- Published Services:
  1. Interior Architectural Painting (precision wall & ceiling finishes, clean junctions, dust-controlled preparation).
  2. Exterior Facade Coatings (protective mineral silicates and weather-resistant exterior systems for South Australian UV conditions).
  3. Fine Cabinetry & Millwork Lacquering (spray-applied 2K polyurethane and satin/velvet joinery finishes).
  4. Artisanal Plasters & Lime Washes (trowelled mineral lime plasters and natural matte wall textures).
  5. Architectural Surface Restoration (substrate repair, planar skim-coating, and surface remediation).
  6. Commercial & Hospitality Finishes (durable low-VOC coatings for retail, hospitality, and gallery spaces).
- Preparation & Process Principles: Substrate assessment, repair/skimming, dust-controlled sanding, directional light checks, and multi-coat application.

STRICT INTEGRITY RULES:
1. NEVER invent or state prices, estimates, hourly rates, availability, business opening hours, warranties, licences, qualifications, insurance details, completed project lists, testimonials, or unconfirmed service areas/policies.
2. If asked for information not confirmed above (such as pricing, scheduling, warranties, licences, or specific opening hours), state honestly that STRO does not have those details and invite the visitor to confirm directly with the Adelaide team via WhatsApp (+61 406 646 061) or the quote form (/contact).
3. Ask 1–2 concise clarifying follow-up questions when a visitor is starting a project enquiry (e.g., interior or exterior, approximate rooms/scope, suburb in Greater Adelaide, surface condition) to help them organise their requirements for /contact.
4. Keep responses concise, calm, architectural, and practical (2–4 sentences).
`;

interface HistoryTurn {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

function buildContextualFallback(message: string, history: HistoryTurn[]): string {
  const q = message.toLowerCase();
  const prevText = history.map((h) => h.content.toLowerCase()).join(' ');
  const combined = `${prevText} ${q}`;

  // 1. Unsupported / prohibited business specifics — honest refusal without inventing
  if (
    /\b(price|cost|quote|how much|rate|per sqm|square meter|budget|cheap|expensive|estimate)\b/.test(q) &&
    !/request a quote|quote process|start a quote/.test(q)
  ) {
    return 'Pricing depends on substrate condition, ceiling heights, and finish specification, so I cannot provide a cost estimate here. To help organise your enquiry for our Adelaide team, is this for an interior or exterior project, and roughly how many rooms or areas are involved? Once ready, you can submit your details on /contact or message us on WhatsApp (+61 406 646 061).';
  }

  if (/\b(hour|open|close|weekend|saturday|sunday|monday|available|appointment|when can|book a time|schedule)\b/.test(q)) {
    return 'I do not have confirmed operating hours or live scheduling availability. Our Adelaide team can confirm consultation timing directly on WhatsApp (+61 406 646 061) or after you submit your project details via /contact.';
  }

  if (/\b(warranty|guarantee|licen[cs]e|insur|abn|policy|policies|refund)\b/.test(q)) {
    return 'I do not have confirmed warranty, licensing, insurance, or policy documentation to share here. Please contact our Adelaide team directly via WhatsApp (+61 406 646 061) or /contact and they will confirm those details for your project.';
  }

  // 2. Contact Strovyn
  if (/\b(contact|whatsapp|phone|call|reach|adelaide|location|where)\b/.test(q)) {
    return 'Strovyn Painting Co. serves Greater Adelaide, South Australia. You can message our team directly on WhatsApp (+61 406 646 061) or submit your project scope through the consultation form at /contact.';
  }

  // 3. Request a Quote / Project Enquiry flow
  if (/\b(quote|enquir|consult|start a project|help me plan|organize|organise)\b/.test(q)) {
    const hasScope = /\b(interior|exterior|cabinet|plaster|commercial|room|bedroom|house|facade|wall|ceiling)\b/.test(q);
    if (!hasScope) {
      return 'I can help you prepare your enquiry before you submit on /contact. To get started: is your project interior, exterior, or cabinetry/joinery, and which suburb in Greater Adelaide is it located in?';
    }
    return 'That gives a clear starting point for our team. If you can also note the approximate scale (such as number of rooms or storeys) and current surface condition, you can submit everything directly at /contact or share it via WhatsApp (+61 406 646 061).';
  }

  // 4. Understand Paint Finishes / Sheen
  if (/\b(finish|sheen|matte|flat|eggshell|satin|gloss|semi-gloss|lime|plaster|venetian|silicate|voc|colour|color)\b/.test(q)) {
    return 'Finish selection balances light behaviour and durability: dead-flat or velvet matte (1–3% sheen) softens raking daylight on ceilings and living-area walls, low-sheen/eggshell suits high-traffic interiors, and satin or catalyzed 2K polyurethane works best on doors, trim, and cabinetry. Which room or surface are you choosing a finish for?';
  }

  // 5. Explore Painting Services
  if (/\b(service|services|what do you do|offer|interior|exterior|cabinet|joinery|millwork|commercial|restoration)\b/.test(q)) {
    if (/\b(cabinet|joinery|millwork|kitchen|lacquer)\b/.test(q)) {
      return 'Strovyn provides fine cabinetry and millwork lacquering using spray-applied 2K polyurethane for smooth satin or velvet finishes on bespoke joinery. Are you refinishing existing cabinetry or specifying new joinery?';
    }
    if (/\b(exterior|facade|outside|render|masonry|cladding)\b/.test(q)) {
      return 'Our exterior facade coatings use breathable mineral silicates and weather-resistant barrier systems suited to South Australian UV exposure. Is your exterior substrate rendered masonry, brick, or timber cladding?';
    }
    return 'Strovyn Painting Co. offers six core disciplines across Greater Adelaide: Interior Architectural Painting, Exterior Facade Coatings, Fine Cabinetry & Millwork Lacquering, Artisanal Plasters & Lime Washes, Architectural Surface Restoration, and Commercial & Hospitality Finishes. Which of these aligns with your project?';
  }

  // 6. Surface Preparation & Process
  if (/\b(prep|preparation|sand|skim|level 5|crack|repair|process|how do you|steps)\b/.test(q)) {
    return 'Every Strovyn project follows a structured preparation sequence: substrate assessment and repair, planar smoothing/skimming where needed, progressive dust-controlled sanding with directional light checks, and multi-coat architectural application. Would you like to prepare an enquiry for an on-site assessment?';
  }

  // 7. Follow-up turn context (e.g. user gave suburb/room count after STRO asked)
  if (
    /\b(quote|enquir|interior|exterior|finish|service)\b/.test(combined) &&
    /\b(bedroom|room|storey|story|adelaide|norwood|unley|burnside|glenelg|hills|wall|ceiling|kitchen|house|home|villa|apartment)\b/.test(q)
  ) {
    return 'Thank you — noting those project details (scope, spaces, and location) will help our team assess the substrate requirements cleanly. You can send these details directly through /contact or start a WhatsApp chat at +61 406 646 061.';
  }

  // 8. General / Out-of-scope honest fallback
  return 'I am STRO, Strovyn’s digital assistant for painting services, surface preparation, paint finishes, and project enquiries in Greater Adelaide. For questions outside those topics—or for specific pricing and scheduling—our team can assist directly via WhatsApp (+61 406 646 061) or at /contact.';
}

export async function POST(req: Request) {
  try {
    // 1. Rate Limiting (15 requests per minute per IP)
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

    // 2. Parse & Zod Validate
    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid request format.' },
        { status: 400 }
      );
    }

    const parseResult = aiAssistantSchema.safeParse(rawBody);
    if (!parseResult.success) {
      const firstError = parseResult.error.issues[0]?.message || 'Invalid query format.';
      return NextResponse.json(
        { success: false, error: firstError },
        { status: 400 }
      );
    }

    const { message, history = [] } = parseResult.data;

    // Sanitize client history: only allow user/assistant turns, map assistant -> model for Gemini
    const cleanHistory: HistoryTurn[] = history
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({
        role: m.role,
        content: m.content.slice(0, 1000),
      }));

    const geminiHistory = cleanHistory.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    const apiKey = process.env.AI_API_KEY;
    const model = process.env.AI_MODEL || 'gemini-2.0-flash';

    // 3. If external Gemini API is configured: pass API key via header 'x-goog-api-key'
    if (apiKey && apiKey.trim().length > 0) {
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
          const aiData = await response.json();
          const generatedText = aiData?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (generatedText) {
            return NextResponse.json({
              success: true,
              connected: true,
              provider: 'gemini',
              message: generatedText,
            });
          }
        } else {
          console.error('Gemini API returned error status:', response.status);
        }
      } catch (e) {
        clearTimeout(timeoutId);
        console.error('External AI API failure, engaging STRO architectural fallback:', e);
      }
    }

    // 4. Contextual Architectural Fallback
    const responseText = buildContextualFallback(message, cleanHistory);

    return NextResponse.json({
      success: true,
      connected: false,
      provider: 'fallback',
      message: responseText,
    });
  } catch (err: unknown) {
    console.error('AI assistant route internal error:', err);
    return NextResponse.json(
      { success: false, error: 'Unable to process inquiry at this moment.' },
      { status: 500 }
    );
  }
}
