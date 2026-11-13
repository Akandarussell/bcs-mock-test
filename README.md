# 51st Special BCS (Health) — Assistant Surgeon (MBBS) Mock Test & Progress Tracker

Built exclusively for the **51st Special BCS (Health Cadre) — Assistant Surgeon (MBBS)** 200-mark MCQ exam (120 minutes, `+1.00` correct / `-0.50` wrong / `0` unanswered).

Dental Surgeon (BDS) subjects, General BCS written modes, and non-51st syllabus topics (General Science, ICT, Ethics, Geography) are strictly excluded at both the parser and UI levels.

## Official 51st Special BCS Mark Distribution

| Area | Target MCQs |
|---|---:|
| Medical Science (MBBS — 12 sub-disciplines) | 100 |
| Bangla | 20 |
| English | 20 |
| Bangladesh Affairs | 20 |
| International Affairs | 20 |
| Mathematical Reasoning | 10 |
| Mental Ability | 10 |
| **Total** | **200** |

## Question Bank Ingestion (`scripts/build_question_bank.py`)

A pre-seeded 224-MCQ starter bank is already built in `data/questions.json` (120 MBBS + 104 General). To expand it with your own downloaded PDFs / text files:

1. Place downloaded PDFs, TXT, Markdown, HTML, or JSON files into `./raw_questions/`:
   - 39th, 42nd & 48th Special BCS Assistant Surgeon (Medical) solutions (Scribd)
   - EEA.BD free 51st BCS Assistant Surgeon medical PDFs
   - Live MCQ 48th Special BCS question solution
2. Install Python dependencies (or use the created `.venv`) and run the parser:
   ```bash
   pip install -r scripts/requirements.txt
   python scripts/build_question_bank.py
   # Optional: also fetch public general-part practice pages politely:
   python scripts/build_question_bank.py --fetch-web --max-pages 20
   ```
   - Accepted & deduplicated MCQs -> `data/questions.json`
   - Dental/BDS & out-of-syllabus items -> `data/excluded_non_mbbs.json`
   - Unparsed items -> `data/parse_rejects.json`
3. Sync into `public/data/questions.json` (also runs automatically before `dev` and `build`):
   ```bash
   npm run sync-data
   ```

## Local Development & Static Export (`./out`)

```bash
npm install
npm run dev      # http://localhost:3000
npm run lint     # TypeScript check
npm run build    # Static export to ./out (ready for Puter Hosting or Vercel)
```

## Cloud Sync (`@heyputer/puter.js`)

- Click **Sign in with Puter to Sync Progress** in the header to save `AttemptRecord[]` in Puter KV under key `bcs_51_asst_surgeon_attempts`.
- Guest attempts saved in `localStorage` automatically merge into Puter KV upon sign-in.

