from rapidfuzz import process, fuzz

def normalize_candidate_name(name: str, candidates: list[str], threshold: float = 80.0) -> str:
    """
    Normalize a candidate name against a list of known candidates using RapidFuzz.
    If no match is found above the threshold, returns the original name.
    """
    if not candidates:
        return name

    match = process.extractOne(name, candidates, scorer=fuzz.token_sort_ratio)

    if match and match[1] >= threshold:
        return match[0]

    return name
