// Purpose, argument names and what each function returns, written from the public function
// references of Microsoft Excel, Google Sheets and LibreOffice Calc (checked 2026-10-30).
// Format per line: NAME | category | purpose | arguments | returns
// Arguments: [x] = optional; a trailing "..." means the names before it (marked with *) repeat.

export interface FunctionInfo {
  name: string;
  category: string;
  purpose: string;
  args: string[];
  /** How many of the last argument names repeat (SUMIFS repeats criteria_range/criteria pairs). */
  repeat: number;
  returns: string;
}

const RAW = `
SUM|Math|Adds numbers, cells and ranges.|number1, [number2*], ...|the total, a number
SUMIF|Math|Adds the cells of a range that meet one condition.|range, criteria, [sum_range]|the total of the matching cells
SUMIFS|Math|Adds the cells that meet every one of several conditions.|sum_range, criteria_range1, criteria1, [criteria_range2*], [criteria2*], ...|the total of the rows that match all conditions
SUMPRODUCT|Math|Multiplies matching items of arrays and adds the products.|array1, [array2*], ...|the sum of the products, a number
PRODUCT|Math|Multiplies numbers together.|number1, [number2*], ...|the product, a number
ROUND|Math|Rounds a number to a number of digits.|number, num_digits|the rounded number
ROUNDUP|Math|Rounds a number away from zero.|number, num_digits|the rounded number
ROUNDDOWN|Math|Rounds a number toward zero.|number, num_digits|the rounded number
MROUND|Math|Rounds to the nearest multiple.|number, multiple|the rounded number
CEILING|Math|Rounds up to the nearest multiple of significance.|number, significance|the rounded number
FLOOR|Math|Rounds down to the nearest multiple of significance.|number, significance|the rounded number
INT|Math|Rounds down to the nearest whole number.|number|a whole number
TRUNC|Math|Cuts off the decimal part of a number.|number, [num_digits]|the shortened number
ABS|Math|Removes the sign of a number.|number|the absolute value
MOD|Math|Gives the remainder after division.|number, divisor|the remainder
QUOTIENT|Math|Gives the whole-number part of a division.|numerator, denominator|a whole number
POWER|Math|Raises a number to a power.|number, power|a number
SQRT|Math|Square root of a number.|number|a number
EXP|Math|e raised to a power.|number|a number
LN|Math|Natural logarithm.|number|a number
LOG|Math|Logarithm to a base (10 when omitted).|number, [base]|a number
LOG10|Math|Base-10 logarithm.|number|a number
PI|Math|The number pi.||3.14159…
SIGN|Math|Tells whether a number is positive, negative or zero.|number|1, -1 or 0
RAND|Math|A random number between 0 and 1, new on every recalculation.||a random decimal
RANDBETWEEN|Math|A random whole number between two limits.|bottom, top|a random whole number
SUBTOTAL|Math|Applies a function (sum, count, average…) and can skip hidden rows.|function_num, ref1, [ref2*], ...|the chosen summary, a number
AGGREGATE|Math|Like SUBTOTAL but can also skip error values.|function_num, options, ref1, [ref2*], ...|the chosen summary, a number
MMULT|Math|Matrix product of two arrays.|array1, array2|an array of numbers
GCD|Math|Greatest common divisor.|number1, [number2*], ...|a whole number
LCM|Math|Least common multiple.|number1, [number2*], ...|a whole number
AVERAGE|Statistics|Arithmetic mean of numbers.|number1, [number2*], ...|the average, a number
AVERAGEIF|Statistics|Average of the cells that meet one condition.|range, criteria, [average_range]|the average of the matching cells
AVERAGEIFS|Statistics|Average of the cells that meet every condition.|average_range, criteria_range1, criteria1, [criteria_range2*], [criteria2*], ...|the average of the matching rows
COUNT|Statistics|Counts cells that contain numbers.|value1, [value2*], ...|a count
COUNTA|Statistics|Counts cells that are not empty.|value1, [value2*], ...|a count
COUNTBLANK|Statistics|Counts empty cells.|range|a count
COUNTIF|Statistics|Counts the cells that meet one condition.|range, criteria|a count
COUNTIFS|Statistics|Counts the rows that meet every condition.|criteria_range1, criteria1, [criteria_range2*], [criteria2*], ...|a count
MIN|Statistics|Smallest number.|number1, [number2*], ...|a number
MAX|Statistics|Largest number.|number1, [number2*], ...|a number
MINIFS|Statistics|Smallest value among the rows that meet every condition.|min_range, criteria_range1, criteria1, [criteria_range2*], [criteria2*], ...|a number
MAXIFS|Statistics|Largest value among the rows that meet every condition.|max_range, criteria_range1, criteria1, [criteria_range2*], [criteria2*], ...|a number
MEDIAN|Statistics|Middle value of a set of numbers.|number1, [number2*], ...|a number
MODE|Statistics|Most frequent value.|number1, [number2*], ...|a number
LARGE|Statistics|The k-th largest value.|array, k|a number
SMALL|Statistics|The k-th smallest value.|array, k|a number
RANK|Statistics|Position of a number in a list.|number, ref, [order]|a whole number
RANK.EQ|Statistics|Position of a number in a list; ties share the top rank.|number, ref, [order]|a whole number
PERCENTILE|Statistics|The value below which a percentage of the data falls.|array, k|a number
QUARTILE|Statistics|A quartile of a data set.|array, quart|a number
STDEV|Statistics|Standard deviation of a sample.|number1, [number2*], ...|a number
STDEV.S|Statistics|Standard deviation of a sample.|number1, [number2*], ...|a number
STDEV.P|Statistics|Standard deviation of a whole population.|number1, [number2*], ...|a number
VAR.S|Statistics|Variance of a sample.|number1, [number2*], ...|a number
CORREL|Statistics|Correlation coefficient of two ranges.|array1, array2|a number between -1 and 1
FORECAST|Statistics|Predicts a value on a straight-line trend.|x, known_ys, known_xs|a number
FREQUENCY|Statistics|Counts how many values fall into each bin.|data_array, bins_array|a vertical array of counts
IF|Logical|Chooses one of two results depending on a test.|logical_test, value_if_true, [value_if_false]|the value of whichever branch applies
IFS|Logical|Returns the value of the first test that is TRUE.|logical_test1, value_if_true1, [logical_test2*], [value_if_true2*], ...|the value next to the first true test
IFERROR|Logical|Returns a fallback when a calculation gives any error.|value, value_if_error|the value, or the fallback on an error
IFNA|Logical|Returns a fallback only for the #N/A error.|value, value_if_na|the value, or the fallback on #N/A
AND|Logical|TRUE when every condition is TRUE.|logical1, [logical2*], ...|TRUE or FALSE
OR|Logical|TRUE when at least one condition is TRUE.|logical1, [logical2*], ...|TRUE or FALSE
NOT|Logical|Reverses TRUE and FALSE.|logical|TRUE or FALSE
XOR|Logical|TRUE when an odd number of conditions are TRUE.|logical1, [logical2*], ...|TRUE or FALSE
SWITCH|Logical|Compares a value with a list and returns the matching result.|expression, value1, result1, [value2*], [result2*], ...|the result paired with the matching value
TRUE|Logical|The logical value TRUE.||TRUE
FALSE|Logical|The logical value FALSE.||FALSE
LET|Logical|Gives names to intermediate calculations, then uses them in a final calculation.|name1, value1, ..., calculation|the result of the final calculation
LAMBDA|Logical|Creates a reusable custom function from parameters and a calculation.|parameter, ..., calculation|a function (or its result when called right away)
MAP|Logical|Applies a LAMBDA to every value of one or more arrays.|array1, [array2], lambda|an array of the same size
REDUCE|Logical|Folds an array into one value with a LAMBDA.|initial_value, array, lambda|the accumulated value
SCAN|Logical|Like REDUCE but keeps every intermediate value.|initial_value, array, lambda|an array of running values
BYROW|Logical|Applies a LAMBDA to each row.|array, lambda|one value per row
BYCOL|Logical|Applies a LAMBDA to each column.|array, lambda|one value per column
MAKEARRAY|Logical|Builds an array from a LAMBDA of row and column numbers.|rows, columns, lambda|an array
ISBLANK|Information|Checks whether a cell is empty.|value|TRUE or FALSE
ISERROR|Information|Checks whether a value is any error.|value|TRUE or FALSE
ISNA|Information|Checks whether a value is #N/A.|value|TRUE or FALSE
ISNUMBER|Information|Checks whether a value is a number.|value|TRUE or FALSE
ISTEXT|Information|Checks whether a value is text.|value|TRUE or FALSE
ISLOGICAL|Information|Checks whether a value is TRUE or FALSE.|value|TRUE or FALSE
ISEVEN|Information|Checks whether a number is even.|number|TRUE or FALSE
ISODD|Information|Checks whether a number is odd.|number|TRUE or FALSE
NA|Information|Produces the #N/A error on purpose.||#N/A
N|Information|Converts a value to a number (text becomes 0).|value|a number
TYPE|Information|Code for the type of a value.|value|1, 2, 4, 16 or 64
CELL|Information|Information about a cell (address, format…).|info_type, [reference]|text or a number
VLOOKUP|Lookup|Finds a value in the first column of a table and returns a value from another column of that row.|lookup_value, table_array, col_index_num, [range_lookup]|the value from the chosen column, or #N/A
HLOOKUP|Lookup|Finds a value in the first row of a table and returns a value from another row.|lookup_value, table_array, row_index_num, [range_lookup]|the value from the chosen row, or #N/A
LOOKUP|Lookup|Finds a value in a sorted range and returns the matching value of another range.|lookup_value, lookup_vector, [result_vector]|a value, or #N/A
XLOOKUP|Lookup|Finds a value in one range and returns the item at the same position in another.|lookup_value, lookup_array, return_array, [if_not_found], [match_mode], [search_mode]|the matching item, or if_not_found
INDEX|Lookup|Returns the value (or reference) at a row and column of a range.|array, row_num, [column_num], [area_num]|a value or a cell reference
MATCH|Lookup|Finds the position of a value in a range.|lookup_value, lookup_array, [match_type]|a position number, or #N/A
XMATCH|Lookup|Finds the position of a value, with more match and search options.|lookup_value, lookup_array, [match_mode], [search_mode]|a position number, or #N/A
CHOOSE|Lookup|Picks a value from a list by its position.|index_num, value1, [value2*], ...|the chosen value
OFFSET|Lookup|A reference moved a number of rows and columns from a starting cell.|reference, rows, cols, [height], [width]|a cell or range reference
INDIRECT|Lookup|Turns text into a cell reference.|ref_text, [a1]|a cell or range reference
ADDRESS|Lookup|Builds a cell address as text.|row_num, column_num, [abs_num], [a1], [sheet_text]|text such as $B$3
ROW|Lookup|Row number of a reference.|[reference]|a number (or a list of numbers for a range)
ROWS|Lookup|Number of rows in a range.|array|a number
COLUMN|Lookup|Column number of a reference.|[reference]|a number
COLUMNS|Lookup|Number of columns in a range.|array|a number
TRANSPOSE|Lookup|Turns rows into columns and columns into rows.|array|an array
HYPERLINK|Lookup|Creates a clickable link.|link_location, [friendly_name]|a link showing the friendly name
FILTER|Dynamic arrays|Keeps the rows (or columns) of a range where a condition is TRUE.|array, include, [if_empty]|the matching rows, as a spilled array
SORT|Dynamic arrays|Sorts a range.|array, [sort_index], [sort_order], [by_col]|the sorted array
SORTBY|Dynamic arrays|Sorts a range by the values of other ranges.|array, by_array1, [sort_order1], [by_array2*], [sort_order2*], ...|the sorted array
UNIQUE|Dynamic arrays|Removes duplicate rows.|array, [by_col], [exactly_once]|the distinct values, as a spilled array
SEQUENCE|Dynamic arrays|A list of sequential numbers.|rows, [columns], [start], [step]|an array of numbers
VSTACK|Dynamic arrays|Stacks arrays on top of each other.|array1, [array2*], ...|one taller array
HSTACK|Dynamic arrays|Puts arrays side by side.|array1, [array2*], ...|one wider array
TOCOL|Dynamic arrays|Turns an array into one column.|array, [ignore], [scan_by_column]|a single column
TAKE|Dynamic arrays|Keeps the first or last rows or columns.|array, rows, [columns]|part of the array
DROP|Dynamic arrays|Removes the first or last rows or columns.|array, rows, [columns]|the rest of the array
CHOOSECOLS|Dynamic arrays|Keeps chosen columns of an array.|array, col_num1, [col_num2*], ...|the chosen columns
CHOOSEROWS|Dynamic arrays|Keeps chosen rows of an array.|array, row_num1, [row_num2*], ...|the chosen rows
TEXTSPLIT|Dynamic arrays|Splits text into columns and rows at delimiters.|text, col_delimiter, [row_delimiter], [ignore_empty], [match_mode], [pad_with]|an array of text pieces
CONCATENATE|Text|Joins pieces of text.|text1, [text2*], ...|one text
CONCAT|Text|Joins text from values and ranges.|text1, [text2*], ...|one text
TEXTJOIN|Text|Joins text with a delimiter, optionally skipping empty cells.|delimiter, ignore_empty, text1, [text2*], ...|one text
LEFT|Text|First characters of a text.|text, [num_chars]|text
RIGHT|Text|Last characters of a text.|text, [num_chars]|text
MID|Text|Characters from the middle of a text.|text, start_num, num_chars|text
LEN|Text|Number of characters.|text|a number
FIND|Text|Position of one text inside another (case-sensitive).|find_text, within_text, [start_num]|a position number, or #VALUE!
SEARCH|Text|Position of one text inside another (not case-sensitive, wildcards allowed).|find_text, within_text, [start_num]|a position number, or #VALUE!
SUBSTITUTE|Text|Replaces occurrences of a text with another.|text, old_text, new_text, [instance_num]|the changed text
REPLACE|Text|Replaces characters at a position.|old_text, start_num, num_chars, new_text|the changed text
UPPER|Text|Converts to capital letters.|text|text
LOWER|Text|Converts to small letters.|text|text
PROPER|Text|Capitalises the first letter of each word.|text|text
TRIM|Text|Removes extra spaces.|text|text
CLEAN|Text|Removes non-printing characters.|text|text
TEXT|Text|Formats a number or date as text with a format code.|value, format_text|text
VALUE|Text|Converts text that looks like a number into a number.|text|a number, or #VALUE!
REPT|Text|Repeats a text a number of times.|text, number_times|text
EXACT|Text|Checks whether two texts are identical, case included.|text1, text2|TRUE or FALSE
CHAR|Text|The character for a code number.|number|one character
TEXTBEFORE|Text|Text before a delimiter.|text, delimiter, [instance_num], [match_mode], [match_end], [if_not_found]|text
TEXTAFTER|Text|Text after a delimiter.|text, delimiter, [instance_num], [match_mode], [match_end], [if_not_found]|text
REGEXMATCH|Text|Checks whether text matches a regular expression (Google Sheets).|text, regular_expression|TRUE or FALSE
REGEXEXTRACT|Text|Extracts the part of a text that matches a regular expression.|text, regular_expression|text
REGEXREPLACE|Text|Replaces the parts that match a regular expression.|text, regular_expression, replacement|text
SPLIT|Text|Splits text at a delimiter (Google Sheets).|text, delimiter, [split_by_each], [remove_empty_text]|an array of text pieces
JOIN|Text|Joins values with a delimiter (Google Sheets).|delimiter, value_or_array1, [value_or_array2*], ...|one text
TODAY|Date and time|Today's date, updated on every recalculation.||a date
NOW|Date and time|The current date and time.||a date and time
DATE|Date and time|Builds a date from year, month and day.|year, month, day|a date (a serial number)
TIME|Date and time|Builds a time from hours, minutes and seconds.|hour, minute, second|a time (a fraction of a day)
DATEVALUE|Date and time|Converts a date written as text into a date.|date_text|a date, or #VALUE!
YEAR|Date and time|Year of a date.|serial_number|a number such as 2026
MONTH|Date and time|Month of a date, 1 to 12.|serial_number|a number
DAY|Date and time|Day of the month, 1 to 31.|serial_number|a number
HOUR|Date and time|Hour of a time, 0 to 23.|serial_number|a number
MINUTE|Date and time|Minute of a time, 0 to 59.|serial_number|a number
WEEKDAY|Date and time|Day of the week as a number.|serial_number, [return_type]|a number
WEEKNUM|Date and time|Week number in the year.|serial_number, [return_type]|a number
EDATE|Date and time|The date a number of months before or after a date.|start_date, months|a date
EOMONTH|Date and time|Last day of the month a number of months away.|start_date, months|a date
NETWORKDAYS|Date and time|Working days between two dates.|start_date, end_date, [holidays]|a number
WORKDAY|Date and time|The date a number of working days away.|start_date, days, [holidays]|a date
DATEDIF|Date and time|Difference between two dates in days, months or years.|start_date, end_date, unit|a number
DAYS|Date and time|Number of days between two dates.|end_date, start_date|a number
YEARFRAC|Date and time|Fraction of a year between two dates.|start_date, end_date, [basis]|a decimal number
PMT|Financial|Payment per period of a loan.|rate, nper, pv, [fv], [type]|a number (negative = money paid)
FV|Financial|Future value of an investment.|rate, nper, pmt, [pv], [type]|a number
PV|Financial|Present value of an investment.|rate, nper, pmt, [fv], [type]|a number
NPV|Financial|Net present value of future cash flows.|rate, value1, [value2*], ...|a number
IRR|Financial|Internal rate of return of cash flows.|values, [guess]|a rate
RATE|Financial|Interest rate per period.|nper, pmt, pv, [fv], [type], [guess]|a rate
ARRAYFORMULA|Google Sheets|Lets a formula work on whole ranges and spill the results (Google Sheets).|array_formula|an array
QUERY|Google Sheets|Runs a SQL-like query on a range (Google Sheets).|data, query, [headers]|a table
IMPORTRANGE|Google Sheets|Reads a range from another spreadsheet (Google Sheets).|spreadsheet_url, range_string|a range of values
GOOGLEFINANCE|Google Sheets|Market data from Google Finance (Google Sheets).|ticker, [attribute], [start_date], [end_date_or_num_days], [interval]|a number or a table
SPARKLINE|Google Sheets|Draws a small chart inside a cell (Google Sheets).|data, [options]|a chart in the cell
`;

const INFO = new Map<string, FunctionInfo>();
for (const line of RAW.split("\n")) {
  if (!line.trim()) continue;
  const [name, category, purpose, argText, returns] = line.split("|");
  const parts = argText ? argText.split(/,\s*/) : [];
  const repeating = parts.includes("...");
  const args = parts.filter((p) => p !== "...").map((p) => p.replace(/\*/g, ""));
  const repeat = repeating ? Math.max(1, parts.filter((p) => p.includes("*")).length) : 0;
  INFO.set(name, { name, category, purpose, args, repeat, returns });
}

export const FUNCTION_COUNT = INFO.size;

export function functionInfo(name: string): FunctionInfo | undefined {
  return INFO.get(name.toUpperCase());
}

/** The documented name of argument `index` (0-based) of a call with `count` arguments. */
export function argumentName(fn: string, index: number, count: number): string | null {
  const upper = fn.toUpperCase();
  if (upper === "LET") return index === count - 1 ? "calculation" : index % 2 === 0 ? "name" : "value";
  if (upper === "LAMBDA") return index === count - 1 ? "calculation" : "parameter";
  const info = INFO.get(upper);
  if (!info) return null;
  const strip = (s: string) => s.replace(/^\[|\]$/g, "");
  if (index < info.args.length) return strip(info.args[index]);
  if (!info.repeat) return null;
  // Repeating groups: criteria_range2, criteria2 → criteria_range3, criteria3 …
  const first = info.args.length - info.repeat;
  const offset = index - first;
  const base = strip(info.args[first + (offset % info.repeat)]);
  const startNumber = Number(/(\d+)$/.exec(base)?.[1] ?? 2);
  const n = startNumber + Math.floor(offset / info.repeat);
  return /\d+$/.test(base) ? base.replace(/\d+$/, String(n)) : base;
}
