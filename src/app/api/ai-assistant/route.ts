import { NextResponse } from 'next/server';
import { aiAssistantSchema } from '@/lib/security/schemas';
import { checkRateLimit } from '@/lib/security/rateLimiter';

const STROVYN_AI_SYSTEM_PROMPT = `
You are VYN, the Project Guide for Strovyn Painting Co. (https://strovyn.com/).

COMPANY PROFILE & SERVICE FOCUS:
- Premium residential and architectural painting based in Adelaide, South Australia.
- Core Disciplines: Interior Precision, Exterior Facade Restoration, Cabinet Refinishing & Joinery, Artisanal Lime Washes & Plasters, Historic Conservation.
- Standards: Substrate diagnostics, zero-tolerance surface preparation, dust-controlled mechanical sanding, hand-cut lines, low-VOC coatings, and formal daylight sign-off before handover.
- Free on-site consultation across Greater Adelaide.

STRICT OPERATING PRINCIPLES:
1. ONLY discuss topics relating to:
   - Architectural and residential painting
   - Surface preparation and substrate diagnosis
   - Interior finishes, woodwork lacquering, exterior cladding
   - Low-VOC mineral paints and daylight inspection sign-offs
   - Booking an on-site consultation via the Quote Request form (/contact) or WhatsApp
2. STRICT PROHIBITIONS:
   - NEVER invent or state specific company prices, quotes, or hourly rates. Always direct users to submit their project details on /contact for a free Adelaide on-site assessment.
   - NEVER invent or confirm specific company registration numbers, builder licences, or guarantees that are unverified.
   - NEVER invent client history or fabricated partner relationships.
   - If asked about non-painting topics, politely steer the conversation back to architectural coatings.

Tone: Professional, measured, craft-focused, concise.
`;

export async function POST(req: Request) {
  try {
    // 1. Rate Limiting (15 requests per minute per IP)
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'local-client';
    const rateCheck = await checkRateLimit(`ai_${clientIp}`, 15, 60000);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: 'Rate limit exceeded. Please wait a moment before sending more queries.',
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
        { success: false, error: 'Invalid JSON request format.' },
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

    const { message, history } = parseResult.data;

    // Sanitize client history: ignore any injected system roles, only allow legitimate assistant/user turns
    const sanitizedHistory = (history || [])
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({
        role: m.role,
        parts: [{ text: m.content.slice(0, 1000) }],
      }));

    const apiKey = process.env.AI_API_KEY;
    const model = process.env.AI_MODEL || 'gemini-2.0-flash';

    // 3. If external Gemini API is configured: pass API key via header 'x-goog-api-key' (NEVER in URL query string)
    if (apiKey && apiKey.trim().length > 0) {
      try {
        const geminiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

        const response = await fetch(geminiEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey.trim(),
          },
          body: JSON.stringify({
            systemInstruction: {
              parts: [{ text: STROVYN_AI_SYSTEM_PROMPT }],
            },
            contents: [
              ...sanitizedHistory,
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

        if (response.ok) {
          const aiData = await response.json();
          const generatedText = aiData?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (generatedText) {
            return NextResponse.json({
              success: true,
              connected: true,
              message: generatedText,
            });
          }
        } else {
          console.error('Gemini API returned error status:', response.status);
        }
      } catch (e) {
        console.error('External AI API failure, engaging architectural fallback:', e);
      }
    }

    // 4. Verified Architectural Fallback (Without claiming AI or leaking dev messages)
    const queryLower = message.toLowerCase();
    let responseText =
      'Welcome to Strovyn Painting Co. We provide architectural interior painting, facade restoration, fine cabinetry lacquering, and artisanal mineral plasters across Greater Adelaide.';

    if (queryLower.includes('level 5') || queryLower.includes('drywall') || queryLower.includes('skim') || queryLower.includes('raking')) {
      responseText =
        'A Level 5 finish requires a continuous skim coat across all plasterboard faces and joints to equalize surface porosity under low-angle raking illumination. We follow strict dual-axis orbital sanding protocols.';
    } else if (queryLower.includes('plaster') || queryLower.includes('venetian') || queryLower.includes('marmorino') || queryLower.includes('lime')) {
      responseText =
        'Our artisanal plasters utilize natural aged slaked lime (calcium hydroxide) and Carrara marble blends. They cure through natural carbonation, providing a breathable, mold-resistant mineral finish.';
    } else if (queryLower.includes('cabinet') || queryLower.includes('joinery') || queryLower.includes('millwork') || queryLower.includes('spray')) {
      responseText =
        'Cabinetry lacquering is executed using catalyzed 2K polyurethane formulations applied under controlled containment or in dedicated spray booths to deliver furniture-grade velvet or satin sheens.';
    } else if (queryLower.includes('price') || queryLower.includes('cost') || queryLower.includes('quote') || queryLower.includes('rate') || queryLower.includes('estimate')) {
      responseText =
        'Because all commissions depend on substrate condition, ceiling heights, and finish specifications, we provide confirmed pricing through our Quotation Request page (/contact) for a free Adelaide on-site assessment.';
    } else if (queryLower.includes('contact') || queryLower.includes('phone') || queryLower.includes('whatsapp') || queryLower.includes('email')) {
      responseText =
        'You can reach our Adelaide team directly on 0406 646 061, via WhatsApp, or through contact@strovyn.com.';
    }

    return NextResponse.json({
      success: true,
      connected: false,
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
