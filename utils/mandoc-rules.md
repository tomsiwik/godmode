| BASE    | MANDOCERR_MDOCDATE          | Mdocdate found: Dd ... |
| BASE    | MANDOCERR_MDOCDATE_MISSING  | Mdocdate missing: Dd ... |
| BASE    | MANDOCERR_ARCH_BAD          | unknown architecture: Dt ... arch |
| BASE    | MANDOCERR_OS_ARG            | operating system explicitly specified: Os ... |
| BASE    | MANDOCERR_RCS_MISSING       | RCS id missing |
| STYLE   | MANDOCERR_DATE_LEGACY       | legacy man(7) date format: Dd ... |
| STYLE   | MANDOCERR_DATE_NORM         | normalizing date format to: ... |
| STYLE   | MANDOCERR_TITLE_CASE        | lower case character in document title |
| STYLE   | MANDOCERR_RCS_REP           | duplicate RCS id: ... |
| STYLE   | MANDOCERR_SEC_TYPO          | possible typo in section name: Sh ... |
| STYLE   | MANDOCERR_ARG_QUOTE         | unterminated quoted argument |
| STYLE   | MANDOCERR_MACRO_USELESS     | useless macro: macro |
| STYLE   | MANDOCERR_BX                | consider using OS macro: macro |
| STYLE   | MANDOCERR_ER_ORDER          | errnos out of order: Er ... |
| STYLE   | MANDOCERR_ER_REP            | duplicate errno: Er ... |
| STYLE   | MANDOCERR_XR_BAD            | referenced manual not found: Xr name sec |
| STYLE   | MANDOCERR_DELIM             | trailing delimiter: macro ... |
| STYLE   | MANDOCERR_DELIM_NB          | no blank before trailing delimiter: macro ... |
| STYLE   | MANDOCERR_FI_SKIP           | fill mode already enabled, skipping: fi |
| STYLE   | MANDOCERR_NF_SKIP           | fill mode already disabled, skipping: nf |
| STYLE   | MANDOCERR_TEXT_LONG         | input text line longer than 80 bytes |
| STYLE   | MANDOCERR_DASHDASH          | verbatim "--", maybe consider using \(em |
| STYLE   | MANDOCERR_FUNC              | function name without markup: name() |
| STYLE   | MANDOCERR_SPACE_EOL         | whitespace at end of input line |
| STYLE   | MANDOCERR_COMMENT_BAD       | bad comment style |
| WARNING | MANDOCERR_DT_NOTITLE        | missing manual title, using UNTITLED: line |
| WARNING | MANDOCERR_TH_NOTITLE        | missing manual title, using "": [macro] |
| WARNING | MANDOCERR_MSEC_MISSING      | missing manual section, using "": macro |
| WARNING | MANDOCERR_MSEC_BAD          | unknown manual section: Dt ... section |
| WARNING | MANDOCERR_MSEC_FILE         | filename/section mismatch: ... |
| WARNING | MANDOCERR_DATE_MISSING      | missing date, using "": [macro] |
| WARNING | MANDOCERR_DATE_BAD          | cannot parse date, using it verbatim: date |
| WARNING | MANDOCERR_DATE_FUTURE       | date in the future, using it anyway: date |
| WARNING | MANDOCERR_OS_MISSING        | missing Os macro, using "" |
| WARNING | MANDOCERR_PROLOG_LATE       | late prologue macro: macro |
| WARNING | MANDOCERR_PROLOG_ORDER      | prologue macros out of order: macros |
| WARNING | MANDOCERR_SO                | .so is fragile, better use ln(1): so path |
| WARNING | MANDOCERR_DOC_EMPTY         | no document body |
| WARNING | MANDOCERR_SEC_BEFORE        | content before first section header: macro |
| WARNING | MANDOCERR_NAMESEC_FIRST     | first section is not NAME: Sh title |
| WARNING | MANDOCERR_NAMESEC_NONM      | NAME section without Nm before Nd |
| WARNING | MANDOCERR_NAMESEC_NOND      | NAME section without description |
| WARNING | MANDOCERR_NAMESEC_ND        | description not at the end of NAME |
| WARNING | MANDOCERR_NAMESEC_BAD       | bad NAME section content: macro |
| WARNING | MANDOCERR_NAMESEC_PUNCT     | missing comma before name: Nm name |
| WARNING | MANDOCERR_ND_EMPTY          | missing description line, using "" |
| WARNING | MANDOCERR_ND_LATE           | description line outside NAME section |
| WARNING | MANDOCERR_SEC_ORDER         | sections out of conventional order: Sh title |
| WARNING | MANDOCERR_SEC_REP           | duplicate section title: Sh title |
| WARNING | MANDOCERR_SEC_MSEC          | unexpected section: Sh title for ... only |
| WARNING | MANDOCERR_XR_SELF           | cross reference to self: Xr name sec |
| WARNING | MANDOCERR_XR_ORDER          | unusual Xr order: ... after ... |
| WARNING | MANDOCERR_XR_PUNCT          | unusual Xr punctuation: ... after ... |
| WARNING | MANDOCERR_AN_MISSING        | AUTHORS section without An macro |
| WARNING | MANDOCERR_MACRO_OBS         | obsolete macro: macro |
| WARNING | MANDOCERR_MACRO_CALL        | macro neither callable nor escaped: macro |
| WARNING | MANDOCERR_PAR_SKIP          | skipping paragraph macro: macro ... |
| WARNING | MANDOCERR_PAR_MOVE          | moving paragraph macro out of list: macro |
| WARNING | MANDOCERR_NS_SKIP           | skipping no-space macro |
| WARNING | MANDOCERR_BLK_NEST          | blocks badly nested: macro ... |
| WARNING | MANDOCERR_BD_NEST           | nested displays are not portable: macro ... |
| WARNING | MANDOCERR_BL_MOVE           | moving content out of list: macro |
| WARNING | MANDOCERR_TA_LINE           | first macro on line: Ta |
| WARNING | MANDOCERR_BLK_LINE          | line scope broken: macro breaks macro |
| WARNING | MANDOCERR_BLK_BLANK         | skipping blank line in line scope |
| WARNING | MANDOCERR_REQ_EMPTY         | skipping empty request: request |
| WARNING | MANDOCERR_COND_EMPTY        | conditional request controls empty scope |
| WARNING | MANDOCERR_MACRO_EMPTY       | skipping empty macro: macro |
| WARNING | MANDOCERR_BLK_EMPTY         | empty block: macro |
| WARNING | MANDOCERR_ARG_EMPTY         | empty argument, using 0n: macro arg |
| WARNING | MANDOCERR_BD_NOTYPE         | missing display type, using -ragged: Bd |
| WARNING | MANDOCERR_BL_LATETYPE       | list type is not the first argument: Bl arg |
| WARNING | MANDOCERR_BL_NOWIDTH        | missing -width in -tag list, using 6n |
| WARNING | MANDOCERR_EX_NONAME         | missing utility name, using "": Ex |
| WARNING | MANDOCERR_FO_NOHEAD         | missing function name, using "": Fo |
| WARNING | MANDOCERR_IT_NOHEAD         | empty head in list item: Bl -type It |
| WARNING | MANDOCERR_IT_NOBODY         | empty list item: Bl -type It |
| WARNING | MANDOCERR_IT_NOARG          | missing argument, using next line: Bl -c It |
| WARNING | MANDOCERR_BF_NOFONT         | missing font type, using \fR: Bf |
| WARNING | MANDOCERR_BF_BADFONT        | unknown font type, using \fR: Bf font |
| WARNING | MANDOCERR_PF_SKIP           | nothing follows prefix: Pf arg |
| WARNING | MANDOCERR_RS_EMPTY          | empty reference block: Rs |
| WARNING | MANDOCERR_XR_NOSEC          | missing section argument: Xr arg |
| WARNING | MANDOCERR_ARG_STD           | missing -std argument, adding it: macro |
| WARNING | MANDOCERR_OP_EMPTY          | missing option string, using "": OP |
| WARNING | MANDOCERR_UR_NOHEAD         | missing resource identifier, using "": UR |
| WARNING | MANDOCERR_EQN_NOBOX         | missing eqn box, using "": op |
| WARNING | MANDOCERR_ARG_REP           | duplicate argument: macro arg |
| WARNING | MANDOCERR_AN_REP            | skipping duplicate argument: An -arg |
| WARNING | MANDOCERR_BD_REP            | skipping duplicate display type: Bd -type |
| WARNING | MANDOCERR_BL_REP            | skipping duplicate list type: Bl -type |
| WARNING | MANDOCERR_BL_SKIPW          | skipping -width argument: Bl -type |
| WARNING | MANDOCERR_BL_COL            | wrong number of cells |
| WARNING | MANDOCERR_AT_BAD            | unknown AT&T UNIX version: At version |
| WARNING | MANDOCERR_FA_COMMA          | comma in function argument: arg |
| WARNING | MANDOCERR_FN_PAREN          | parenthesis in function name: arg |
| WARNING | MANDOCERR_LB_BAD            | unknown library name: Lb ... |
| WARNING | MANDOCERR_RS_BAD            | invalid content in Rs block: macro |
| WARNING | MANDOCERR_SM_BAD            | invalid Boolean argument: macro arg |
| WARNING | MANDOCERR_CHAR_FONT         | argument contains two font escapes |
| WARNING | MANDOCERR_FT_BAD            | unknown font, skipping request: ft font |
| WARNING | MANDOCERR_MC_DIST           | ignoring distance argument: mc ... arg |
| WARNING | MANDOCERR_TR_ODD            | odd number of characters in request: tr char |
| WARNING | MANDOCERR_FI_BLANK          | blank line in fill mode, using .sp |
| WARNING | MANDOCERR_FI_TAB            | tab in filled text |
| WARNING | MANDOCERR_EOS               | new sentence, new line |
| WARNING | MANDOCERR_ESC_ARG           | invalid escape sequence argument: esc |
| WARNING | MANDOCERR_ESC_UNDEF         | undefined escape, printing literally: char |
| WARNING | MANDOCERR_STR_UNDEF         | undefined string, using "": name |
| WARNING | MANDOCERR_TBLLAYOUT_SPAN    | tbl line starts with span |
| WARNING | MANDOCERR_TBLLAYOUT_DOWN    | tbl column starts with span |
| WARNING | MANDOCERR_TBLLAYOUT_VERT    | skipping vertical bar in tbl layout |
| ERROR   | MANDOCERR_TBLOPT_ALPHA      | non-alphabetic character in tbl options |
| ERROR   | MANDOCERR_TBLOPT_BAD        | skipping unknown tbl option: option |
| ERROR   | MANDOCERR_TBLOPT_NOARG      | missing tbl option argument: option |
| ERROR   | MANDOCERR_TBLOPT_ARGSZ      | wrong tbl option argument size: option |
| ERROR   | MANDOCERR_TBLLAYOUT_NONE    | empty tbl layout |
| ERROR   | MANDOCERR_TBLLAYOUT_CHAR    | invalid character in tbl layout: char |
| ERROR   | MANDOCERR_TBLLAYOUT_PAR     | unmatched parenthesis in tbl layout |
| ERROR   | MANDOCERR_TBLLAYOUT_WIDTH   | invalid column width in tbl layout |
| ERROR   | MANDOCERR_TBLLAYOUT_SPC     | ignoring excessive spacing in tbl layout |
| ERROR   | MANDOCERR_TBLDATA_NONE      | tbl without any data cells |
| ERROR   | MANDOCERR_TBLDATA_SPAN      | ignoring data in spanned tbl cell: data |
| ERROR   | MANDOCERR_TBLDATA_EXTRA     | ignoring extra tbl data cells: data |
| ERROR   | MANDOCERR_TBLDATA_BLK       | data block open at end of tbl: macro |
| ERROR   | MANDOCERR_PROLOG_REP        | duplicate prologue macro: macro |
| ERROR   | MANDOCERR_DT_LATE           | skipping late title macro: Dt args |
| ERROR   | MANDOCERR_ROFFLOOP          | input stack limit exceeded, infinite loop? |
| ERROR   | MANDOCERR_CHAR_BAD          | skipping bad character: number |
| ERROR   | MANDOCERR_MACRO             | skipping unknown macro: macro |
| ERROR   | MANDOCERR_REQ_NOMAC         | skipping request outside macro: ... |
| ERROR   | MANDOCERR_REQ_INSEC         | skipping insecure request: request |
| ERROR   | MANDOCERR_IT_STRAY          | skipping item outside list: It ... |
| ERROR   | MANDOCERR_TA_STRAY          | skipping column outside column list: Ta |
| ERROR   | MANDOCERR_BLK_NOTOPEN       | skipping end of block that is not open |
| ERROR   | MANDOCERR_RE_NOTOPEN        | fewer RS blocks open, skipping: RE arg |
| ERROR   | MANDOCERR_BLK_BROKEN        | inserting missing end of block: macro ... |
| ERROR   | MANDOCERR_BLK_NOEND         | appending missing end of block: macro |
| ERROR   | MANDOCERR_NAMESC            | escaped character not allowed in a name: name |
| ERROR   | MANDOCERR_ARG_UNDEF         | using macro argument outside macro |
| ERROR   | MANDOCERR_ARG_NONUM         | argument number is not numeric |
| ERROR   | MANDOCERR_ARG_NEG           | negative argument, using 0: request arg |
| ERROR   | MANDOCERR_BD_FILE           | NOT IMPLEMENTED: Bd -file |
| ERROR   | MANDOCERR_BD_NOARG          | skipping display without arguments: Bd |
| ERROR   | MANDOCERR_BL_NOTYPE         | missing list type, using -item: Bl |
| ERROR   | MANDOCERR_CE_NONUM          | argument is not numeric, using 1: ce ... |
| ERROR   | MANDOCERR_CHAR_ARG          | argument is not a character: char ... |
| ERROR   | MANDOCERR_MC_ESC            | skipping unusable escape sequence: mc arg |
| ERROR   | MANDOCERR_NM_NONAME         | missing manual name, using "": Nm |
| ERROR   | MANDOCERR_OS_UNAME          | uname(3) system call failed, using UNKNOWN |
| ERROR   | MANDOCERR_ST_BAD            | unknown standard specifier: St standard |
| ERROR   | MANDOCERR_IT_NONUM          | skipping request without numeric argument |
| ERROR   | MANDOCERR_SHIFT             | excessive shift: ..., but max is ... |
| ERROR   | MANDOCERR_SO_PATH           | NOT IMPLEMENTED: .so with absolute path or ".." |
| ERROR   | MANDOCERR_SO_FAIL           | .so request failed |
| ERROR   | MANDOCERR_TG_SPC            | skipping tag containing whitespace: tag |
| ERROR   | MANDOCERR_ARG_SKIP          | skipping all arguments: macro args |
| ERROR   | MANDOCERR_ARG_EXCESS        | skipping excess arguments: macro ... args |
| ERROR   | MANDOCERR_DIVZERO           | divide by zero |
| ERROR   | MANDOCERR_ESC_INCOMPLETE    | incomplete escape sequence: esc |
| ERROR   | MANDOCERR_ESC_BADCHAR       | invalid special character: esc |
| ERROR   | MANDOCERR_ESC_UNKCHAR       | unknown special character: esc |
| ERROR   | MANDOCERR_ESC_DELIM         | invalid escape argument delimiter: esc |
| UNSUPP  | MANDOCERR_TOOLARGE          | input too large |
| UNSUPP  | MANDOCERR_CHAR_UNSUPP       | unsupported control character: number |
| UNSUPP  | MANDOCERR_ESC_UNSUPP        | unsupported escape sequence: escape |
| UNSUPP  | MANDOCERR_REQ_UNSUPP        | unsupported roff request: request |
| UNSUPP  | MANDOCERR_WHILE_NEST        | nested .while loops |
| UNSUPP  | MANDOCERR_WHILE_OUTOF       | end of scope with open .while loop |
| UNSUPP  | MANDOCERR_WHILE_INTO        | end of .while loop in inner scope |
| UNSUPP  | MANDOCERR_WHILE_FAIL        | cannot continue this .while loop |
| UNSUPP  | MANDOCERR_TBLOPT_EQN        | eqn delim option in tbl: arg |
| UNSUPP  | MANDOCERR_TBLLAYOUT_MOD     | unsupported tbl layout modifier: m |
| UNSUPP  | MANDOCERR_TBLMACRO          | ignoring macro in table: macro |
| UNSUPP  | MANDOCERR_TBL_TMAN          | skipping tbl in -Tman mode |
| UNSUPP  | MANDOCERR_EQN_TMAN          | skipping eqn in -Tman mode |
| BADARG  | MANDOCERR_BADARG_BAD        | bad argument |
| BADARG  | MANDOCERR_BADARG_DUPE       | duplicate argument |
| BADARG  | MANDOCERR_BADVAL            | does not take a value |
| BADARG  | MANDOCERR_BADVAL_MISS       | missing argument value |
| BADARG  | MANDOCERR_BADVAL_BAD        | bad argument value |
| BADARG  | MANDOCERR_BADVAL_DUPE       | duplicate argument value |
| BADARG  | MANDOCERR_TAG               | no such tag |
| BADARG  | MANDOCERR_MAN_TMARKDOWN     | -Tmarkdown unsupported for man(7) input |
