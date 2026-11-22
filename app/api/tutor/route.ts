import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

export const maxDuration = 30;

// Fast, high-throughput models with minimal thinking for instant chat replies.
const MODEL_PRIORITY = ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite'] as const;

const BASE_SYSTEM_INSTRUCTION = `You are Russell, Shamima's dedicated personal BCS tutor for the 51st Special BCS (Health Cadre — Assistant Surgeon, MBBS) examination in Bangladesh.

Core role:
- Help with BOTH (1) BCS exam preparation (study roadmaps, high-yield topics, mnemonics, negative-marking strategy, time management) and (2) step-by-step MCQ & question answer solving (identify the exact correct answer clearly, explain why it is right, briefly clarify why confusing options/distractors are wrong, and give fast clinical or math shortcuts).
- Exam pattern: 200 MCQs, 120 minutes, +1.00 for correct, -0.50 negative marking for wrong answers.
- Syllabus:
  1) Medical Science (100 marks, MBBS only — never include BDS/Dental syllabus): Medicine, Surgery, Gynaecology & Obstetrics, Anatomy, Physiology, Biochemistry, Pathology, Pharmacology, Microbiology, Forensic Medicine, Community Medicine, Pediatrics.
  2) General Part (100 marks): Bangla (20), English (20), Bangladesh Affairs (20), International Affairs (20), Mathematical Reasoning (10), Mental Ability (10).
- Language: Respond naturally in the same language the student uses (Bengali or English). When explaining medical concepts in Bengali, keep standard clinical/MBBS terminology clear in English alongside Bengali explanations.
- Style: Warm, encouraging, clear, structured, exam-oriented, and concise. Always introduce yourself as Russell if greeted or asked who you are.
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
    msg.toLowerCase().includes('overloaded') ||
    msg.toLowerCase().includes('timeout')
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
    return NextResponse.json(
      { error: 'Please enter a BCS preparation or answer-solving question for Russell.' },
      { status: 400 }
    );
  }

  const systemInstruction = body.assessmentContext?.trim()
    ? `${BASE_SYSTEM_INSTRUCTION}\n\n--- Student's Latest Self-Assessment Context ---\n${body.assessmentContext.trim()}`
    : BASE_SYSTEM_INSTRUCTION;

  const ai = new GoogleGenAI({ apiKey });

  const orderedModels =
    body.preferredModel &&
    (MODEL_PRIORITY as readonly string[]).includes(body.preferredModel)
      ? [
          body.preferredModel,
          ...MODEL_PRIORITY.filter((m) => m !== body.preferredModel),
        ]
      : [...MODEL_PRIORITY];

  let lastError: unknown = null;

  for (const model of orderedModels) {
    const canReuseInteraction =
      Boolean(body.previousInteractionId) &&
      (!body.preferredModel || model === body.preferredModel);

    try {
      const stream = await ai.interactions.create({
        model,
        input: message,
        system_instruction: systemInstruction,
        stream: true,
        ...(canReuseInteraction
          ? { previous_interaction_id: body.previousInteractionId }
          : {}),
        generation_config: {
          max_output_tokens: 1200,
          thinking_level: 'minimal',
        },
      });

      const encoder = new TextEncoder();
      const readable = new ReadableStream({
        async start(controller) {
          let interactionId: string | undefined;
          let sentAnyText = false;
          const sendEvent = (payload: Record<string, unknown>) => {
            controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`));
          };

          try {
            for await (const event of stream) {
              if (
                event.event_type === 'interaction.created' ||
                event.event_type === 'interaction.completed'
              ) {
                if (event.interaction?.id) {
                  interactionId = event.interaction.id;
                }
              } else if (event.event_type === 'step.delta') {
                if (event.delta?.type === 'text' && event.delta.text) {
                  sentAnyText = true;
                  sendEvent({ type: 'delta', text: event.delta.text });
                }
              } else if (event.event_type === 'error') {
                const msg =
                  event.error?.message || 'Gemini stream returned an error.';
                sendEvent({ type: 'error', error: msg });
                return;
              }
            }

            if (!sentAnyText) {
              sendEvent({
                type: 'error',
                error: 'The tutor returned an empty response. Please try again.',
              });
            } else {
              sendEvent({ type: 'done', interactionId, model });
            }
          } catch (streamErr) {
            const msg =
              streamErr instanceof Error ? streamErr.message : 'Stream interrupted.';
            sendEvent({ type: 'error', error: msg });
          } finally {
            controller.close();
          }
        },
      });

      return new Response(readable, {
        headers: {
          'Content-Type': 'application/x-ndjson; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
        },
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
      error: `Russell is temporarily unavailable (${errMsg}). Please try again in a moment.`,
    },
    { status: 502 }
  );
}
