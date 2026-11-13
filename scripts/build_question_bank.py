# -*- coding: utf-8 -*-
"""
51st Special BCS (Health) — Assistant Surgeon (MBBS) question-bank builder.

Builds and deduplicates ./data/questions.json from:

  (a) Local files in ./raw_questions/ (PDF / TXT / MD / HTML / JSON) that YOU
      downloaded manually, for example:
        - 39th, 42nd & 48th Special BCS Assistant Surgeon (Medical) solutions (Scribd)
        - EEA.BD free 51st BCS Assistant Surgeon medical PDFs
        - Live MCQ 48th Special BCS question solution
  (b) Optional (--fetch-web) polite scraping of public general-part practice
      pages (OpenExamPrep, BCS Our Goal). robots.txt is honoured, pages are
      cached in ./raw_questions/_web_cache/ and requests are rate limited.

Strict scope: ONLY the 51st Special BCS Assistant Surgeon (MBBS) 200-mark MCQ
pattern. Dental/BDS topics and general subjects outside the 7-area
distribution (General Science, ICT, Ethics, Geography ...) are written to
./data/excluded_non_mbbs.json instead of the bank.

Output schema (one object per question):
  { id, part ("Medical"|"General"), subject, sourceExam, question,
    options[4], correctIndex (0-3), explanation }

Usage:
  python scripts/build_question_bank.py
  python scripts/build_question_bank.py --fetch-web --max-pages 20
  python scripts/build_question_bank.py --raw-dir raw_questions --out data/questions.json

Dependencies (only needed for the corresponding inputs):
  pip install -r scripts/requirements.txt   # pdfplumber, pypdf, beautifulsoup4, requests
"""
from __future__ import annotations

import argparse
import hashlib
import io
import json
import os
import re
import sys
import time
import unicodedata
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterable, Optional

# Force UTF-8 console output on Windows (Bangla text in logs).
try:
    sys.stdout.reconfigure(encoding="utf-8")  # type: ignore[attr-defined]
    sys.stderr.reconfigure(encoding="utf-8")  # type: ignore[attr-defined]
except Exception:  # pragma: no cover
    pass

ROOT = Path(__file__).resolve().parent.parent

# ---------------------------------------------------------------------------
# Allowed subjects (51st Special BCS Assistant Surgeon pattern)
# ---------------------------------------------------------------------------
MEDICAL_SUBJECTS = [
    "Medicine", "Surgery", "Gynaecology & Obstetrics", "Anatomy", "Physiology",
    "Biochemistry", "Pathology", "Pharmacology", "Microbiology",
    "Forensic Medicine", "Community Medicine", "Pediatrics",
]
GENERAL_SUBJECTS = [
    "Bangla", "English", "Bangladesh Affairs", "International Affairs",
    "Mathematical Reasoning", "Mental Ability",
]
ALLOWED_SUBJECTS = set(MEDICAL_SUBJECTS + GENERAL_SUBJECTS)

DENTAL = "__DENTAL__"
OUT_OF_SYLLABUS = "__OUT_OF_SYLLABUS__"

# Header aliases -> canonical subject (lower-case, matched on normalised header lines)
SUBJECT_ALIASES: dict[str, list[str]] = {
    "Medicine": ["medicine", "internal medicine", "general medicine", "মেডিসিন", "মেডিসিন বিষয়ক"],
    "Surgery": ["surgery", "general surgery", "সার্জারি", "শল্যচিকিৎসা", "orthopaedics", "orthopedics", "ent", "ophthalmology", "eye", "chakshu"],
    "Gynaecology & Obstetrics": ["gynaecology & obstetrics", "gynaecology and obstetrics", "gynecology & obstetrics",
                                  "gynecology and obstetrics", "obstetrics & gynaecology", "obstetrics and gynaecology",
                                  "obs & gynae", "obs and gynae", "obgyn", "ob-gyn", "gynae & obs", "gynaecology",
                                  "gynecology", "obstetrics", "গাইনি", "গাইনি ও অবস", "স্ত্রীরোগ ও প্রসূতিবিদ্যা", "প্রসূতিবিদ্যা"],
    "Anatomy": ["anatomy", "human anatomy", "অ্যানাটমি", "এনাটমি", "শারীরস্থান"],
    "Physiology": ["physiology", "ফিজিওলজি", "শারীরবিদ্যা", "শারীরতত্ত্ব"],
    "Biochemistry": ["biochemistry", "বায়োকেমিস্ট্রি", "জৈব রসায়ন", "প্রাণরসায়ন"],
    "Pathology": ["pathology", "প্যাথলজি", "রোগতত্ত্ব"],
    "Pharmacology": ["pharmacology", "ফার্মাকোলজি", "ঔষধতত্ত্ব"],
    "Microbiology": ["microbiology", "মাইক্রোবায়োলজি", "অণুজীববিজ্ঞান"],
    "Forensic Medicine": ["forensic medicine", "forensic medicine & toxicology", "forensic", "jurisprudence",
                           "ফরেনসিক মেডিসিন", "ফরেনসিক"],
    "Community Medicine": ["community medicine", "preventive & social medicine", "psm", "public health",
                            "কমিউনিটি মেডিসিন", "জনস্বাস্থ্য"],
    "Pediatrics": ["pediatrics", "paediatrics", "পেডিয়াট্রিক্স", "শিশুরোগ", "শিশু স্বাস্থ্য"],
    "Bangla": ["bangla", "bengali", "bangla language & literature", "bangla language and literature",
               "বাংলা", "বাংলা ভাষা ও সাহিত্য", "বাংলা ভাষা", "বাংলা সাহিত্য"],
    "English": ["english", "english language & literature", "english language and literature",
                "english language", "english literature", "ইংরেজি"],
    "Bangladesh Affairs": ["bangladesh affairs", "bangladesh", "বাংলাদেশ বিষয়াবলি", "বাংলাদেশ বিষয়াবলী"],
    "International Affairs": ["international affairs", "international", "আন্তর্জাতিক বিষয়াবলি", "আন্তর্জাতিক বিষয়াবলী"],
    "Mathematical Reasoning": ["mathematical reasoning", "mathematics", "math", "maths", "গাণিতিক যুক্তি", "গণিত"],
    "Mental Ability": ["mental ability", "mental skills", "mental skill", "মানসিক দক্ষতা"],
    DENTAL: ["dental", "dental surgery", "dental science", "dental part", "bds", "dental surgeon",
             "prosthodontics", "orthodontics", "oral & maxillofacial surgery", "oral and maxillofacial surgery",
             "oral surgery", "dental anatomy", "oral anatomy", "periodontology", "periodontics", "endodontics",
             "conservative dentistry", "pedodontics", "paedodontics", "oral pathology", "dental materials",
             "science of dental materials", "community dentistry", "ডেন্টাল", "দন্ত চিকিৎসা"],
    OUT_OF_SYLLABUS: ["general science", "everyday science", "সাধারণ বিজ্ঞান", "ict",
                       "computer", "computer & ict", "computer and information technology",
                       "information & communication technology", "কম্পিউটার", "তথ্য ও যোগাযোগ প্রযুক্তি",
                       "কম্পিউটার ও তথ্যপ্রযুক্তি", "ethics", "ethics values & good governance",
                       "ethics, values and good governance", "নৈতিকতা", "নৈতিকতা মূল্যবোধ ও সুশাসন",
                       "geography", "geography environment & disaster management", "ভূগোল",
                       "ভূগোল পরিবেশ ও দুর্যোগ ব্যবস্থাপনা"],
}

# Question-level dental-only terms (strong indicators; medical overlap terms are avoided).
DENTAL_TERMS = [
    "prosthodont", "orthodont", "endodont", "periodontolog", "periodontics", "pedodont", "paedodont",
    "denture", "malocclusion", "occlusal", "amalgam", "root canal", "cavity preparation", "dental material",
    "impression material", "maxillofacial", "tooth preparation", "crown preparation", "edentulous",
    "gutta percha", "gutta-percha", "dental anatomy", "permanent dentition", "deciduous teeth",
    "enamel rod", "dentinal tubule", "cementum", "pulpotomy", "pulpectomy", "pulp capping", "class ii cavity",
    "black's classification", "dental plaque index", "acrylic resin", "glass ionomer", "composite resin",
]
OUT_OF_SYLLABUS_TERMS = [
    "binary number", "html", "operating system", "ram stands", "cpu", "megabyte", "gigabyte", "internet protocol",
    "শুদ্ধাচার", "নৈতিকতা", "মূল্যবোধ", "সুশাসন", "computer virus",
]

# Keyword classifier used when a question has no recognised subject header.
SUBJECT_KEYWORDS: dict[str, list[str]] = {
    "Anatomy": ["nerve supply", "innervat", "artery", "vein ", "muscle", "foramen", "ligament", "plexus", "embryolog",
                "derived from", "lymphatic drainage", "bone", "vertebra", "histolog", "epithelium", "carpal", "fossa"],
    "Physiology": ["cardiac output", "action potential", "hormone secret", "gfr", "renal clearance", "receptor potential",
                   "blood pressure regulat", "respiratory quotient", "surfactant", "erythropoie", "synapse",
                   "physiolog", "membrane potential", "oxygen dissociation", "compliance"],
    "Biochemistry": ["enzyme", "vitamin", "glycolysis", "krebs", "tca cycle", "amino acid", "lipoprotein", "dna", "rna",
                     "coenzyme", "metabolism", "urea cycle", "gluconeogenesis", "purine", "pyrimidine", "biochem"],
    "Pathology": ["neoplasm", "tumour", "tumor", "carcinoma", "necrosis", "apoptosis", "inflammation", "granuloma",
                  "amyloid", "anaemia", "anemia", "leukaemia", "leukemia", "thrombosis", "embolism", "infarct",
                  "biopsy", "histopatholog", "metaplasia", "dysplasia"],
    "Pharmacology": ["drug of choice", "side effect", "adverse effect", "mechanism of action", "antagonist", "agonist",
                     "dose", "half-life", "half life", "inhibitor", "antibiotic", "contraindicat", "pharmaco", "toxicity of"],
    "Microbiology": ["bacteria", "virus", "fungus", "fungal", "parasite", "gram positive", "gram negative", "culture medium",
                     "toxin", "vaccine strain", "spore", "microbio", "plasmodium", "helminth", "staphylococc", "streptococc"],
    "Forensic Medicine": ["rigor mortis", "post-mortem", "postmortem", "autopsy", "inquest", "poisoning", "wound",
                          "medico-legal", "medicolegal", "dying declaration", "hanging", "strangulation", "asphyxia",
                          "identification", "ossification", "forensic"],
    "Community Medicine": ["epidemiolog", "incidence", "prevalence", "screening", "immunization", "epi schedule",
                           "sanitation", "chlorination", "nutrition programme", "health indicator", "mortality rate",
                           "family planning", "occupational", "biostatist", "sample size", "odds ratio"],
    "Pediatrics": ["neonate", "newborn", "infant", "child", "children", "milestone", "apgar", "breast feeding",
                   "breastfeeding", "kwashiorkor", "marasmus", "paediatric", "pediatric", "imci"],
    "Gynaecology & Obstetrics": ["pregnan", "gestation", "labour", "labor", "placenta", "uterus", "uterine", "ovary",
                                  "ovarian", "menstrua", "cervix", "cervical cancer", "antenatal", "postpartum",
                                  "eclampsia", "caesarean", "fetal", "foetal", "trimester", "contracepti"],
    "Surgery": ["fracture", "hernia", "appendic", "operation", "incision", "burn", "shock", "suture", "stoma",
                "obstruction", "trauma", "cholecyst", "anastomosis", "ulcer", "abscess", "dislocation", "surgical"],
    "Medicine": ["diagnosis", "treatment of", "management of", "clinical feature", "syndrome", "hypertension",
                 "diabetes", "asthma", "pneumonia", "tuberculosis", "hepatitis", "myocardial", "stroke", "renal failure",
                 "thyroid", "ecg", "copd", "arthritis", "seizure", "fever"],
}

BN_DIGITS = str.maketrans("০১২৩৪৫৬৭৮৯", "0123456789")
OPTION_LETTERS = {"a": 0, "b": 1, "c": 2, "d": 3, "ক": 0, "খ": 1, "গ": 2, "ঘ": 3}

WEB_SOURCES = [
    {"url": "https://open-exam-prep.com/practice/bd-bcs-preliminary", "sourceExam": "OpenExamPrep BCS Preliminary Practice"},
    {"url": "https://bcsourgoal.com.bd/practice", "sourceExam": "BCS Our Goal Practice"},
]
USER_AGENT = "BCS51-AsstSurgeon-QuestionBankBuilder/1.0 (personal study tool; respects robots.txt)"


# ---------------------------------------------------------------------------
# Data structures
# ---------------------------------------------------------------------------
@dataclass
class RawQuestion:
    question: str
    options: list[str] = field(default_factory=list)
    correct_index: Optional[int] = None
    answer_text: Optional[str] = None
    explanation: str = ""
    subject_hint: Optional[str] = None
    source_exam: str = "Unknown"
    origin: str = ""
    marked_correct: Optional[int] = None
    topic: Optional[str] = None
    custom_pack: Optional[str] = None


# ---------------------------------------------------------------------------
# Text helpers
# ---------------------------------------------------------------------------
def clean(s: str) -> str:
    s = unicodedata.normalize("NFC", s or "")
    s = s.replace("\u00a0", " ").replace("\u200c", "").replace("\u200d", "").replace("\ufeff", "")
    s = re.sub(r"[ \t]+", " ", s)
    return s.strip()


def norm_key(s: str) -> str:
    s = clean(s).lower().translate(BN_DIGITS)
    s = re.sub(r"[\s\W_]+", "", s, flags=re.UNICODE)
    return s


def normalise_header(line: str) -> str:
    s = clean(line).lower()
    s = re.sub(r"^(subject|section|part|বিষয়)\s*[:\-–—]\s*", "", s)
    s = re.sub(r"^[\d০-৯]+\s*[\.\)]\s*", "", s)
    s = re.sub(r"\(.*?\)", "", s)
    s = re.sub(r"\b(part|section|questions?|mcq|solutions?|অংশ|প্রশ্ন)\b", "", s)
    s = s.strip(" :-–—|*#=_.।")
    s = re.sub(r"\s+", " ", s)
    return s


ALIAS_LOOKUP: dict[str, str] = {}
for _canon, _aliases in SUBJECT_ALIASES.items():
    for _a in _aliases:
        ALIAS_LOOKUP[_a.lower()] = _canon


def detect_subject_header(line: str) -> Optional[str]:
    if len(line) > 70:
        return None
    # never treat an option line such as "(a) Bangladesh" as a section header
    if OPT_LINE_RE.match(line) or ANS_RE.match(line):
        return None
    h = normalise_header(line)
    if not h:
        return None
    if h in ALIAS_LOOKUP:
        return ALIAS_LOOKUP[h]
    # "Medicine Part", "Pharmacology — 10 marks" style
    h2 = re.sub(r"[\d০-৯]+\s*(marks?|নম্বর)", "", h).strip(" :-–—")
    return ALIAS_LOOKUP.get(h2)


SOURCE_RE = re.compile(r"^\s*(?:source|উৎস)\s*[:\-]\s*(.+)$", re.I)
EXAM_HEADER_RE = re.compile(r"^\s*([\d০-৯]{2})\s*(?:st|nd|rd|th|তম)?\s*(special\s+)?(?:বিশেষ\s+)?bcs\b", re.I)


def source_from_filename(path: Path) -> str:
    name = path.stem.replace("_", " ").replace("-", " ")
    nums = re.findall(r"(\d{2})\s*(?:st|nd|rd|th)", name, flags=re.I)
    special = "special" in name.lower() or "health" in name.lower() or "medical" in name.lower()
    if len(nums) == 1:
        return f"{ordinal(int(nums[0]))} {'Special ' if special else ''}BCS".replace("  ", " ")
    if "eea" in name.lower():
        return "EEA.BD 51st BCS Practice"
    if "livemcq" in name.lower() or "live mcq" in name.lower():
        return "Live MCQ 48th Special BCS"
    return path.stem


def ordinal(n: int) -> str:
    if 10 <= n % 100 <= 20:
        suf = "th"
    else:
        suf = {1: "st", 2: "nd", 3: "rd"}.get(n % 10, "th")
    return f"{n}{suf}"


# ---------------------------------------------------------------------------
# File readers
# ---------------------------------------------------------------------------
def read_pdf(path: Path) -> str:
    text = ""
    try:
        import pdfplumber  # type: ignore

        with pdfplumber.open(str(path)) as pdf:
            text = "\n".join((page.extract_text() or "") for page in pdf.pages)
    except ImportError:
        print("  ! pdfplumber not installed, trying pypdf", file=sys.stderr)
    except Exception as e:  # corrupt / encrypted PDFs
        print(f"  ! pdfplumber failed on {path.name}: {e}", file=sys.stderr)
    if len(text.strip()) < 50:
        try:
            from pypdf import PdfReader  # type: ignore

            reader = PdfReader(str(path))
            text = "\n".join((p.extract_text() or "") for p in reader.pages)
        except ImportError:
            print("  ! pypdf not installed — run: pip install -r scripts/requirements.txt", file=sys.stderr)
        except Exception as e:
            print(f"  ! pypdf failed on {path.name}: {e}", file=sys.stderr)
    if len(text.strip()) < 50:
        print(f"  ! {path.name}: little/no extractable text (scanned PDF?). OCR it to TXT and re-run.", file=sys.stderr)
    return text


def html_to_text(html: str) -> str:
    try:
        from bs4 import BeautifulSoup  # type: ignore
    except ImportError:
        print("  ! beautifulsoup4 not installed — HTML stripped with regex", file=sys.stderr)
        return re.sub(r"<[^>]+>", "\n", html)
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style", "noscript", "nav", "footer", "header"]):
        tag.decompose()
    return soup.get_text("\n")


def read_text_file(path: Path) -> str:
    for enc in ("utf-8-sig", "utf-8", "utf-16", "cp1252"):
        try:
            return path.read_text(encoding=enc)
        except (UnicodeDecodeError, UnicodeError):
            continue
    return path.read_bytes().decode("utf-8", errors="replace")


# ---------------------------------------------------------------------------
# MCQ text parser
# ---------------------------------------------------------------------------
Q_START_RE = re.compile(r"^\s*(?:Q(?:uestion)?\s*\.?\s*|প্রশ্ন\s*)?([\d০-৯]{1,4})\s*[\.\)।:]\s*(\S.*)$", re.I)
OPT_LINE_RE = re.compile(r"^\s*[\(\[]?([a-dA-Dক-ঘ])\s*[\)\]\.:।]\s*(.*)$")
INLINE_OPT_RE = re.compile(r"(?:(?<=\s)|^)[\(\[]([a-dA-Dকখগঘ])[\)\]]\s*|(?:(?<=\s)|^)([a-dA-Dকখগঘ])\)\s+")
ANS_RE = re.compile(
    r"^\s*(?:ans(?:wer)?s?|correct(?:\s+answer)?|right\s+answer|উত্তর|সঠিক\s+উত্তর|উঃ|উ:)\s*[:\-–—\.=]?\s*(.*)$",
    re.I,
)
EXPL_RE = re.compile(r"^\s*(?:explanation|expl|explain|ব্যাখ্যা|note|নোট|ref(?:erence)?|তথ্যসূত্র)\s*[:\-–—]\s*(.*)$", re.I)
CORRECT_MARK_RE = re.compile(r"\s*(?:✓|✔|✅|\(ans\)|\[ans\]|\(correct\)|\*{1,2})\s*$", re.I)


def letter_to_index(s: str) -> Optional[int]:
    """'b', '(b)', 'B.', 'খ', '(খ) উত্তর' -> index; plain answer text -> None."""
    s = (s or "").strip().lower()
    m = re.match(r"^[\(\[]?([a-dক-ঘ])(?:$|[\)\]\.:।,\s])", s)
    if m and m.group(1) in OPTION_LETTERS:
        return OPTION_LETTERS[m.group(1)]
    return None


def split_inline_options(text: str) -> Optional[list[tuple[int, str]]]:
    """Split '(a) X (b) Y (c) Z (d) W' into [(0,'X'), ...]."""
    matches = list(INLINE_OPT_RE.finditer(text))
    if len(matches) < 2:
        return None
    out = []
    for i, m in enumerate(matches):
        letter = (m.group(1) or m.group(2)).lower()
        start = m.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        out.append((OPTION_LETTERS[letter], text[start:end].strip(" ,;")))
    idxs = [o[0] for o in out]
    if idxs != list(range(len(idxs))):
        return None
    return out


def parse_mcq_text(text: str, default_source: str, origin: str) -> list[RawQuestion]:
    questions: list[RawQuestion] = []
    cur: Optional[RawQuestion] = None
    subject: Optional[str] = None
    source = default_source
    mode = "q"  # q | opt | expl

    def finish():
        nonlocal cur
        if cur is not None:
            questions.append(cur)
        cur = None

    for raw_line in text.splitlines():
        line = clean(raw_line)
        if not line:
            continue

        m = SOURCE_RE.match(line)
        if m:
            finish()
            source = clean(m.group(1))
            continue

        hdr = detect_subject_header(line)
        if hdr:
            finish()
            subject = hdr
            mode = "q"
            continue

        if len(line) < 60:
            em = EXAM_HEADER_RE.match(line)
            if em and not Q_START_RE.match(line):
                finish()
                n = int(em.group(1).translate(BN_DIGITS))
                source = f"{ordinal(n)} {'Special ' if (em.group(2) or 'বিশেষ' in line or 'health' in line.lower()) else ''}BCS".replace("  ", " ")
                continue

        am = ANS_RE.match(line)
        if am and cur is not None:
            val = am.group(1).strip()
            idx = letter_to_index(val)
            if idx is None:
                lm = re.match(r"^[\(\[]?([a-dA-Dক-ঘ])[\)\]\.:]\s*(.*)$", val)
                if lm:
                    idx = OPTION_LETTERS[lm.group(1).lower()]
            if idx is not None:
                cur.correct_index = idx
            else:
                cur.answer_text = val
            mode = "expl"
            continue

        xm = EXPL_RE.match(line)
        if xm and cur is not None:
            cur.explanation = (cur.explanation + " " + xm.group(1)).strip()
            mode = "expl"
            continue

        qm = Q_START_RE.match(line)
        if qm and not (cur is not None and mode == "q" and not cur.options and len(qm.group(2)) < 3):
            finish()
            qtext = qm.group(2)
            cur = RawQuestion(question="", subject_hint=subject, source_exam=source, origin=origin)
            inline = split_inline_options(qtext)
            if inline and inline[0][0] == 0:
                first = INLINE_OPT_RE.search(qtext)
                cur.question = qtext[: first.start()].strip() if first else qtext
                for _, o in inline:
                    _add_option(cur, o)
                mode = "opt"
            else:
                cur.question = qtext
                mode = "q"
            continue

        if cur is None:
            continue

        inline = split_inline_options(line)
        if inline and inline[0][0] == len(cur.options):
            for _, o in inline:
                _add_option(cur, o)
            mode = "opt"
            continue

        om = OPT_LINE_RE.match(line)
        if om and OPTION_LETTERS.get(om.group(1).lower()) == len(cur.options) and mode != "expl":
            _add_option(cur, om.group(2))
            mode = "opt"
            continue

        # continuation lines
        if mode == "q":
            cur.question = (cur.question + " " + line).strip()
        elif mode == "opt" and cur.options and len(cur.options) < 4:
            cur.options[-1] = (cur.options[-1] + " " + line).strip()
        elif mode == "expl":
            cur.explanation = (cur.explanation + " " + line).strip()
        elif mode == "opt" and len(cur.options) >= 4:
            # text after the 4th option without an "Explanation:" prefix
            cur.explanation = (cur.explanation + " " + line).strip()
    finish()
    return questions


def _add_option(q: RawQuestion, text: str) -> None:
    text = clean(text)
    if CORRECT_MARK_RE.search(text):
        text = CORRECT_MARK_RE.sub("", text).strip()
        q.marked_correct = len(q.options)
    q.options.append(text)


# ---------------------------------------------------------------------------
# Structured inputs (JSON, JSON-LD Quiz)
# ---------------------------------------------------------------------------
def parse_json_file(path: Path, default_source: str) -> list[RawQuestion]:
    data = json.loads(read_text_file(path))
    items = data.get("questions", data) if isinstance(data, dict) else data
    out = []
    for it in items if isinstance(items, list) else []:
        if not isinstance(it, dict):
            continue
        opts = it.get("options") or []
        ci = it.get("correctIndex")
        if ci is None and "answer" in it:
            ci = letter_to_index(str(it["answer"]))
        out.append(RawQuestion(
            question=str(it.get("question", "")),
            options=[clean(str(o)) for o in opts],
            correct_index=ci if isinstance(ci, int) else None,
            answer_text=str(it["answer"]) if "answer" in it and not isinstance(ci, int) else None,
            explanation=str(it.get("explanation", "") or ""),
            subject_hint=_canonical_subject(it.get("subject")),
            source_exam=str(it.get("sourceExam") or default_source),
            origin=str(path),
            topic=clean(str(it["topic"])) if it.get("topic") else None,
            custom_pack=clean(str(it["customPack"])) if it.get("customPack") else None,
        ))
    return out


def _canonical_subject(s) -> Optional[str]:
    if not s:
        return None
    s = str(s)
    if s in ALLOWED_SUBJECTS:
        return s
    return ALIAS_LOOKUP.get(normalise_header(s))


def parse_jsonld_quiz(html: str, source: str, origin: str, subject_hint: Optional[str]) -> list[RawQuestion]:
    out: list[RawQuestion] = []
    for block in re.findall(r'<script[^>]+application/ld\+json[^>]*>(.*?)</script>', html, flags=re.S | re.I):
        try:
            data = json.loads(block)
        except Exception:
            continue
        stack = data if isinstance(data, list) else [data]
        while stack:
            node = stack.pop()
            if isinstance(node, list):
                stack.extend(node)
                continue
            if not isinstance(node, dict):
                continue
            if node.get("@type") == "Question":
                accepted = node.get("acceptedAnswer") or {}
                if isinstance(accepted, list):
                    accepted = accepted[0] if accepted else {}
                suggested = node.get("suggestedAnswer") or []
                if isinstance(suggested, dict):
                    suggested = [suggested]
                answers = [a for a in ([accepted] + list(suggested)) if isinstance(a, dict) and a.get("text")]
                opts = [clean(html_to_text(a["text"])) for a in answers]
                if len(opts) == 4:
                    # keep a deterministic order (alphabetical) so the correct answer is not always first
                    correct_text = opts[0]
                    opts_sorted = sorted(opts, key=lambda x: x.lower())
                    out.append(RawQuestion(
                        question=clean(html_to_text(str(node.get("name") or node.get("text") or ""))),
                        options=opts_sorted, correct_index=opts_sorted.index(correct_text),
                        explanation=clean(html_to_text(str(accepted.get("comment", {}).get("text", "")
                                                           if isinstance(accepted.get("comment"), dict) else ""))),
                        subject_hint=subject_hint, source_exam=source, origin=origin,
                    ))
            for v in node.values():
                if isinstance(v, (dict, list)):
                    stack.append(v)
    return out


# ---------------------------------------------------------------------------
# Web fetching (optional, polite)
# ---------------------------------------------------------------------------
def fetch_web_sources(cache_dir: Path, max_pages: int, delay: float) -> list[RawQuestion]:
    try:
        import requests  # type: ignore
    except ImportError:
        print("! requests not installed — skipping --fetch-web (pip install -r scripts/requirements.txt)")
        return []
    from urllib.parse import urljoin, urlparse
    from urllib.robotparser import RobotFileParser

    cache_dir.mkdir(parents=True, exist_ok=True)
    session = requests.Session()
    session.headers["User-Agent"] = USER_AGENT
    results: list[RawQuestion] = []

    for src in WEB_SOURCES:
        start = src["url"]
        parsed = urlparse(start)
        base = f"{parsed.scheme}://{parsed.netloc}"
        rp = RobotFileParser()
        try:
            r = session.get(base + "/robots.txt", timeout=15)
            rp.parse(r.text.splitlines() if r.ok else [])
        except Exception:
            rp.parse([])
        queue, seen, pages = [start], set(), 0
        print(f"\n[web] {start}")
        while queue and pages < max_pages:
            url = queue.pop(0).split("#")[0]
            if url in seen:
                continue
            seen.add(url)
            if not rp.can_fetch(USER_AGENT, url):
                print(f"  - robots.txt disallows {url}")
                continue
            cache_file = cache_dir / (hashlib.sha1(url.encode()).hexdigest()[:16] + ".html")
            if cache_file.exists():
                html = cache_file.read_text(encoding="utf-8", errors="replace")
            else:
                try:
                    resp = session.get(url, timeout=20)
                    time.sleep(delay)
                except Exception as e:
                    print(f"  ! {url}: {e}")
                    continue
                if not resp.ok or "text/html" not in resp.headers.get("content-type", ""):
                    print(f"  ! {url}: HTTP {resp.status_code}")
                    continue
                html = resp.text
                cache_file.write_text(html, encoding="utf-8")
            pages += 1
            subject_hint = _subject_from_url(url) or _subject_from_title(html)
            qs = parse_jsonld_quiz(html, src["sourceExam"], url, subject_hint)
            if not qs:
                qs = parse_mcq_text(html_to_text(html), src["sourceExam"], url)
                for q in qs:
                    q.subject_hint = q.subject_hint or subject_hint
            print(f"  + {url} -> {len(qs)} questions")
            results.extend(qs)
            for href in re.findall(r'href=["\']([^"\']+)["\']', html):
                nxt = urljoin(url, href)
                if urlparse(nxt).netloc == parsed.netloc and parsed.path.rstrip("/") in urlparse(nxt).path:
                    if nxt not in seen:
                        queue.append(nxt)
    if not results:
        print("[web] No questions extracted. These sites may render questions with JavaScript; "
              "save the pages (Ctrl+S) or copy the text into ./raw_questions/ instead.")
    return results


def _subject_from_url(url: str) -> Optional[str]:
    slug = url.lower().rstrip("/").split("/")[-1].replace("-", " ").replace("_", " ")
    for alias, canon in sorted(ALIAS_LOOKUP.items(), key=lambda kv: -len(kv[0])):
        if re.search(r"\b" + re.escape(alias) + r"\b", slug):
            return canon
    return None


def _subject_from_title(html: str) -> Optional[str]:
    m = re.search(r"<title>(.*?)</title>", html, flags=re.S | re.I)
    if not m:
        return None
    t = m.group(1).lower()
    for alias, canon in sorted(ALIAS_LOOKUP.items(), key=lambda kv: -len(kv[0])):
        if len(alias) > 3 and alias in t:
            return canon
    return None


# ---------------------------------------------------------------------------
# Classification, validation, dedup
# ---------------------------------------------------------------------------
def classify_by_keywords(text: str) -> Optional[str]:
    t = text.lower()
    best, best_score = None, 0
    for subj, kws in SUBJECT_KEYWORDS.items():
        score = sum(1 for k in kws if k in t)
        if score > best_score:
            best, best_score = subj, score
    return best


def is_dental(text: str) -> bool:
    t = text.lower()
    return any(term in t for term in DENTAL_TERMS)


def is_out_of_syllabus(text: str) -> bool:
    t = text.lower()
    return any(re.search(r"\b" + re.escape(term) + r"\b", t) if term.isascii() else term in t
               for term in OUT_OF_SYLLABUS_TERMS)


def resolve_answer(q: RawQuestion) -> Optional[int]:
    if q.correct_index is not None and 0 <= q.correct_index < 4:
        return q.correct_index
    if q.marked_correct is not None:
        return q.marked_correct
    if q.answer_text:
        a = norm_key(q.answer_text)
        for i, o in enumerate(q.options):
            ok = norm_key(o)
            if ok and (ok == a or (len(a) > 3 and (a in ok or ok in a))):
                return i
    return None


def make_id(question: str, options: list[str]) -> str:
    key = norm_key(question) + "|" + "|".join(sorted(norm_key(o) for o in options))
    return "q_" + hashlib.sha1(key.encode("utf-8")).hexdigest()[:12]


def process(raw: Iterable[RawQuestion], medical_context: dict[str, bool]):
    accepted: dict[str, dict] = {}
    excluded: list[dict] = []
    rejects: list[dict] = []
    dup_count = 0

    for q in raw:
        q.question = clean(re.sub(r"\s+", " ", q.question))
        q.options = [clean(o) for o in q.options if clean(o)]
        q.explanation = clean(q.explanation)
        record_base = {"question": q.question, "options": q.options, "sourceExam": q.source_exam, "origin": q.origin}

        if not q.question:
            continue
        full_text = q.question + " " + " ".join(q.options) + " " + q.explanation

        # ---- strict scope filter ----
        if q.subject_hint == DENTAL or is_dental(full_text):
            excluded.append({**record_base, "reason": "Dental/BDS-only topic (not in Assistant Surgeon MBBS syllabus)",
                             "detectedSection": q.subject_hint or "keyword match"})
            continue
        if q.subject_hint == OUT_OF_SYLLABUS or (q.subject_hint is None and is_out_of_syllabus(full_text)):
            excluded.append({**record_base, "reason": "Outside 51st Special BCS 7-area distribution "
                                                      "(General Science / ICT / Ethics / Geography)",
                             "detectedSection": q.subject_hint or "keyword match"})
            continue

        if len(q.options) != 4:
            rejects.append({**record_base, "reason": f"expected 4 options, found {len(q.options)}"})
            continue
        ci = resolve_answer(q)
        if ci is None:
            rejects.append({**record_base, "reason": "correct answer not found"})
            continue

        subject = q.subject_hint
        if subject is None and medical_context.get(q.origin, False):
            subject = classify_by_keywords(full_text)
        if subject is None or subject not in ALLOWED_SUBJECTS:
            rejects.append({**record_base, "reason": "subject could not be resolved to an allowed 51st BCS subject"})
            continue

        qid = make_id(q.question, q.options)
        item = {
            "id": qid,
            "part": "Medical" if subject in MEDICAL_SUBJECTS else "General",
            "subject": subject,
            "sourceExam": q.source_exam,
            "question": q.question,
            "options": q.options,
            "correctIndex": ci,
            "explanation": q.explanation,
        }
        if q.topic:
            item["topic"] = q.topic
        if q.custom_pack:
            item["customPack"] = q.custom_pack
        if qid in accepted:
            dup_count += 1
            prev = accepted[qid]
            # keep the richer explanation; remember extra sources
            if len(item["explanation"]) > len(prev["explanation"]):
                prev["explanation"] = item["explanation"]
            if item["sourceExam"] not in prev["sourceExam"].split(" | "):
                prev["sourceExam"] = prev["sourceExam"] + " | " + item["sourceExam"]
            continue
        accepted[qid] = item
    return list(accepted.values()), excluded, rejects, dup_count


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def gather_local(raw_dir: Path) -> tuple[list[RawQuestion], dict[str, bool]]:
    out: list[RawQuestion] = []
    medical_ctx: dict[str, bool] = {}
    if not raw_dir.exists():
        print(f"! {raw_dir} does not exist — create it and drop PDFs/TXT files there.")
        return out, medical_ctx
    files = sorted(p for p in raw_dir.rglob("*") if p.is_file() and "_web_cache" not in p.parts)
    for path in files:
        ext = path.suffix.lower()
        source = source_from_filename(path)
        lower = path.name.lower()
        is_medical_file = any(k in lower for k in ("medical", "health", "surgeon", "mbbs", "special"))
        try:
            if ext == ".pdf":
                qs = parse_mcq_text(read_pdf(path), source, str(path))
            elif ext in (".txt", ".md"):
                qs = parse_mcq_text(read_text_file(path), source, str(path))
            elif ext in (".html", ".htm"):
                html = read_text_file(path)
                qs = parse_jsonld_quiz(html, source, str(path), None) or parse_mcq_text(html_to_text(html), source, str(path))
            elif ext == ".json":
                qs = parse_json_file(path, source)
            else:
                continue
        except Exception as e:
            print(f"  ! failed to parse {path.name}: {e}", file=sys.stderr)
            continue
        medical_ctx[str(path)] = is_medical_file
        for q in qs:
            q.origin = str(path)
        print(f"  + {path.relative_to(raw_dir)} -> {len(qs)} raw questions")
        out.extend(qs)
    return out, medical_ctx


def main() -> int:
    ap = argparse.ArgumentParser(description="Build the 51st Special BCS Assistant Surgeon (MBBS) question bank")
    ap.add_argument("--raw-dir", default=str(ROOT / "raw_questions"))
    ap.add_argument("--out", default=str(ROOT / "data" / "questions.json"))
    ap.add_argument("--excluded", default=str(ROOT / "data" / "excluded_non_mbbs.json"))
    ap.add_argument("--rejects", default=str(ROOT / "data" / "parse_rejects.json"))
    ap.add_argument("--fetch-web", action="store_true", help="also scrape public general-part practice pages")
    ap.add_argument("--max-pages", type=int, default=25, help="max pages per web source")
    ap.add_argument("--delay", type=float, default=1.5, help="seconds between web requests")
    ap.add_argument("--merge-existing", action="store_true",
                    help="keep questions already in --out (e.g. hand-curated) and merge new ones")
    args = ap.parse_args()

    raw_dir = Path(args.raw_dir)
    print(f"[local] scanning {raw_dir}")
    raw, medical_ctx = gather_local(raw_dir)

    if args.fetch_web:
        web = fetch_web_sources(raw_dir / "_web_cache", args.max_pages, args.delay)
        raw.extend(web)

    if args.merge_existing and Path(args.out).exists():
        existing = parse_json_file(Path(args.out), "Existing bank")
        print(f"[merge] {len(existing)} existing questions")
        raw = existing + raw

    questions, excluded, rejects, dups = process(raw, medical_ctx)
    order = {s: i for i, s in enumerate(MEDICAL_SUBJECTS + GENERAL_SUBJECTS)}
    questions.sort(key=lambda q: (order[q["subject"]], q["sourceExam"], q["id"]))

    for target, payload in ((args.out, questions), (args.excluded, excluded), (args.rejects, rejects)):
        Path(target).parent.mkdir(parents=True, exist_ok=True)
        with io.open(target, "w", encoding="utf-8", newline="\n") as fh:
            json.dump(payload, fh, ensure_ascii=False, indent=2)
            fh.write("\n")

    print("\n================ SUMMARY ================")
    print(f"Accepted questions : {len(questions)}  -> {args.out}")
    print(f"Duplicates merged  : {dups}")
    print(f"Excluded (non-MBBS): {len(excluded)}  -> {args.excluded}")
    print(f"Parse rejects      : {len(rejects)}  -> {args.rejects}")
    counts: dict[str, int] = {}
    for q in questions:
        counts[q["subject"]] = counts.get(q["subject"], 0) + 1
    med = sum(counts.get(s, 0) for s in MEDICAL_SUBJECTS)
    print(f"\nMedical (MBBS) total: {med}")
    for s in MEDICAL_SUBJECTS:
        print(f"   {s:<26}{counts.get(s, 0):>5}")
    print("General:")
    for s in GENERAL_SUBJECTS:
        print(f"   {s:<26}{counts.get(s, 0):>5}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
