const enumCountryCodes = new Set(
  "AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EA EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU IC ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA QU RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS XC XK XL XS YE YT ZA ZM ZW".split(
    " ",
  ),
);

const countryAliases: Record<string, string> = {
  D: "DE",
  L: "LU",
  RA: "AR",
  USA: "US",
};

const countryNames: Record<string, string> = {
  AR: "Argentinien",
  CH: "Schweiz",
  DE: "Deutschland",
  LU: "Luxemburg",
  NL: "Niederlande",
  QU: "Nicht zugeordnet",
  US: "USA",
  XK: "Kosovo",
  XL: "Melilla",
  XS: "Serbien",
};

const europeCodes = new Set(
  "AD AL AT AX BA BE BG BY CH CY CZ DE DK EE ES FI FO FR GB GG GI GR HR HU IC IE IM IS IT JE LI LT LU LV MC MD ME MK MT NL NO PL PT RO RS RU SE SI SJ SK SM TR UA VA XK XL XS".split(
    " ",
  ),
);
const asiaCodes = new Set(
  "AE AF AM AZ BD BH BN BT CN GE HK ID IL IN IQ IR JO JP KG KH KP KR KW KZ LA LB LK MM MN MO MV MY NP OM PH PK PS QA SA SG SY TH TJ TL TM TW UZ VN YE".split(
    " ",
  ),
);

const displayNames =
  typeof Intl.DisplayNames === "function"
    ? new Intl.DisplayNames(["de"], { type: "region" })
    : null;

export function normalizeDepotCountryCode(value?: string) {
  const raw = String(value || "").trim().toUpperCase();
  return countryAliases[raw] || raw;
}

export function depotCountryName(value?: string) {
  const code = normalizeDepotCountryCode(value);
  if (!code || !enumCountryCodes.has(code) || code === "QU")
    return "Nicht zugeordnet";
  const automatic = displayNames?.of(code);
  return countryNames[code] || (automatic && automatic !== code ? automatic : code);
}

export function depotRegionForCountry(value?: string) {
  const code = normalizeDepotCountryCode(value);
  if (!code || !enumCountryCodes.has(code) || code === "QU")
    return "Nicht zugeordnet";
  if (code === "DE") return "Deutschland";
  if (code === "US") return "USA";
  if (code === "CH") return "Schweiz";
  if (asiaCodes.has(code)) return "Asien";
  if (europeCodes.has(code)) return "Europa";
  return "Sonstige";
}

