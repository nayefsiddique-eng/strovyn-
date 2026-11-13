import { NextResponse } from 'next/server';

// Strict System Prompt ensuring the AI never fabricates company information
const STROVYN_AI_SYSTEM_PROMPT = `
You are the Construction & Painting Assistant for Strovyn Painting Co. (https://strovyn.com/).

COMPANY PROFILE & SERVICE FOCUS:
- Premium residential and commercial painting based in Adelaide, South Australia (servicing Glenelg to the Adelaide Hills, and Gawler to McLaren Vale).
- 5 Core Disciplines: Interior Precision, Exterior Cladding, Commercial & Heritage, Cabinet Refinishing, Woodwork & Joinery.
- Standards: Substrate diagnostics, zero-tolerance surface preparation, dust-controlled mechanical sanding, hand-cut lines, low-VOC coatings, and formal daylight sign-off before handover.
- Free on-site consultation across metro Adelaide.

STRICT OPERATING PRINCIPLES:
1. ONLY discuss topics relating to:
   - Architectural and residential painting
   - Surface preparation and substrate diagnosis
   - Interior precision finishes, woodwork lacquering, exterior cladding
   - Low-VOC mineral paints and daylight inspection sign-offs
   - Booking a free on-site consultation via the Quote Request form (/contact) or WhatsApp

2. STRICT PROHIBITIONS:
   - NEVER invent or state specific company prices, quotes, or hourly rates. Always direct users to submit their project details on /contact for a free Adelaide on-site assessment.
   - NEVER invent or confirm specific company registration numbers, builder licences, or guarantees that are unverified.
   - NEVER invent client history or fabricated partner relationships.
   - If asked about non-painting topics, politely steer the conversation back to architectural coatings.

Tone: Professional, measured, craft-focused, concise.
`;

// Simple in-memory rate limiting map (IP -> timestamps)
const rateLimitMap = new Map<string, number[]>();

export async function POST(req: Request) {
  try {
    // Basic Rate Limiting (15 requests per minute per IP/Client)
    const clientIp = req.headers.get('x-forwarded-for') || 'local-client';
    const now = Date.now();
    const timestamps = (rateLimitMap.get(clientIp) || []).filter((t) => now - t < 60000);
    if (timestamps.length >= 15) {
      return NextResponse.json(
        { success: false, error: 'Rate limit exceeded. Please wait a moment before sending more queries.' },
        { status: 429 }
      );
    }
    timestamps.push(now);
    rateLimitMap.set(clientIp, timestamps);

    const body = await req.json();
    const message = body?.message;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'A valid text query is required.' },
        { status: 400 }
      );
    }

    if (message.length > 800) {
      return NextResponse.json(
        { success: false, error: 'Message exceeds 800 characters limit.' },
        { status: 400 }
      );
    }

    const apiKey = process.env.AI_API_KEY;

    // If external AI API Key is provided (e.g. Gemini or OpenAI compatible)
    if (apiKey) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [
                {
                  role: 'user',
                  parts: [
                    { text: `${STROVYN_AI_SYSTEM_PROMPT}\n\nVisitor Question: ${message.trim()}` },
                  ],
                },
              ],
              generationConfig: {
                temperature: 0.2,
                maxOutputTokens: 350,
              },
            }),
          }
        );

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
        }
      } catch (e) {
        console.error('External AI API failure, engaging fallback:', e);
      }
    }

    // Graceful verified fallback (when AI_API_KEY is not configured or fails)
    const queryLower = message.toLowerCase();
    let responseText =
      'Welcome to Strovyn Painting Co. We provide architectural interior painting, facade restoration, fine cabinetry lacquering, and artisanal mineral plasters.';

    if (queryLower.includes('level 5') || queryLower.includes('drywall') || queryLower.includes('skim') || queryLower.includes('raking')) {
      responseText =
        'A Level 5 finish requires a continuous skim coat across all plasterboard faces and joints to equalize surface porosity under low-angle raking illumination. We follow strict dual-axis orbital sanding protocols.';
    } else if (queryLower.includes('plaster') || queryLower.includes('venetian') || queryLower.includes('marmorino') || queryLower.includes('lime')) {
      responseText =
        'Our artisanal plasters utilize natural aged slaked lime (calcium hydroxide) and Carrara marble dust. They cure through natural carbonation, providing a breathable, mold-resistant, zero-VOC mineral finish.';
    } else if (queryLower.includes('cabinet') || queryLower.includes('joinery') || queryLower.includes('millwork') || queryLower.includes('spray')) {
      responseText =
        'Cabinetry lacquering is executed using catalyzed 2K polyurethane formulations applied under controlled containment or in dedicated spray booths to deliver furniture-grade velvet or satin sheens.';
    } else if (queryLower.includes('price') || queryLower.includes('cost') || queryLower.includes('quote') || queryLower.includes('rate') || queryLower.includes('estimate')) {
      responseText =
        'Because all commissions depend on substrate condition, ceiling heights, and finish specifications, we do not provide estimated pricing without reviewing plan sets. Please submit your project scope via our Quotation Request page (/contact).';
    } else if (queryLower.includes('licence') || queryLower.includes('guarantee') || queryLower.includes('insurance')) {
      responseText =
        'Official contractor licence numbers, insurance certificates, and warranty schedules are provided directly with formal tender documentation upon consultation.';
    }

    return NextResponse.json({
      success: true,
      connected: Boolean(apiKey),
      message: responseText,
      notice: apiKey ? undefined : 'Live AI model awaiting AI_API_KEY. Serving verified architectural guidelines.',
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
