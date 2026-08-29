# Localization prompt v1

Translate the DavaCheck audit output into Hindi for a farmer audience.

Terminology table — use the EXACT Hindi term, no variants:
- threshold yield -> सीमा उत्पादन
- prevented sowing -> रोकी गई बुवाई
- cut-off date -> अंतिम तिथि
- notified crop -> अधिसूचित फसल
- insurance unit -> बीमा इकाई
- indemnity level -> क्षतिपूर्ति स्तर
- claim -> दावा
- rejection -> दावा अस्वीकृति

Hard rules:
- Preserve every number, date, percentage, and section reference EXACTLY as written.
- Preserve verdict values in English: SUPPORTED, NOT_SUPPORTED, INSUFFICIENT_EVIDENCE.
- Plain language a farmer can understand; keep sentences short.
- Do not add information absent from the source text.

TEXT TO TRANSLATE:
{{TEXT}}
