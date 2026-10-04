export const defaults = {
  firstName: 'عبدالله', secondName: 'سنا', firstEnglish: 'ABDULLAH', secondEnglish: 'SANA', monogram: 'A & S',
  occasion: 'حفل خطبتنا', introTitle: 'دعوة خاصة', introText: 'إلى من نحب وجودهم معنا', openLabel: 'افتح الدعوة',
  bismillah: 'بسم الله الرحمن الرحيم', cardText: 'نتشرف بدعوتكم لمشاركتنا\nفرحة حفل خطبتنا',
  eventText: 'يسعدنا ويشرفنا حضوركم\nومشاركتنا فرحة حفل خطبتنا\nلتكتمل فرحتنا بوجودكم بيننا',
  menLabel: 'الرجال', womenLabel: 'النساء',
  countdownTitle: 'باقي على خطبتنا', countdownFinished: 'حلّ يوم فرحتنا، أهلًا بكم بكل حب',
  locationTitle: 'الموقع', locationDescription: '', mapsUrl: '', locationImage: '', showLocation: true,
  rsvpTitle: 'هل ستشاركونا فرحتنا؟', rsvpSubtitle: 'يسعدنا تأكيد حضوركم',
  rsvpSuccess: 'شكرًا لكم 🤍\nيسعدنا وجودكم معنا', rsvpDeclined: 'شكرًا لردكم، نتمنى لكم كل الخير 🤍',
  wishesTitle: 'كلماتكم تزيد فرحتنا', wishesSubtitle: 'شاركونا تهانيكم بهذه المناسبة',
  showGallery: false, galleryTitle: 'لحظات من حفل خطوبتنا', finalTitle: 'وجودكم معنا\nيتمم فرحتنا', finalText: 'ننتظر حضوركم بكل حب',
  endingText: 'بداية جديدة..\nلقصة أجمل..\nمعًا..',
  musicEnabled: true, musicLoop: true, musicUrl: '/assets/quiet-celebration.mp3', moderation: true,
  burgundy: '#6E1022', gold: '#B88743', ivory: '#F6EBDD'
};
export type Settings = typeof defaults;
export const eventDefaults = { date: '2026-10-09', dayLabel: '', reception: '16:00', start: '18:00', timezone: '+03:00' };
export type EventDetails = typeof eventDefaults;
export type GalleryItem = {id: number; url: string; alt: string; position: number; is_cover: number};
export type Wish = {id: number; name: string; message: string; status: string; created_at: string};
export type Rsvp = {id: number; name: string; guests: number; attending: number; created_at: string};
export type PublicData = {settings: Settings; event: EventDetails; gallery: GalleryItem[]; wishes: Wish[]};
export function eventInstant(event: EventDetails) { return new Date(`${event.date}T${event.start}:00${event.timezone}`); }
