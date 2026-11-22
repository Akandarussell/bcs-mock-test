import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

const MODEL_PRIORITY = ['gemini-3.8-flash', 'gemini-3.5-flash-lite'] as const;

const BASE_SYSTEM_INSTRUCTION = `You are Shamima's dedicated AI Tutor for the 51st Special BCS (Health Cadre — Assistant Surgeon, MBBS) examination in Bangladesh.

Core scope & rules:
- Exam pattern: 200 MCQs, 120 minutes, +1.00 for correct, -0.50 negative marking for wrong answers.
- Syllabus:
  1) Medical Science (100 marks, MBBS only — never include BDS/Dental syllabus): Medicine, Surgery, Gynaecology & Obstetrics, Anatomy, Physiology, Biochemistry, Pathology, Pharmacology, Microbiology, Forensic Medicine, Community Medicine, Pediatrics.
  2) General Part (100 marks): Bangla (20), English (20), Bangladesh Affairs (20), International Affairs (20), Mathematical Reasoning (10), Mental Ability (10).
- Language: Respond naturally in the same language the student uses (Bengali or English). When explaining medical concepts in Bengali, keep standard clinical/MBBS terminology clear in English alongside Bengali explanations.
- Style: Clear, encouraging, structured, exam-oriented, and concise. Give high-yield memory tips, mnemonics, MCQ traps, and actionable step-by-step study plans whenever asked.
- If self-assessment results or study readiness scores are provided in context, tailor your advice directly to their weakest areas first while showing how to protect their strong areas.`;

interface TutorRequestBody {
  message?: string;
  previousInteractionId?: string;
  preferredModel?: string;
  assessmentContext?: string;
}

function isTransientCapacityError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const status = (err as { status?: number }).status;
  const msg = String((err as { message?: string }).message ?? '');
  return (
    status === 503 ||
    status === 429 ||
    msg.includes('503') ||
    msg.includes('429') ||
    msg.toLowerCase().includes('high demand') ||
    msg.toLowerCase().includes('overloaded')
  );
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          'GEMINI_API_KEY is not configured on the server. Add GEMINI_API_KEY in .env.local (local) or Vercel Project Settings → Environment Variables.',
      },
      { status: 500 }
    );
  }

  let body: TutorRequestBody;
  try {
    body = (await req.json()) as TutorRequestBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON request body.' }, { status: 400 });
  }

  const message = body.message?.trim();
  if (!message) {
    return NextResponse.json({ error: 'Please enter a question for the BCS Tutor.' }, { status: 400 });
  }

  const systemInstruction = body.assessmentContext?.trim()
    ? `${BASE_SYSTEM_INSTRUCTION}\n\n--- Student's Latest Self-Assessment Context ---\n${body.assessmentContext.trim()}`
    : BASE_SYSTEM_INSTRUCTION;

  const ai = new GoogleGenAI({ apiKey });
  let lastError: unknown = null;

  const orderedModels =
    body.preferredModel &&
    (MODEL_PRIORITY as readonly string[]).includes(body.preferredModel)
      ? [
          body.preferredModel,
          ...MODEL_PRIORITY.filter((m) => m !== body.preferredModel),
        ]
      : [...MODEL_PRIORITY];

  for (const model of orderedModels) {
    const canReuseInteraction =
      Boolean(body.previousInteractionId) &&
      (!body.preferredModel || model === body.preferredModel);
    try {
      const interaction = await ai.interactions.create({
        model,
        input: message,
        system_instruction: systemInstruction,
        ...(canReuseInteraction
          ? { previous_interaction_id: body.previousInteractionId }
          : {}),
        generation_config: {
          max_output_tokens: 1500,
        },
      });

      const reply = interaction.output_text?.trim();
      if (!reply) {
        return NextResponse.json(
          { error: 'The tutor returned an empty response. Please try asking again.' },
          { status: 502 }
        );
      }

      return NextResponse.json({
        reply,
        interactionId: interaction.id,
        model,
      });
    } catch (err) {
      lastError = err;
      if (isTransientCapacityError(err)) {
        continue;
      }
      break;
    }
  }

  const errMsg =
    lastError instanceof Error ? lastError.message : 'Failed to reach Gemini API.';
  return NextResponse.json(
    {
      error: `BCS Tutor is temporarily unavailable (${errMsg}). Please try again in a moment.`,
    },
    { status: 502 }
  );
}
