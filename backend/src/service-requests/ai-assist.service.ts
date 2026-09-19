import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const ALLOWED_PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'URGENT'];
const REQUEST_TIMEOUT_MS = 15000;
const MAX_FOLLOW_UP_QUESTIONS = 4;

export interface AiAssistSuggestion {
  category: { id: string; name: string } | null;
  title: string;
  description: string;
  priority: string;
  followUpQuestions: string[];
}

/**
 * Turns a free-text facility problem description into structured Service
 * Request suggestions using Gemini's free-tier API. Purely advisory: callers
 * only ever use this to pre-fill the existing create-request form, never to
 * create anything directly.
 */
@Injectable()
export class AiAssistService {
  private readonly logger = new Logger(AiAssistService.name);

  constructor(private prisma: PrismaService) {}

  isEnabled(): boolean {
    return !!process.env.GEMINI_API_KEY;
  }

  async analyze(description: string, answers?: Record<string, string>): Promise<AiAssistSuggestion> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('AI_NOT_CONFIGURED');
    }

    const categories = await this.prisma.serviceCategory.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });

    const prompt = this.buildPrompt(description, categories.map((c) => c.name), answers);
    const raw = await this.callGemini(apiKey, prompt);
    return this.validate(raw, categories);
  }

  private buildPrompt(description: string, categoryNames: string[], answers?: Record<string, string>): string {
    const answersBlock = answers && Object.keys(answers).length
      ? `\n\nThe user already answered these follow-up questions:\n${Object.entries(answers)
          .map(([q, a]) => `Q: ${q}\nA: ${a}`)
          .join('\n')}`
      : '';

    return [
      'You are a facility-management assistant helping a hiring organization file a maintenance/service request.',
      'Read the user\'s plain-language description of a problem and produce a structured suggestion.',
      '',
      `Available service categories (pick the closest match, or "Other" if none fit): ${categoryNames.join(', ')}`,
      '',
      `User's description: """${description}"""${answersBlock}`,
      '',
      'Respond with ONLY a JSON object (no markdown, no commentary) with exactly these fields:',
      '{',
      '  "category": string (one of the exact category names above, or "Other"),',
      '  "title": string (short, clear, under 80 characters),',
      '  "description": string (a clear, professional rewrite of the user\'s description for a service provider to read),',
      '  "priority": string (exactly one of "LOW", "NORMAL", "HIGH", "URGENT"),',
      '  "followUpQuestions": string[] (0-3 short questions to ask ONLY if important information is genuinely missing, e.g. exact location, how long the issue has persisted, safety risk — empty array if the description is already sufficient)',
      '}',
    ].join('\n');
  }

  private async callGemini(apiKey: string, prompt: string): Promise<unknown> {
    const model = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json', temperature: 0.2 },
        }),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        this.logger.warn(`Gemini request failed: ${res.status} ${body.slice(0, 300)}`);
        throw new Error('AI_REQUEST_FAILED');
      }

      const json: any = await res.json();
      const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        this.logger.warn('Gemini response had no text content');
        throw new Error('AI_EMPTY_RESPONSE');
      }
      try {
        return JSON.parse(text);
      } catch {
        this.logger.warn(`Gemini response was not valid JSON: ${text.slice(0, 300)}`);
        throw new Error('AI_INVALID_JSON');
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        this.logger.warn('Gemini request timed out');
        throw new Error('AI_TIMEOUT');
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }

  private validate(raw: unknown, categories: { id: string; name: string }[]): AiAssistSuggestion {
    if (!raw || typeof raw !== 'object') throw new Error('AI_INVALID_SHAPE');
    const obj = raw as Record<string, unknown>;

    const title = typeof obj.title === 'string' ? obj.title.trim().slice(0, 120) : '';
    const description = typeof obj.description === 'string' ? obj.description.trim().slice(0, 2000) : '';
    if (!title || !description) throw new Error('AI_INVALID_SHAPE');

    const priorityRaw = typeof obj.priority === 'string' ? obj.priority.trim().toUpperCase() : '';
    const priority = ALLOWED_PRIORITIES.includes(priorityRaw) ? priorityRaw : 'NORMAL';

    const categoryName = typeof obj.category === 'string' ? obj.category.trim() : '';
    const matched = categories.find((c) => c.name.toLowerCase() === categoryName.toLowerCase()) ?? null;

    const followUpQuestions = Array.isArray(obj.followUpQuestions)
      ? obj.followUpQuestions
          .filter((q): q is string => typeof q === 'string' && q.trim().length > 0)
          .map((q) => q.trim().slice(0, 200))
          .slice(0, MAX_FOLLOW_UP_QUESTIONS)
      : [];

    return { category: matched, title, description, priority, followUpQuestions };
  }
}
