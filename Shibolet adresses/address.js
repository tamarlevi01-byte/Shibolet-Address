export const fields = ['רחוב', 'מספר בית', 'דירה', 'יישוב', 'סטטוס פיצול'];
export const statuses = ['פוצלה', 'לבדיקה', 'חסרה כתובת', 'תוקנה'];

const streetPattern = /^(.+?)\s+(\d+[א-תA-Za-z]?)(?:\s*\/\s*(\d+[א-תA-Za-z]?))?$/;
const apartmentPattern = /(?:\s*,\s*|\s+)(?:דירה|דיר['׳]|ד['׳])\s*(\d+[א-תA-Za-z]?)$/;
const cityPattern = /^[א-תA-Za-z\s'׳"״–-]+$/;

export function splitAddress(value) {
  let address = value.trim().replace(/\s+/g, ' ');
  if (!address) return ['', '', '', '', 'חסרה כתובת'];

  let city = '';
  const comma = address.lastIndexOf(',');
  if (comma !== -1) {
    const head = address.slice(0, comma).trim();
    const tail = address.slice(comma + 1).trim();
    if (cityPattern.test(tail) && streetPattern.test(head.replace(apartmentPattern, ''))) {
      address = head;
      city = tail;
    }
  }

  const apartment = address.match(apartmentPattern)?.[1];
  const match = address.replace(apartmentPattern, '').match(streetPattern);
  if (!match) return ['', '', '', city, 'לבדיקה'];
  const [, street, house, inlineApartment] = match;
  if (apartment && inlineApartment && apartment !== inlineApartment) {
    return [street, house, '', city, 'לבדיקה'];
  }
  return [street, house, apartment || inlineApartment || '', city, 'פוצלה'];
}

export function outputFields(headers) {
  const used = new Set(headers);
  return fields.map(field => {
    let name = field;
    for (let suffix = 2; used.has(name); suffix++) name = `${field} (${suffix})`;
    used.add(name);
    return name;
  });
}
