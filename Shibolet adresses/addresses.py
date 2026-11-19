import re
from dataclasses import dataclass


@dataclass(frozen=True)
class Address:
    street: str = ""
    house: str = ""
    apartment: str = ""
    city: str = ""
    status: str = "לבדיקה"


STREET = re.compile(
    r"(?P<street>.+?)\s+(?P<house>\d+[א-תA-Za-z]?)"
    r"(?:\s*/\s*(?P<apartment>\d+[א-תA-Za-z]?))?"
)
APARTMENT = re.compile(r'(?:\s*,\s*|\s+)(?:דירה|דיר[\x27׳]|ד[\x27׳])\s*(\d+[א-תA-Za-z]?)$')


def split_address(value: str) -> Address:
    cleaned = " ".join(value.split())
    if not cleaned:
        return Address(status="חסרה כתובת")

    city = ""
    if "," in cleaned:
        head, tail = (part.strip() for part in cleaned.rsplit(",", 1))
        if re.fullmatch(r"[א-תA-Za-z\s\x27׳\x22״–-]+", tail) and STREET.fullmatch(
            APARTMENT.sub("", head)
        ):
            cleaned, city = head, tail

    apartment = ""
    if match := APARTMENT.search(cleaned):
        apartment = match.group(1)
        cleaned = cleaned[:match.start()]

    match = STREET.fullmatch(cleaned)
    if match is None:
        return Address(city=city)
    street = match["street"]
    house = match["house"]
    inline_apartment = match["apartment"]
    if inline_apartment and apartment and inline_apartment != apartment:
        return Address(street, house, city=city)
    return Address(street, house, apartment or inline_apartment or "", city, "פוצלה")
