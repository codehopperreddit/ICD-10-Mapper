interface Chapter {
  number: number;
  title: string;
  start: string;
  end: string;
}

const CHAPTERS: Chapter[] = [
  { number: 1,  title: "Certain infectious and parasitic diseases", start: "A00", end: "B99" },
  { number: 2,  title: "Neoplasms", start: "C00", end: "D49" },
  { number: 3,  title: "Diseases of the blood and blood-forming organs and certain disorders involving the immune mechanism", start: "D50", end: "D89" },
  { number: 4,  title: "Endocrine, nutritional and metabolic diseases", start: "E00", end: "E89" },
  { number: 5,  title: "Mental, Behavioral and Neurodevelopmental disorders", start: "F01", end: "F99" },
  { number: 6,  title: "Diseases of the nervous system", start: "G00", end: "G99" },
  { number: 7,  title: "Diseases of the eye and adnexa", start: "H00", end: "H59" },
  { number: 8,  title: "Diseases of the ear and mastoid process", start: "H60", end: "H95" },
  { number: 9,  title: "Diseases of the circulatory system", start: "I00", end: "I99" },
  { number: 10, title: "Diseases of the respiratory system", start: "J00", end: "J99" },
  { number: 11, title: "Diseases of the digestive system", start: "K00", end: "K95" },
  { number: 12, title: "Diseases of the skin and subcutaneous tissue", start: "L00", end: "L99" },
  { number: 13, title: "Diseases of the musculoskeletal system and connective tissue", start: "M00", end: "M99" },
  { number: 14, title: "Diseases of the genitourinary system", start: "N00", end: "N99" },
  { number: 15, title: "Pregnancy, childbirth and the puerperium", start: "O00", end: "O9A" },
  { number: 16, title: "Certain conditions originating in the perinatal period", start: "P00", end: "P96" },
  { number: 17, title: "Congenital malformations, deformations and chromosomal abnormalities", start: "Q00", end: "Q99" },
  { number: 18, title: "Symptoms, signs and abnormal clinical and laboratory findings, not elsewhere classified", start: "R00", end: "R99" },
  { number: 19, title: "Injury, poisoning and certain other consequences of external causes", start: "S00", end: "T88" },
  { number: 20, title: "External causes of morbidity", start: "V00", end: "Y99" },
  { number: 21, title: "Factors influencing health status and contact with health services", start: "Z00", end: "Z99" },
  { number: 22, title: "Codes for special purposes", start: "U00", end: "U85" },
];

export function chapterFor(code: string): string | null {
  const prefix = code.slice(0, 3).toUpperCase();
  for (const ch of CHAPTERS) {
    if (prefix >= ch.start && prefix <= ch.end) {
      return `Ch ${ch.number}: ${ch.title}`;
    }
  }
  return null;
}

export function categoryFor(code: string): string {
  return code.slice(0, 3).toUpperCase();
}

/**
 * CMS flat files omit the decimal that ICD-10-CM normally puts after the
 * category (first 3 chars). Re-insert it for storage so we use one canonical
 * format across the database.
 */
export function formatCode(raw: string): string {
  const c = raw.trim().toUpperCase().replace(".", "");
  if (c.length <= 3) return c;
  return `${c.slice(0, 3)}.${c.slice(3)}`;
}

/** ICD-10-CM codes are 1 letter + 2–7 alphanumerics. Useful for filtering noise. */
const ICD_CODE_RE = /^[A-Z][0-9A-Z]{2,7}$/;
export function isIcdCode(raw: string): boolean {
  return ICD_CODE_RE.test(raw.trim().toUpperCase().replace(".", ""));
}
