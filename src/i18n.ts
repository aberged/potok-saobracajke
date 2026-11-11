// The app's words. Potok's page says its language on the frame's <html lang>
// ("sr", "sr-Cyrl" or "en"), and nothing else tells an app. Serbian is the
// reference, as in Potok, and Cyrillic comes from it. `{n}`, `{name}` and the
// like are filled in; plurals end in One, Few and Many.
//
// Only the app's own words go through here. The groups' names and
// descriptions are data, written once for every reader, always in Latin
// (src/describe).

import type { SkipReason } from './data/normalize';

export type Lang = 'sr' | 'sr-Cyrl' | 'en';

const sr = {
  appName: 'Uvoz saobraćajnih nezgoda',
  appSub: 'Nezgode MUP-a sa data.gov.rs postaju podgrupe ove grupe, sa mestom na mapi.',
  checking: 'Proveravam šta ovaj Potok i tvoja prava dozvoljavaju…',
  retry: 'Pokušaj ponovo',
  back: 'Nazad',
  empty: '—',

  stepFiles: 'Fajlovi',
  stepPreview: 'Pregled',
  stepImport: 'Uvoz',
  stepReport: 'Izveštaj',

  blockedPreview: 'U pregledu podešavanja aplikacija ne radi. Sačuvaj grupu i otvori opis „Uvoz“.',
  blockedRights: 'Uvoz pravi podgrupe u tvoje ime. Treba ti pravo da menjaš ovu grupu i da u njoj praviš podgrupe.',
  blockedOutdated:
    'Ovaj Potok nema grupno pravljenje podgrupa (createChildren), pa je stariji od uvoza. Uvoz radi tek kad se server nadogradi.',
  blockedNoWarning:
    'Ovaj Potok nema pin „warning“, kojim se označavaju nezgode sa povređenima, pa je server stariji od uvoza. Kad se nadogradi, otvori stranicu ponovo.',
  blockedPins: 'Ovom Potoku nedostaju pinovi za nezgode: {pins}.',
  blockedFailed: 'Provera nije uspela, verovatno zbog veze. Pokušaj ponovo.',

  pickTitle: 'Izaberi fajlove',
  pickHint: 'Fajlovi MUP-a sa data.gov.rs: xlsx sa jednim listom, bez zaglavlja. Više fajlova se spaja u jedan uvoz.',
  pickButton: 'Fajlovi (xlsx)',
  yearTitle: 'Godina',
  yearFromGroup: 'Po nazivu grupe („{name}“) uvoze se samo nezgode iz {year}. godine, a ostali redovi se preskaču.',
  yearNone: 'Naziv grupe („{name}“) nema godinu, pa se uvoze nezgode iz svih godina.',
  yearField: 'Samo nezgode iz godine',
  yearAll: 'prazno: sve godine',
  yearChanged: 'Godina se razlikuje od one iz naziva grupe ({year}).',
  yearBad: 'Upiši godinu sa četiri cifre ili ostavi prazno.',
  cursorFound: 'Prethodni uvoz ({files}) stao je posle {next} od {total} nezgoda ({when}). Izaberi iste fajlove i nastavićeš odatle.',
  cursorDone: 'Prethodni uvoz ({files}) je završen: {total} nezgoda ({when}).',

  parsingTitle: 'Čitam fajlove',
  parsingFile: '{name} ({n} od {count})',
  stageReading: 'učitavam fajl',
  stageUnzipping: 'raspakujem',
  stageRows: 'čitam redove',
  parseFailed: 'Fajl „{name}“ ne može da se pročita: {reason}.',
  reasonNotXlsx: 'ovo nije xlsx fajl',
  reasonNoSheet: 'u fajlu nema lista',
  reasonUnreadable: 'pregledač ne može da ga otvori',
  reasonEmpty: 'list nema nijedan red',

  previewTitle: 'Pregled',
  statRows: 'Redova',
  statAccidents: 'Nezgoda',
  statSkipped: 'Preskočeno',
  sevKilled: 'Poginuli',
  sevInjured: 'Povređeni',
  sevDamage: 'Materijalna šteta',
  perFile: '{name}: {rows} redova',
  perFileHeader: '{name}: {rows} redova, prvi red je zaglavlje',
  multiRow: 'Nezgode sa više situacija (isti ID u više redova): {n}. Svaka je jedna podgrupa, a sve situacije su u opisu.',
  conflicts: 'Nezgode čiji redovi navode različite posledice: {n}. Uzete su najteže (ID: {ids}).',
  unknownKinds: 'Redova sa nepoznatom vrstom nezgode: {n}. Vrsta je upisana onako kako je u fajlu.',
  swapped: 'Redova sa zamenjenom dužinom i širinom: {n}. Ispravljeno.',
  skippedTitle: 'Preskočeni redovi',
  noneSkipped: 'Nijedan red nije preskočen.',
  skipOutsideSerbia: 'van Srbije',
  skipNoCoordinates: 'bez koordinata',
  skipBadDate: 'loš datum',
  skipUnknownSeverity: 'nepoznate posledice',
  skipNoId: 'bez ID-ja',
  skipOtherYear: 'druga godina',
  exampleRow: '{file}, red {line}',
  moreSkipped: '…i još {n}, svi su u CSV-u u izveštaju.',
  otherYears: 'Godine u preskočenim redovima: {years}.',
  samplesTitle: 'Primeri opisa',
  samplesHint: 'Ovako će ih Potok prikazati. Pregled stiže sa servera.',
  sampleLoading: 'Tražim pregled od Potoka…',
  sampleFailed: 'Pregled nije stigao ({error}).',
  importOne: 'Uvezi {n} nezgodu',
  importFew: 'Uvezi {n} nezgode',
  importMany: 'Uvezi {n} nezgoda',
  importNote:
    'Nezgode postaju javne podgrupe ove grupe, sa mestom, pinom i opisom, i ne nasleđuju njene članove. Svaka ima ključ (mup:ID), pa ponovni uvoz ne pravi duplikate.',
  resumeText:
    'Ovi fajlovi su već uvoženi do {next} od {total}. Uvoz nastavlja od {from}, paket ranije: Potok po ključu prepoznaje nezgode koje već ima.',
  resumeButton: 'Nastavi od {from}',
  restartButton: 'Počni ispočetka',
  doneBefore: 'Ovi fajlovi su već uvezeni do kraja. Ponovni uvoz ne pravi duplikate: postojeće nezgode Potok preskače.',
  otherFiles: 'Drugi fajlovi',
  nothingToImport: 'Nema nezgoda za uvoz. Proveri godinu i fajlove.',

  importingTitle: 'Uvoz',
  keepOpen:
    'Drži ovu karticu otvorenu dok uvoz ne završi. Ako se veza prekine ili se stranica ponovo učita, otvori „Uvoz“ i izaberi iste fajlove: uvoz nastavlja tamo gde je stao.',
  progressOf: '{done} od {total}',
  statCreated: 'Napravljeno',
  statExisting: 'Već postojalo',
  statFailed: 'Neuspelo',
  statRate: 'Brzina',
  statEta: 'Preostalo',
  ratePerSecond: '{n} u sekundi',
  etaHours: '{h} h {m} min',
  etaMinutes: '{m} min',
  etaSeconds: 'manje od minuta',
  batchSize: 'Paket: {n}',
  statusRunning: 'Šaljem pakete…',
  statusPausing: 'Pauza posle ovog paketa…',
  statusPaused: 'Uvoz je pauziran.',
  statusWaiting: 'Potok traži da se uspori (ograničenje upisa). Isti paket ide ponovo za nekoliko sekundi.',
  statusRetrying: 'Potok nije odgovorio ({reason}). Isti paket ide ponovo, a ključevi sprečavaju duplikate.',
  pause: 'Pauziraj',
  resume: 'Nastavi',

  reportDone: 'Uvoz je završen',
  reportStopped: 'Uvoz je stao',
  stopForbidden: 'Potok je odbio upis: tvoja prava u ovoj grupi više ne dozvoljavaju pravljenje podgrupa.',
  stopStale: 'Ova aplikacija više nije na ekranu, jer se opis grupe promenio. Otvori „Uvoz“ ponovo i izaberi iste fajlove da nastaviš.',
  stopOutdated: 'Potok ne poznaje grupno pravljenje podgrupa (createChildren).',
  stopOther: 'Potok je vratio grešku „{error}“.',
  reportSkipped: 'Preskočeno redova iz fajla: {n}',
  reportFailedTitle: 'Neuspele nezgode',
  downloadCsv: 'Preuzmi CSV preskočenih i neuspelih redova',
  csvFallback: 'Ako preuzimanje ne radi, CSV je ovde',
  csvCut: 'Ovde je prvih {n} redova, a ceo spisak je u preuzetom fajlu.',
  newImport: 'Novi uvoz',
  continueImport: 'Nastavi uvoz',
  csvFile: 'fajl',
  csvLine: 'red',
  csvId: 'ID',
  csvReason: 'razlog',
  csvFailed: 'neuspelo',
};

export type Key = keyof typeof sr;

const en: Record<Key, string> = {
  appName: 'Traffic accident import',
  appSub: "Accidents from the Ministry of the Interior's data on data.gov.rs become sub-groups of this group, with a place on the map.",
  checking: 'Checking what this Potok and your rights allow…',
  retry: 'Try again',
  back: 'Back',
  empty: '—',

  stepFiles: 'Files',
  stepPreview: 'Preview',
  stepImport: 'Import',
  stepReport: 'Report',

  blockedPreview: 'The app does not run in the settings preview. Save the group and open the “Uvoz” description.',
  blockedRights: 'The import makes sub-groups in your name. You need the right to edit this group and to make sub-groups in it.',
  blockedOutdated: 'This Potok cannot make sub-groups in batches (createChildren), so it is older than the import. The import works once the server is upgraded.',
  blockedNoWarning:
    'This Potok has no “warning” pin, which marks accidents with injuries, so the server is older than the import. Open the page again once it is upgraded.',
  blockedPins: 'This Potok lacks pins for accidents: {pins}.',
  blockedFailed: 'The check failed, probably because of the connection. Try again.',

  pickTitle: 'Choose files',
  pickHint: "The Ministry's files from data.gov.rs: xlsx with one sheet and no header. Several files are merged into one import.",
  pickButton: 'Files (xlsx)',
  yearTitle: 'Year',
  yearFromGroup: 'By the group\'s name (“{name}”) only accidents from {year} are imported, and other rows are skipped.',
  yearNone: 'The group\'s name (“{name}”) has no year, so accidents from every year are imported.',
  yearField: 'Only accidents from the year',
  yearAll: 'empty: every year',
  yearChanged: "The year differs from the group's name ({year}).",
  yearBad: 'Enter a four-digit year or leave it empty.',
  cursorFound: 'The previous import ({files}) stopped after {next} of {total} accidents ({when}). Choose the same files to go on from there.',
  cursorDone: 'The previous import ({files}) is finished: {total} accidents ({when}).',

  parsingTitle: 'Reading the files',
  parsingFile: '{name} ({n} of {count})',
  stageReading: 'loading the file',
  stageUnzipping: 'unpacking',
  stageRows: 'reading rows',
  parseFailed: 'The file “{name}” cannot be read: {reason}.',
  reasonNotXlsx: 'it is not an xlsx file',
  reasonNoSheet: 'it has no sheet',
  reasonUnreadable: 'the browser cannot open it',
  reasonEmpty: 'its sheet has no rows',

  previewTitle: 'Preview',
  statRows: 'Rows',
  statAccidents: 'Accidents',
  statSkipped: 'Skipped',
  sevKilled: 'Killed',
  sevInjured: 'Injured',
  sevDamage: 'Material damage',
  perFile: '{name}: {rows} rows',
  perFileHeader: '{name}: {rows} rows, the first row is a header',
  multiRow: 'Accidents in several situations (one ID on several rows): {n}. Each is one sub-group, with every situation in its description.',
  conflicts: 'Accidents whose rows give different consequences: {n}. The worst are kept (ID: {ids}).',
  unknownKinds: 'Rows with an unknown kind of accident: {n}. The kind is written as the file has it.',
  swapped: 'Rows with longitude and latitude swapped: {n}. Fixed.',
  skippedTitle: 'Skipped rows',
  noneSkipped: 'No row was skipped.',
  skipOutsideSerbia: 'outside Serbia',
  skipNoCoordinates: 'no coordinates',
  skipBadDate: 'bad date',
  skipUnknownSeverity: 'unknown consequences',
  skipNoId: 'no ID',
  skipOtherYear: 'another year',
  exampleRow: '{file}, row {line}',
  moreSkipped: '…and {n} more, all in the CSV in the report.',
  otherYears: 'Years in the skipped rows: {years}.',
  samplesTitle: 'Sample descriptions',
  samplesHint: 'This is how Potok will show them. The preview comes from the server.',
  sampleLoading: 'Asking Potok for a preview…',
  sampleFailed: 'The preview did not come ({error}).',
  importOne: 'Import {n} accident',
  importFew: 'Import {n} accidents',
  importMany: 'Import {n} accidents',
  importNote:
    "The accidents become public sub-groups of this group, with a place, a pin and a description, and do not inherit its members. Each has a key (mup:ID), so importing again makes no duplicates.",
  resumeText: 'These files were imported up to {next} of {total}. The import goes on from {from}, one batch earlier: Potok knows the accidents it has by their keys.',
  resumeButton: 'Go on from {from}',
  restartButton: 'Start over',
  doneBefore: 'These files were imported to the end. Importing again makes no duplicates: Potok skips the accidents it has.',
  otherFiles: 'Other files',
  nothingToImport: 'There are no accidents to import. Check the year and the files.',

  importingTitle: 'Import',
  keepOpen:
    'Keep this tab open until the import is done. If the connection breaks or the page reloads, open “Uvoz” and choose the same files: the import goes on where it stopped.',
  progressOf: '{done} of {total}',
  statCreated: 'Created',
  statExisting: 'Already there',
  statFailed: 'Failed',
  statRate: 'Speed',
  statEta: 'Left',
  ratePerSecond: '{n} a second',
  etaHours: '{h} h {m} min',
  etaMinutes: '{m} min',
  etaSeconds: 'under a minute',
  batchSize: 'Batch: {n}',
  statusRunning: 'Sending batches…',
  statusPausing: 'Pausing after this batch…',
  statusPaused: 'The import is paused.',
  statusWaiting: 'Potok asks to slow down (write limit). The same batch goes again in a few seconds.',
  statusRetrying: 'Potok did not answer ({reason}). The same batch goes again, and the keys prevent duplicates.',
  pause: 'Pause',
  resume: 'Go on',

  reportDone: 'The import is done',
  reportStopped: 'The import stopped',
  stopForbidden: 'Potok refused the write: your rights in this group no longer allow making sub-groups.',
  stopStale: 'This app is no longer on screen, because the group\'s description changed. Open “Uvoz” again and choose the same files to go on.',
  stopOutdated: 'Potok does not know how to make sub-groups in batches (createChildren).',
  stopOther: 'Potok returned the error “{error}”.',
  reportSkipped: 'Rows skipped from the files: {n}',
  reportFailedTitle: 'Failed accidents',
  downloadCsv: 'Download a CSV of skipped and failed rows',
  csvFallback: 'If the download does not work, the CSV is here',
  csvCut: 'Here are the first {n} rows; the whole list is in the downloaded file.',
  newImport: 'New import',
  continueImport: 'Go on with the import',
  csvFile: 'file',
  csvLine: 'row',
  csvId: 'ID',
  csvReason: 'reason',
  csvFailed: 'failed',
};

const LETTERS: Record<string, string> = {
  a: 'а', b: 'б', c: 'ц', č: 'ч', ć: 'ћ', d: 'д', đ: 'ђ', e: 'е', f: 'ф', g: 'г', h: 'х', i: 'и',
  j: 'ј', k: 'к', l: 'л', m: 'м', n: 'н', o: 'о', p: 'п', r: 'р', s: 'с', š: 'ш', t: 'т', u: 'у',
  v: 'в', z: 'з', ž: 'ж',
};

const PAIRS: Record<string, string> = { lj: 'љ', nj: 'њ', dž: 'џ' };

// Words the Latin text keeps as they are: placeholders, names and codes.
// „Uvoz“ is the name the description has in the group, as its editors wrote it.
const KEPT = /(\{[a-z]+\}|Potok|createChildren|data\.gov\.rs|xlsx|CSV|mup:ID|ID|warning|„Uvoz“)/g;

const KEPT_AS: Record<string, string> = { Potok: 'Поток' };

/** Serbian Latin as Cyrillic: the app's own words, never what people typed. */
export function toCyrillic(text: string): string {
  return text
    .split(KEPT)
    .map((part, index) =>
      index % 2 === 1
        ? (KEPT_AS[part] ?? part)
        : part.replace(/lj|nj|dž|[a-zčćđšž]/giu, (latin) => {
            const lower = latin.toLowerCase();
            const cyrillic = PAIRS[lower] ?? LETTERS[lower] ?? latin;

            return latin[0] === latin[0].toUpperCase() && latin[0] !== latin[0].toLowerCase()
              ? cyrillic.toUpperCase()
              : cyrillic;
          }),
    )
    .join('');
}

export function language(tag: string): Lang {
  if (tag === 'en' || tag.startsWith('en-')) return 'en';
  return tag === 'sr-Cyrl' ? 'sr-Cyrl' : 'sr';
}

export type Values = Record<string, string | number>;

const fill = (text: string, values?: Values) =>
  values ? text.replace(/\{([a-z]+)\}/g, (whole, name: string) => (name in values ? String(values[name]) : whole)) : text;

/** Serbian chooses among three forms by the last digits. */
function pluralForm(n: number, lang: Lang): 'One' | 'Few' | 'Many' {
  if (lang === 'en') return n === 1 ? 'One' : 'Many';

  const tens = Math.abs(n) % 100;
  const ones = Math.abs(n) % 10;
  if (ones === 1 && tens !== 11) return 'One';
  if (ones >= 2 && ones <= 4 && (tens < 12 || tens > 14)) return 'Few';
  return 'Many';
}

export type PluralKey = 'import';

export function translator(tag: string) {
  const lang = language(tag);
  const word = (key: Key): string => (lang === 'en' ? en[key] : lang === 'sr-Cyrl' ? toCyrillic(sr[key]) : sr[key]);

  const t = (key: Key, values?: Values): string => fill(word(key), values);
  t.plural = (key: PluralKey, n: number, values?: Values): string => fill(word(`${key}${pluralForm(n, lang)}` as Key), { n, ...values });
  t.lang = lang;
  /** Numbers as the language writes them: 33.187 or 33,187. */
  t.number = (n: number, digits = 0): string =>
    n.toLocaleString(lang === 'en' ? 'en-GB' : 'sr-Latn-RS', { maximumFractionDigits: digits, minimumFractionDigits: 0 });

  return t;
}

export type Translate = ReturnType<typeof translator>;

const SKIP_KEYS: Record<SkipReason, Key> = {
  outsideSerbia: 'skipOutsideSerbia',
  noCoordinates: 'skipNoCoordinates',
  badDate: 'skipBadDate',
  unknownSeverity: 'skipUnknownSeverity',
  noId: 'skipNoId',
  otherYear: 'skipOtherYear',
};

export const skipKey = (reason: SkipReason): Key => SKIP_KEYS[reason];

export const keys = { sr: Object.keys(sr), en: Object.keys(en) };
