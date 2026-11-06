// The function dictionary: plain data, no logic, no imports.
// To add a language, add its code to `Lang` in settings.ts and a name to `names` below;
// a missing name falls back to English. Platform fields list only differences:
// a missing field means "same name, same arguments".

/** How a platform supports a function. */
export type Support =
  | {
      /** The function has another name there. */
      as?: string;
      /** Rewrite with a template in English syntax: $1, $2… are the arguments, $2* is "argument 2 and all after it". */
      template?: string;
      /** First version that has it, e.g. "Excel 2021 / Microsoft 365". */
      since?: string;
      /** A behaviour difference worth knowing. */
      note?: string;
    }
  | {
      /** No equivalent: why, and the workaround to suggest. */
      none: string;
    };

export interface FunctionEntry {
  /** English name on its home platform (Excel, unless the function exists only elsewhere). */
  en: string;
  names?: { fr?: string; de?: string; es?: string };
  excel?: Support;
  sheets?: Support;
  calc?: Support;
}

const M365 = "Excel 2021 / Microsoft 365";
const M365_NEW = "Microsoft 365 (2022 release)";
const LO248 = "LibreOffice 24.8";
const LO258 = "LibreOffice 25.8";

export const FUNCTIONS: FunctionEntry[] = [
  // Math and aggregation
  { en: "SUM", names: { fr: "SOMME", de: "SUMME", es: "SUMA" } },
  { en: "SUMIF", names: { fr: "SOMME.SI", de: "SUMMEWENN", es: "SUMAR.SI" } },
  { en: "SUMIFS", names: { fr: "SOMME.SI.ENS", de: "SUMMEWENNS", es: "SUMAR.SI.CONJUNTO" } },
  { en: "SUMPRODUCT", names: { fr: "SOMMEPROD", de: "SUMMENPRODUKT", es: "SUMAPRODUCTO" } },
  { en: "PRODUCT", names: { fr: "PRODUIT", de: "PRODUKT", es: "PRODUCTO" } },
  { en: "ROUND", names: { fr: "ARRONDI", de: "RUNDEN", es: "REDONDEAR" } },
  { en: "ROUNDUP", names: { fr: "ARRONDI.SUP", de: "AUFRUNDEN", es: "REDONDEAR.MAS" } },
  { en: "ROUNDDOWN", names: { fr: "ARRONDI.INF", de: "ABRUNDEN", es: "REDONDEAR.MENOS" } },
  { en: "MROUND", names: { fr: "ARRONDI.AU.MULTIPLE", de: "VRUNDEN", es: "REDOND.MULT" } },
  { en: "INT", names: { fr: "ENT", de: "GANZZAHL", es: "ENTERO" } },
  { en: "TRUNC", names: { fr: "TRONQUE", de: "KÜRZEN", es: "TRUNCAR" } },
  { en: "ABS" },
  { en: "MOD", names: { fr: "MOD", de: "REST", es: "RESIDUO" } },
  { en: "QUOTIENT", names: { fr: "QUOTIENT", de: "QUOTIENT", es: "COCIENTE" } },
  { en: "POWER", names: { fr: "PUISSANCE", de: "POTENZ", es: "POTENCIA" } },
  { en: "SQRT", names: { fr: "RACINE", de: "WURZEL", es: "RAIZ" } },
  { en: "EXP" },
  { en: "LN" },
  { en: "LOG" },
  { en: "LOG10" },
  { en: "PI" },
  { en: "SIGN", names: { fr: "SIGNE", de: "VORZEICHEN", es: "SIGNO" } },
  { en: "EVEN", names: { fr: "PAIR", de: "GERADE", es: "REDONDEA.PAR" } },
  { en: "ODD", names: { fr: "IMPAIR", de: "UNGERADE", es: "REDONDEA.IMPAR" } },
  { en: "GCD", names: { fr: "PGCD", de: "GGT", es: "M.C.D" } },
  { en: "LCM", names: { fr: "PPCM", de: "KGV", es: "M.C.M" } },
  { en: "FACT", names: { fr: "FACT", de: "FAKULTÄT", es: "FACT" } },
  { en: "COMBIN", names: { fr: "COMBIN", de: "KOMBINATIONEN", es: "COMBINAT" } },
  { en: "RAND", names: { fr: "ALEA", de: "ZUFALLSZAHL", es: "ALEATORIO" } },
  { en: "RANDBETWEEN", names: { fr: "ALEA.ENTRE.BORNES", de: "ZUFALLSBEREICH", es: "ALEATORIO.ENTRE" } },
  { en: "RANDARRAY", names: { fr: "TABLEAU.ALEA", de: "ZUFALLSMATRIX", es: "MATRIZALEAT" }, excel: { since: M365 }, calc: { since: LO248 } },
  { en: "CEILING", names: { fr: "PLAFOND", de: "OBERGRENZE", es: "MULTIPLO.SUPERIOR" } },
  { en: "FLOOR", names: { fr: "PLANCHER", de: "UNTERGRENZE", es: "MULTIPLO.INFERIOR" } },
  { en: "ROMAN", names: { fr: "ROMAIN", de: "RÖMISCH", es: "NUMERO.ROMANO" } },
  { en: "MMULT", names: { fr: "PRODUITMAT", de: "MMULT", es: "MMULT" } },
  { en: "SUBTOTAL", names: { fr: "SOUS.TOTAL", de: "TEILERGEBNIS", es: "SUBTOTALES" } },
  {
    en: "AGGREGATE",
    names: { fr: "AGREGAT", de: "AGGREGAT", es: "AGREGAR" },
    sheets: { none: "Google Sheets has no AGGREGATE. Use SUBTOTAL for hidden rows, or apply the function to FILTER(range, NOT(ISERROR(range))) to skip errors." },
  },

  // Statistics
  { en: "AVERAGE", names: { fr: "MOYENNE", de: "MITTELWERT", es: "PROMEDIO" } },
  { en: "AVERAGEA", names: { fr: "AVERAGEA", de: "MITTELWERTA", es: "PROMEDIOA" } },
  { en: "AVERAGEIF", names: { fr: "MOYENNE.SI", de: "MITTELWERTWENN", es: "PROMEDIO.SI" } },
  { en: "AVERAGEIFS", names: { fr: "MOYENNE.SI.ENS", de: "MITTELWERTWENNS", es: "PROMEDIO.SI.CONJUNTO" } },
  { en: "COUNT", names: { fr: "NB", de: "ANZAHL", es: "CONTAR" } },
  { en: "COUNTA", names: { fr: "NBVAL", de: "ANZAHL2", es: "CONTARA" } },
  { en: "COUNTBLANK", names: { fr: "NB.VIDE", de: "ANZAHLLEEREZELLEN", es: "CONTAR.BLANCO" } },
  { en: "COUNTIF", names: { fr: "NB.SI", de: "ZÄHLENWENN", es: "CONTAR.SI" } },
  { en: "COUNTIFS", names: { fr: "NB.SI.ENS", de: "ZÄHLENWENNS", es: "CONTAR.SI.CONJUNTO" } },
  { en: "MIN" },
  { en: "MAX" },
  { en: "MINIFS", names: { fr: "MIN.SI.ENS", de: "MINWENNS", es: "MIN.SI.CONJUNTO" }, excel: { since: "Excel 2019" } },
  { en: "MAXIFS", names: { fr: "MAX.SI.ENS", de: "MAXWENNS", es: "MAX.SI.CONJUNTO" }, excel: { since: "Excel 2019" } },
  { en: "MEDIAN", names: { fr: "MEDIANE", de: "MEDIAN", es: "MEDIANA" } },
  { en: "MODE", names: { fr: "MODE", de: "MODALWERT", es: "MODA" } },
  { en: "LARGE", names: { fr: "GRANDE.VALEUR", de: "KGRÖSSTE", es: "K.ESIMO.MAYOR" } },
  { en: "SMALL", names: { fr: "PETITE.VALEUR", de: "KKLEINSTE", es: "K.ESIMO.MENOR" } },
  { en: "RANK", names: { fr: "RANG", de: "RANG", es: "JERARQUIA" } },
  { en: "RANK.EQ", names: { fr: "EQUATION.RANG", de: "RANG.GLEICH", es: "JERARQUIA.EQV" } },
  { en: "PERCENTILE", names: { fr: "CENTILE", de: "QUANTIL", es: "PERCENTIL" } },
  { en: "QUARTILE", names: { fr: "QUARTILE", de: "QUARTILE", es: "CUARTIL" } },
  { en: "STDEV", names: { fr: "ECARTYPE", de: "STABW", es: "DESVEST" } },
  { en: "STDEV.S", names: { fr: "ECARTYPE.STANDARD", de: "STABW.S", es: "DESVEST.M" } },
  { en: "STDEV.P", names: { fr: "ECARTYPE.PEARSON", de: "STABW.N", es: "DESVEST.P" } },
  { en: "VAR.S", names: { fr: "VAR.S", de: "VAR.S", es: "VAR.S" } },
  { en: "CORREL", names: { fr: "COEFFICIENT.CORRELATION", de: "KORREL", es: "COEF.DE.CORREL" } },
  { en: "FORECAST", names: { fr: "PREVISION", de: "SCHÄTZER", es: "PRONOSTICO" } },
  { en: "TREND", names: { fr: "TENDANCE", de: "TREND", es: "TENDENCIA" } },
  { en: "GROWTH", names: { fr: "CROISSANCE", de: "VARIATION", es: "CRECIMIENTO" } },
  { en: "SLOPE", names: { fr: "PENTE", de: "STEIGUNG", es: "PENDIENTE" } },
  { en: "INTERCEPT", names: { fr: "ORDONNEE.ORIGINE", de: "ACHSENABSCHNITT", es: "INTERSECCION.EJE" } },
  { en: "FREQUENCY", names: { fr: "FREQUENCE", de: "HÄUFIGKEIT", es: "FRECUENCIA" } },

  // Logic
  { en: "IF", names: { fr: "SI", de: "WENN", es: "SI" } },
  { en: "IFS", names: { fr: "SI.CONDITIONS", de: "WENNS", es: "SI.CONJUNTO" }, excel: { since: "Excel 2019" } },
  { en: "IFERROR", names: { fr: "SIERREUR", de: "WENNFEHLER", es: "SI.ERROR" } },
  { en: "IFNA", names: { fr: "SI.NON.DISP", de: "WENNNV", es: "SI.ND" } },
  { en: "AND", names: { fr: "ET", de: "UND", es: "Y" } },
  { en: "OR", names: { fr: "OU", de: "ODER", es: "O" } },
  { en: "NOT", names: { fr: "NON", de: "NICHT", es: "NO" } },
  { en: "XOR", names: { fr: "OUX", de: "XODER", es: "XO" } },
  { en: "SWITCH", names: { fr: "SI.MULTIPLE", de: "ERSTERWERT", es: "CAMBIAR" }, excel: { since: "Excel 2019" } },
  { en: "TRUE", names: { fr: "VRAI", de: "WAHR", es: "VERDADERO" } },
  { en: "FALSE", names: { fr: "FAUX", de: "FALSCH", es: "FALSO" } },
  { en: "LET", excel: { since: M365 }, calc: { since: LO248 } },
  { en: "LAMBDA", excel: { since: M365 }, calc: { none: "LibreOffice Calc has no LAMBDA. Write the calculation out in full, or use a named expression for repeated parts." } },
  { en: "MAP", excel: { since: M365 }, calc: { none: "LibreOffice Calc has no MAP (it needs LAMBDA). Fill the calculation down a helper column instead." } },
  { en: "REDUCE", excel: { since: M365 }, calc: { none: "LibreOffice Calc has no REDUCE (it needs LAMBDA). Use a running total in a helper column." } },
  { en: "BYROW", excel: { since: M365 }, calc: { none: "LibreOffice Calc has no BYROW (it needs LAMBDA). Fill the per-row formula down a helper column." } },
  { en: "BYCOL", excel: { since: M365 }, calc: { none: "LibreOffice Calc has no BYCOL (it needs LAMBDA). Fill the per-column formula across a helper row." } },

  // Information
  { en: "ISBLANK", names: { fr: "ESTVIDE", de: "ISTLEER", es: "ESBLANCO" } },
  { en: "ISERROR", names: { fr: "ESTERREUR", de: "ISTFEHLER", es: "ESERROR" } },
  { en: "ISERR", names: { fr: "ESTERR", de: "ISTFEHL", es: "ESERR" } },
  { en: "ISNA", names: { fr: "ESTNA", de: "ISTNV", es: "ESNOD" } },
  { en: "ISNUMBER", names: { fr: "ESTNUM", de: "ISTZAHL", es: "ESNUMERO" } },
  { en: "ISTEXT", names: { fr: "ESTTEXTE", de: "ISTTEXT", es: "ESTEXTO" } },
  { en: "ISNONTEXT", names: { fr: "ESTNONTEXTE", de: "ISTKTEXT", es: "ESNOTEXTO" } },
  { en: "ISLOGICAL", names: { fr: "ESTLOGIQUE", de: "ISTLOG", es: "ESLOGICO" } },
  { en: "ISREF", names: { fr: "ESTREF", de: "ISTBEZUG", es: "ESREF" } },
  { en: "ISEVEN", names: { fr: "EST.PAIR", de: "ISTGERADE", es: "ES.PAR" } },
  { en: "ISODD", names: { fr: "EST.IMPAIR", de: "ISTUNGERADE", es: "ES.IMPAR" } },
  { en: "ISFORMULA", names: { fr: "ESTFORMULE", de: "ISTFORMEL", es: "ESFORMULA" } },
  { en: "FORMULATEXT", names: { fr: "FORMULETEXTE", de: "FORMELTEXT", es: "FORMULATEXTO" } },
  { en: "NA", names: { fr: "NA", de: "NV", es: "NOD" } },
  { en: "N" },
  { en: "T" },
  { en: "TYPE", names: { fr: "TYPE", de: "TYP", es: "TIPO" } },
  { en: "ERROR.TYPE", names: { fr: "TYPE.ERREUR", de: "FEHLER.TYP", es: "TIPO.DE.ERROR" } },
  { en: "CELL", names: { fr: "CELLULE", de: "ZELLE", es: "CELDA" }, sheets: { note: "Google Sheets supports only some info types of CELL (such as \"address\", \"col\", \"contents\", \"row\", \"type\")." } },
  { en: "INFO", names: { fr: "INFORMATIONS", de: "INFO", es: "INFO" }, sheets: { none: "Google Sheets has no INFO. Type the value you need (for example the number of sheets) by hand." } },

  // Lookup and reference
  { en: "VLOOKUP", names: { fr: "RECHERCHEV", de: "SVERWEIS", es: "BUSCARV" } },
  { en: "HLOOKUP", names: { fr: "RECHERCHEH", de: "WVERWEIS", es: "BUSCARH" } },
  { en: "LOOKUP", names: { fr: "RECHERCHE", de: "VERWEIS", es: "BUSCAR" } },
  { en: "XLOOKUP", names: { fr: "RECHERCHEX", de: "XVERWEIS", es: "BUSCARX" }, excel: { since: M365 }, calc: { since: LO248 } },
  { en: "INDEX", names: { fr: "INDEX", de: "INDEX", es: "INDICE" } },
  { en: "MATCH", names: { fr: "EQUIV", de: "VERGLEICH", es: "COINCIDIR" } },
  { en: "XMATCH", names: { fr: "EQUIVX", de: "XVERGLEICH", es: "COINCIDIRX" }, excel: { since: M365 }, calc: { since: LO248 } },
  { en: "CHOOSE", names: { fr: "CHOISIR", de: "WAHL", es: "ELEGIR" } },
  { en: "OFFSET", names: { fr: "DECALER", de: "BEREICH.VERSCHIEBEN", es: "DESREF" } },
  { en: "INDIRECT", names: { fr: "INDIRECT", de: "INDIREKT", es: "INDIRECTO" }, calc: { note: "INDIRECT text must use LibreOffice reference syntax (Sheet1.A1), unless “Excel A1” syntax is turned on in LibreOffice." } },
  { en: "ADDRESS", names: { fr: "ADRESSE", de: "ADRESSE", es: "DIRECCION" } },
  { en: "ROW", names: { fr: "LIGNE", de: "ZEILE", es: "FILA" } },
  { en: "ROWS", names: { fr: "LIGNES", de: "ZEILEN", es: "FILAS" } },
  { en: "COLUMN", names: { fr: "COLONNE", de: "SPALTE", es: "COLUMNA" } },
  { en: "COLUMNS", names: { fr: "COLONNES", de: "SPALTEN", es: "COLUMNAS" } },
  { en: "AREAS", names: { fr: "ZONES", de: "BEREICHE", es: "AREAS" } },
  { en: "TRANSPOSE", names: { fr: "TRANSPOSE", de: "MTRANS", es: "TRANSPONER" } },
  { en: "HYPERLINK", names: { fr: "LIEN_HYPERTEXTE", de: "HYPERLINK", es: "HIPERVINCULO" } },
  { en: "GETPIVOTDATA", names: { fr: "LIREDONNEESTABCROISDYNAMIQUE", de: "PIVOTDATENZUORDNEN", es: "IMPORTARDATOSDINAMICOS" } },
  { en: "FILTER", names: { fr: "FILTRE", de: "FILTERN", es: "FILTRAR" }, excel: { since: M365 }, calc: { since: LO248 }, sheets: { note: "Google Sheets FILTER takes each condition as a separate argument and has no if_empty argument: FILTER(range, cond1, cond2). Wrap it in IFERROR for the “nothing found” case." } },
  { en: "SORT", names: { fr: "TRIER", de: "SORTIEREN", es: "ORDENAR" }, excel: { since: M365 }, calc: { since: LO248 }, sheets: { note: "Google Sheets SORT takes (range, sort_column, is_ascending, …) where Excel takes (array, sort_index, sort_order, by_col): check the third argument (TRUE/FALSE in Sheets, 1/-1 in Excel)." } },
  { en: "SORTBY", names: { fr: "TRIERPAR", de: "SORTIERENNACH", es: "ORDENARPOR" }, excel: { since: M365 }, calc: { since: LO248 }, sheets: { as: "SORT", note: "Google Sheets has no SORTBY; its SORT accepts a range of values to sort by: SORT(range, by_range, TRUE). Check the order arguments (TRUE/FALSE instead of 1/-1)." } },
  { en: "UNIQUE", names: { fr: "UNIQUE", de: "EINDEUTIG", es: "UNICOS" }, excel: { since: M365 }, calc: { since: LO248 } },
  { en: "SEQUENCE", names: { fr: "SEQUENCE", de: "SEQUENZ", es: "SECUENCIA" }, excel: { since: M365 }, calc: { since: LO248 } },
  { en: "VSTACK", names: { fr: "ASSEMB.V", de: "VSTAPELN", es: "APILARV" }, excel: { since: M365_NEW }, calc: { since: LO258 } },
  { en: "HSTACK", names: { fr: "ASSEMB.H", de: "HSTAPELN", es: "APILARH" }, excel: { since: M365_NEW }, calc: { since: LO258 } },
  { en: "TOCOL", excel: { since: M365_NEW }, calc: { since: LO258 } },
  { en: "TOROW", excel: { since: M365_NEW }, calc: { since: LO258 } },
  { en: "CHOOSECOLS", excel: { since: M365_NEW }, calc: { since: LO258 } },
  { en: "CHOOSEROWS", excel: { since: M365_NEW }, calc: { since: LO258 } },
  { en: "WRAPROWS", excel: { since: M365_NEW }, calc: { since: LO258 } },
  { en: "WRAPCOLS", excel: { since: M365_NEW }, calc: { since: LO258 } },
  { en: "TAKE", excel: { since: M365_NEW }, calc: { since: LO258 }, sheets: { none: "Google Sheets has no TAKE. For the first n rows use ARRAY_CONSTRAIN(range, n, COLUMNS(range)), or CHOOSEROWS(range, SEQUENCE(n))." } },
  { en: "DROP", excel: { since: M365_NEW }, calc: { since: LO258 }, sheets: { none: "Google Sheets has no DROP. To skip the first n rows use CHOOSEROWS(range, SEQUENCE(ROWS(range) - n, 1, n + 1)), or OFFSET." } },
  { en: "EXPAND", excel: { since: M365_NEW }, calc: { since: LO258 }, sheets: { none: "Google Sheets has no EXPAND. Pad the result with an array literal {range; …} or IFERROR around a larger range." } },

  // Text
  { en: "CONCATENATE", names: { fr: "CONCATENER", de: "VERKETTEN", es: "CONCATENAR" } },
  { en: "CONCAT", names: { fr: "CONCAT", de: "TEXTKETTE", es: "CONCAT" }, excel: { since: "Excel 2019" }, sheets: { as: "CONCATENATE", note: "Google Sheets CONCAT joins exactly two values, so CONCATENATE (any number of values) is used instead." } },
  { en: "TEXTJOIN", names: { fr: "JOINDRE.TEXTE", de: "TEXTVERKETTEN", es: "UNIRCADENAS" }, excel: { since: "Excel 2019" } },
  { en: "LEFT", names: { fr: "GAUCHE", de: "LINKS", es: "IZQUIERDA" } },
  { en: "RIGHT", names: { fr: "DROITE", de: "RECHTS", es: "DERECHA" } },
  { en: "MID", names: { fr: "STXT", de: "TEIL", es: "EXTRAE" } },
  { en: "LEN", names: { fr: "NBCAR", de: "LÄNGE", es: "LARGO" } },
  { en: "FIND", names: { fr: "TROUVE", de: "FINDEN", es: "ENCONTRAR" } },
  { en: "SEARCH", names: { fr: "CHERCHE", de: "SUCHEN", es: "HALLAR" } },
  { en: "SUBSTITUTE", names: { fr: "SUBSTITUE", de: "WECHSELN", es: "SUSTITUIR" } },
  { en: "REPLACE", names: { fr: "REMPLACER", de: "ERSETZEN", es: "REEMPLAZAR" } },
  { en: "UPPER", names: { fr: "MAJUSCULE", de: "GROSS", es: "MAYUSC" } },
  { en: "LOWER", names: { fr: "MINUSCULE", de: "KLEIN", es: "MINUSC" } },
  { en: "PROPER", names: { fr: "NOMPROPRE", de: "GROSS2", es: "NOMPROPIO" } },
  { en: "TRIM", names: { fr: "SUPPRESPACE", de: "GLÄTTEN", es: "ESPACIOS" } },
  { en: "CLEAN", names: { fr: "EPURAGE", de: "SÄUBERN", es: "LIMPIAR" } },
  { en: "TEXT", names: { fr: "TEXTE", de: "TEXT", es: "TEXTO" }, sheets: { note: "Format codes are mostly the same, but locale-specific codes (such as JJ/MM/AAAA in French Excel) must be written the way the target expects." } },
  { en: "VALUE", names: { fr: "CNUM", de: "WERT", es: "VALOR" } },
  { en: "NUMBERVALUE", names: { fr: "VALEURNOMBRE", de: "ZAHLENWERT", es: "VALOR.NUMERO" } },
  { en: "FIXED", names: { fr: "CTXT", de: "FEST", es: "DECIMAL" } },
  { en: "REPT", names: { fr: "REPT", de: "WIEDERHOLEN", es: "REPETIR" } },
  { en: "EXACT", names: { fr: "EXACT", de: "IDENTISCH", es: "IGUAL" } },
  { en: "CHAR", names: { fr: "CAR", de: "ZEICHEN", es: "CARACTER" } },
  { en: "CODE", names: { fr: "CODE", de: "CODE", es: "CODIGO" } },
  { en: "UNICHAR", names: { fr: "UNICAR", de: "UNIZEICHEN", es: "UNICAR" } },
  { en: "TEXTBEFORE", names: { fr: "TEXTE.AVANT", de: "TEXTVOR", es: "TEXTOANTES" }, excel: { since: M365_NEW }, calc: { since: LO258 }, sheets: { none: "Google Sheets has no TEXTBEFORE. Use REGEXEXTRACT(text, \"^(.*?)\" & delimiter) for the first occurrence, or LEFT(text, SEARCH(delimiter, text) - 1)." } },
  { en: "TEXTAFTER", names: { fr: "TEXTE.APRES", de: "TEXTNACH", es: "TEXTODESPUES" }, excel: { since: M365_NEW }, calc: { since: LO258 }, sheets: { none: "Google Sheets has no TEXTAFTER. Use REGEXEXTRACT(text, delimiter & \"(.*)$\"), or MID(text, SEARCH(delimiter, text) + LEN(delimiter), LEN(text))." } },
  { en: "TEXTSPLIT", names: { fr: "FRACTIONNER.TEXTE", de: "TEXTTEILEN", es: "DIVIDIRTEXTO" }, excel: { since: M365_NEW }, calc: { since: LO258 }, sheets: { template: "SPLIT($1, $2, FALSE)", note: "Converted to SPLIT(text, delimiter, FALSE): FALSE makes SPLIT treat the delimiter as a whole string, as TEXTSPLIT does. TEXTSPLIT's row delimiter and other options have no SPLIT equivalent." } },
  { en: "ENCODEURL", names: { fr: "URLENCODAGE", de: "URLCODIEREN", es: "URLCODIF" } },
  { en: "WEBSERVICE", names: { fr: "SERVICEWEB", de: "WEBDIENST", es: "SERVICIOWEB" }, sheets: { none: "Google Sheets has no WEBSERVICE. IMPORTDATA(url) (CSV/TSV), IMPORTXML(url, xpath) or IMPORTHTML can read web data instead." } },
  { en: "FILTERXML", names: { fr: "FILTRE.XML", de: "XMLFILTERN", es: "XMLFILTRO" }, sheets: { none: "Google Sheets has no FILTERXML. IMPORTXML(url, xpath) reads XML from a URL; for XML text in a cell, use REGEXEXTRACT." } },
  { en: "PHONETIC", names: { fr: "PHONETIQUE", de: "PHONETISCH", es: "FONETICO" }, sheets: { none: "Google Sheets has no PHONETIC (Japanese furigana). There is no workaround in formulas." }, calc: { none: "LibreOffice Calc has no PHONETIC (Japanese furigana)." } },

  // Date and time
  { en: "TODAY", names: { fr: "AUJOURDHUI", de: "HEUTE", es: "HOY" } },
  { en: "NOW", names: { fr: "MAINTENANT", de: "JETZT", es: "AHORA" } },
  { en: "DATE", names: { fr: "DATE", de: "DATUM", es: "FECHA" } },
  { en: "TIME", names: { fr: "TEMPS", de: "ZEIT", es: "NSHORA" } },
  { en: "DATEVALUE", names: { fr: "DATEVAL", de: "DATWERT", es: "FECHANUMERO" } },
  { en: "TIMEVALUE", names: { fr: "TEMPSVAL", de: "ZEITWERT", es: "HORANUMERO" } },
  { en: "YEAR", names: { fr: "ANNEE", de: "JAHR", es: "AÑO" } },
  { en: "MONTH", names: { fr: "MOIS", de: "MONAT", es: "MES" } },
  { en: "DAY", names: { fr: "JOUR", de: "TAG", es: "DIA" } },
  { en: "HOUR", names: { fr: "HEURE", de: "STUNDE", es: "HORA" } },
  { en: "MINUTE", names: { fr: "MINUTE", de: "MINUTE", es: "MINUTO" } },
  { en: "SECOND", names: { fr: "SECONDE", de: "SEKUNDE", es: "SEGUNDO" } },
  { en: "WEEKDAY", names: { fr: "JOURSEM", de: "WOCHENTAG", es: "DIASEM" } },
  { en: "WEEKNUM", names: { fr: "NO.SEMAINE", de: "KALENDERWOCHE", es: "NUM.DE.SEMANA" } },
  { en: "ISOWEEKNUM", names: { fr: "NO.SEMAINE.ISO", de: "ISOKALENDERWOCHE", es: "ISO.NUM.DE.SEMANA" } },
  { en: "EDATE", names: { fr: "MOIS.DECALER", de: "EDATUM", es: "FECHA.MES" } },
  { en: "EOMONTH", names: { fr: "FIN.MOIS", de: "MONATSENDE", es: "FIN.MES" } },
  { en: "NETWORKDAYS", names: { fr: "NB.JOURS.OUVRES", de: "NETTOARBEITSTAGE", es: "DIAS.LAB" } },
  { en: "NETWORKDAYS.INTL", names: { fr: "NB.JOURS.OUVRES.INTL", de: "NETTOARBEITSTAGE.INTL", es: "DIAS.LAB.INTL" } },
  { en: "WORKDAY", names: { fr: "SERIE.JOUR.OUVRE", de: "ARBEITSTAG", es: "DIA.LAB" } },
  { en: "WORKDAY.INTL", names: { fr: "SERIE.JOUR.OUVRE.INTL", de: "ARBEITSTAG.INTL", es: "DIA.LAB.INTL" } },
  { en: "DATEDIF", names: { fr: "DATEDIF", de: "DATEDIF", es: "SIFECHA" } },
  { en: "DAYS", names: { fr: "JOURS", de: "TAGE", es: "DIAS" } },
  { en: "DAYS360", names: { fr: "JOURS360", de: "TAGE360", es: "DIAS360" } },
  { en: "YEARFRAC", names: { fr: "FRACTION.ANNEE", de: "BRTEILJAHRE", es: "FRAC.AÑO" } },

  // Finance
  { en: "PMT", names: { fr: "VPM", de: "RMZ", es: "PAGO" } },
  { en: "FV", names: { fr: "VC", de: "ZW", es: "VF" } },
  { en: "PV", names: { fr: "VA", de: "BW", es: "VA" } },
  { en: "NPV", names: { fr: "VAN", de: "NBW", es: "VNA" } },
  { en: "IRR", names: { fr: "TRI", de: "IKV", es: "TIR" } },
  { en: "RATE", names: { fr: "TAUX", de: "ZINS", es: "TASA" } },
  { en: "NPER", names: { fr: "NPM", de: "ZZR", es: "NPER" } },

  // Excel only
  { en: "STOCKHISTORY", excel: { since: M365 }, sheets: { none: "Google Sheets has no STOCKHISTORY. GOOGLEFINANCE(ticker, \"price\", start_date, end_date, \"DAILY\") returns similar history, with different arguments." }, calc: { none: "LibreOffice Calc has no stock data functions." } },
  { en: "CUBEVALUE", sheets: { none: "Google Sheets cannot connect to OLAP cubes. Import the data and use SUMIFS or a pivot table." }, calc: { none: "LibreOffice Calc cannot read OLAP cubes with formulas. Import the data and use SUMIFS or a pivot table." } },
  { en: "RTD", sheets: { none: "Google Sheets has no real-time data (RTD) servers. GOOGLEFINANCE covers market data; other feeds need Apps Script." }, calc: { none: "LibreOffice Calc has no RTD." } },
  { en: "IMAGE", excel: { since: M365_NEW }, calc: { none: "LibreOffice Calc has no IMAGE function. Insert the picture with Insert ▸ Image." } },
  { en: "REGEXTEST", excel: { since: "Microsoft 365 (2024 release)" }, sheets: { as: "REGEXMATCH" }, calc: { template: "NOT(ISNA(REGEX($1, $2)))", note: "LibreOffice has no REGEXTEST; REGEX returns #N/A when nothing matches, so NOT(ISNA(REGEX(…))) gives TRUE or FALSE." } },
  { en: "REGEXEXTRACT", excel: { since: "Microsoft 365 (2024 release)" }, calc: { template: "REGEX($1, $2)", note: "LibreOffice's REGEX(text, pattern) returns the first match; Excel's extra arguments (return mode, case) are dropped." } },
  { en: "REGEXREPLACE", excel: { since: "Microsoft 365 (2024 release)", note: "Excel's REGEXREPLACE replaces every match by default, like Google Sheets." }, calc: { template: "REGEX($1, $2, $3, \"g\")", note: "LibreOffice's REGEX needs the \"g\" flag to replace every match." } },

  // Google Sheets only
  { en: "ARRAYFORMULA", excel: { template: "$1", note: "ARRAYFORMULA was removed: Excel 365 spills array results automatically. In Excel 2019 or older, enter the formula with Ctrl+Shift+Enter." }, calc: { template: "$1", note: "ARRAYFORMULA was removed: in LibreOffice, enter the formula with Ctrl+Shift+Enter to make it an array formula." } },
  { en: "QUERY", excel: { none: "Excel has no QUERY. Rebuild it with FILTER, SORT and UNIQUE (and SUMIFS or GROUPBY for totals), or load the data with Power Query." }, calc: { none: "LibreOffice Calc has no QUERY. Use a pivot table or the Data ▸ More Filters ▸ Standard Filter, or FILTER and SORT in LibreOffice 24.8+." } },
  { en: "IMPORTRANGE", excel: { none: "Excel has no IMPORTRANGE. Link to the other workbook directly ('[Book.xlsx]Sheet1'!A1) or use Power Query." }, calc: { none: "LibreOffice Calc has no IMPORTRANGE. Link to the other file with Sheet ▸ Insert Sheet from File or an external reference ('file:///…'#$Sheet1.A1)." } },
  { en: "IMPORTXML", excel: { none: "Excel has no IMPORTXML. Use WEBSERVICE(url) with FILTERXML(xml, xpath) in Excel for Windows, or Power Query." }, calc: { none: "LibreOffice Calc has no IMPORTXML. Use WEBSERVICE(url) with FILTERXML(xml, xpath)." } },
  { en: "IMPORTHTML", excel: { none: "Excel has no IMPORTHTML. Use Data ▸ From Web (Power Query) to import a table from a page." }, calc: { none: "LibreOffice Calc has no IMPORTHTML. Use Sheet ▸ External Links to import a table from a page." } },
  { en: "IMPORTDATA", excel: { none: "Excel has no IMPORTDATA. Use Data ▸ From Text/CSV or From Web (Power Query)." }, calc: { none: "LibreOffice Calc has no IMPORTDATA. Use Sheet ▸ External Links or WEBSERVICE." } },
  { en: "IMPORTFEED", excel: { none: "Excel has no IMPORTFEED. Use Power Query (From Web) on the feed URL." }, calc: { none: "LibreOffice Calc has no IMPORTFEED." } },
  { en: "GOOGLEFINANCE", excel: { none: "Excel has no GOOGLEFINANCE. Microsoft 365 offers STOCKHISTORY and Stocks data types instead." }, calc: { none: "LibreOffice Calc has no market data function." } },
  { en: "GOOGLETRANSLATE", excel: { none: "Excel has no GOOGLETRANSLATE in its formula language." }, calc: { none: "LibreOffice Calc has no translation function." } },
  { en: "DETECTLANGUAGE", excel: { none: "Excel has no DETECTLANGUAGE." }, calc: { none: "LibreOffice Calc has no DETECTLANGUAGE." } },
  { en: "SPARKLINE", excel: { none: "Excel draws sparklines with Insert ▸ Sparklines, not with a formula." }, calc: { none: "LibreOffice Calc draws sparklines with Insert ▸ Sparkline (version 7.4+), not with a formula." } },
  { en: "REGEXMATCH", excel: { as: "REGEXTEST", since: "Microsoft 365 (2024 release)" }, calc: { template: "NOT(ISNA(REGEX($1, $2)))", note: "LibreOffice has no REGEXMATCH; REGEX returns #N/A when nothing matches, so NOT(ISNA(REGEX(…))) gives TRUE or FALSE." } },
  { en: "SPLIT", excel: { template: "TEXTSPLIT($1, $2)", note: "SPLIT splits at each character of the delimiter by default; TEXTSPLIT treats it as one string. Use a list of delimiters such as {\",\", \";\"} in TEXTSPLIT if each character was meant." }, calc: { template: "TEXTSPLIT($1, $2)" } },
  { en: "JOIN", excel: { template: "TEXTJOIN($1, FALSE, $2*)", note: "JOIN keeps empty values, so TEXTJOIN's ignore_empty is FALSE." }, calc: { template: "TEXTJOIN($1, FALSE, $2*)" } },
  { en: "FLATTEN", excel: { as: "TOCOL", since: M365_NEW, note: "FLATTEN reads row by row like TOCOL's default." }, calc: { as: "TOCOL", since: LO258 } },
  { en: "COUNTUNIQUE", excel: { template: "COUNTA(UNIQUE($1*))", note: "COUNTUNIQUE ignores empty cells; COUNTA(UNIQUE(…)) counts one empty value if the range has blanks. Use COUNTA(UNIQUE(FILTER(range, range<>\"\"))) for an exact match." }, calc: { template: "COUNTA(UNIQUE($1*))" } },
  { en: "SORTN", excel: { template: "TAKE(SORT($1), $2)", note: "Only the first two SORTN arguments (range, n) are converted; SORTN's tie mode and sort columns need SORT's arguments." }, calc: { template: "TAKE(SORT($1), $2)" } },
  { en: "ARRAY_CONSTRAIN", excel: { template: "TAKE($1, $2, $3)" }, calc: { template: "TAKE($1, $2, $3)" } },
  { en: "ISEMAIL", excel: { none: "Excel has no ISEMAIL. A rough check: AND(ISNUMBER(SEARCH(\"@\", A1)), ISNUMBER(SEARCH(\".\", A1))), or REGEXTEST in Microsoft 365." }, calc: { none: "LibreOffice Calc has no ISEMAIL. Use NOT(ISNA(REGEX(A1, \"^[^@ ]+@[^@ ]+\\.[^@ ]+$\")))." } },
  { en: "ISURL", excel: { none: "Excel has no ISURL. A rough check: LEFT(A1, 4)=\"http\"." }, calc: { none: "LibreOffice Calc has no ISURL. Use NOT(ISNA(REGEX(A1, \"^https?://\")))." } },
  { en: "TO_DATE", excel: { template: "$1", note: "Excel has no TO_DATE: the number was kept; apply a date format to the cell." }, calc: { template: "$1", note: "LibreOffice has no TO_DATE: apply a date format to the cell." } },
  { en: "TO_TEXT", excel: { template: "TEXT($1, \"@\")", note: "Converted to TEXT(value, \"@\"); for numbers, give TEXT the format you want." }, calc: { template: "TEXT($1, \"@\")" } },
  { en: "TO_PERCENT", excel: { template: "$1", note: "Excel has no TO_PERCENT: the value was kept; apply a percentage format to the cell." }, calc: { template: "$1", note: "Apply a percentage format to the cell." } },

  // LibreOffice only
  { en: "DAYSINMONTH", excel: { template: "DAY(EOMONTH($1, 0))" }, sheets: { template: "DAY(EOMONTH($1, 0))" } },
  { en: "DAYSINYEAR", excel: { template: "DATE(YEAR($1) + 1, 1, 1) - DATE(YEAR($1), 1, 1)" }, sheets: { template: "DATE(YEAR($1) + 1, 1, 1) - DATE(YEAR($1), 1, 1)" } },
  { en: "ISLEAPYEAR", excel: { template: "DAY(EOMONTH(DATE(YEAR($1), 2, 1), 0)) = 29" }, sheets: { template: "DAY(EOMONTH(DATE(YEAR($1), 2, 1), 0)) = 29" } },
  { en: "MONTHS", excel: { template: "DATEDIF($1, $2, \"m\")", note: "MONTHS with type 0 counts whole months like DATEDIF \"m\"; type 1 (calendar months) is not the same." }, sheets: { template: "DATEDIF($1, $2, \"m\")", note: "MONTHS with type 0 counts whole months like DATEDIF \"m\"; type 1 (calendar months) is not the same." } },
  { en: "YEARS", excel: { template: "DATEDIF($1, $2, \"y\")", note: "YEARS with type 0 counts whole years like DATEDIF \"y\"." }, sheets: { template: "DATEDIF($1, $2, \"y\")", note: "YEARS with type 0 counts whole years like DATEDIF \"y\"." } },
  { en: "WEEKS", excel: { template: "INT(($2 - $1) / 7)", note: "WEEKS with type 0 counts whole weeks between the dates." }, sheets: { template: "INT(($2 - $1) / 7)", note: "WEEKS with type 0 counts whole weeks between the dates." } },
  { en: "EASTERSUNDAY", excel: { none: "Excel has no EASTERSUNDAY. Use a lookup table of Easter dates, or a published Easter (computus) formula." }, sheets: { none: "Google Sheets has no EASTERSUNDAY. Use a lookup table of Easter dates or a computus formula." } },
  { en: "REGEX", excel: { none: "Excel has no REGEX. In Microsoft 365 use REGEXEXTRACT(text, pattern) to extract or REGEXREPLACE(text, pattern, replacement) to replace." }, sheets: { none: "Google Sheets has no REGEX. Use REGEXEXTRACT(text, pattern) to extract or REGEXREPLACE(text, pattern, replacement) to replace." } },
  { en: "STYLE", excel: { none: "Excel has no STYLE function. Use conditional formatting to change a cell's look." }, sheets: { none: "Google Sheets has no STYLE function. Use conditional formatting." } },
  { en: "ROT13", excel: { none: "Excel has no ROT13." }, sheets: { none: "Google Sheets has no ROT13." } },
];

/** Which entries belong to which platform only, for the README and the page. */
export const HOME: Record<string, "sheets" | "calc"> = {
  ARRAYFORMULA: "sheets", QUERY: "sheets", IMPORTRANGE: "sheets", IMPORTXML: "sheets", IMPORTHTML: "sheets", IMPORTDATA: "sheets", IMPORTFEED: "sheets",
  GOOGLEFINANCE: "sheets", GOOGLETRANSLATE: "sheets", DETECTLANGUAGE: "sheets", SPARKLINE: "sheets", REGEXMATCH: "sheets", SPLIT: "sheets", JOIN: "sheets",
  FLATTEN: "sheets", COUNTUNIQUE: "sheets", SORTN: "sheets", ARRAY_CONSTRAIN: "sheets", ISEMAIL: "sheets", ISURL: "sheets", TO_DATE: "sheets", TO_TEXT: "sheets", TO_PERCENT: "sheets",
  DAYSINMONTH: "calc", DAYSINYEAR: "calc", ISLEAPYEAR: "calc", MONTHS: "calc", YEARS: "calc", WEEKS: "calc", EASTERSUNDAY: "calc", REGEX: "calc", STYLE: "calc", ROT13: "calc",
};

