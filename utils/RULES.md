# GNU help/man compliance rule catalog

Extracted directly from the sources cloned in `utils/`:
- `mandoc/mandoc.h` → 184 `MANDOCERR_*` rules
- `help2man/help2man.PL` → recognition patterns + section grammar
- `groff/src/roff/troff/input.cpp` → 20 warning categories

This is the complete rule surface enforced by the `help2man → mandoc -Tlint → groff -ww` pipeline we run in `.gmverify/verify.sh`.

---

## 1. mandoc MANDOCERR rules (184 total)

Severity bands in increasing strictness. `mandoc -W<band>` reports band and above.

| Band    | Count | Meaning                                                     |
|---------|------:|-------------------------------------------------------------|
| BASE    |     5 | Base system conventions (OpenBSD/NetBSD defaults)           |
| STYLE   |    20 | Style suggestions (cosmetic, portability hints)             |
| WARNING |    87 | Semantic issues (missing metadata, malformed sections)      |
| ERROR   |    51 | Real parse errors (recoverable, output continues)           |
| UNSUPP  |    13 | Features mandoc can't render                                |
| BADARG  |     8 | Invalid CLI args to mandoc itself                           |

**CI strictness picks:**
- `-Tlint` alone → reports everything, exits 2 on any WARNING+
- `-Tlint -Wall` → same band as default
- `-Tlint -Wwarning,stop` → exits on first WARNING
- `-Tlint -Werror` → treats WARNING as error (strictest useful level)

### Rules likely to fire on `--help → help2man → man` output

These are the rules godmode's renderer must satisfy. Grouped by what you control.

#### Metadata (our `.TH` line must supply all)

| Rule                      | Trigger                                          |
|---------------------------|--------------------------------------------------|
| `MANDOCERR_TH_NOTITLE`    | empty title field in `.TH` — need `<NAME> <N>`   |
| `MANDOCERR_MSEC_MISSING`  | missing section number                           |
| `MANDOCERR_MSEC_BAD`      | unknown section (must be 1–9, L, N)              |
| `MANDOCERR_DATE_MISSING`  | missing date                                     |
| `MANDOCERR_DATE_BAD`      | date format unparseable (e.g., "April 2026")     |
| `MANDOCERR_DATE_FUTURE`   | date is in the future                            |
| `MANDOCERR_OS_MISSING`    | missing operating system / source field          |

#### Section structure

| Rule                       | Trigger                                              |
|----------------------------|------------------------------------------------------|
| `MANDOCERR_NAMESEC_FIRST`  | first section isn't `NAME`                           |
| `MANDOCERR_NAMESEC_NOND`   | `NAME` section without `name - description`          |
| `MANDOCERR_NAMESEC_ND`     | description not at end of `NAME`                     |
| `MANDOCERR_NAMESEC_BAD`    | invalid macro in `NAME`                              |
| `MANDOCERR_ND_EMPTY`       | description line empty                               |
| `MANDOCERR_SEC_BEFORE`     | content before first section header                  |
| `MANDOCERR_SEC_ORDER`      | sections out of conventional order                   |
| `MANDOCERR_SEC_REP`        | duplicate section title                              |
| `MANDOCERR_SEC_TYPO`       | typo in section name (e.g., `SYNOPIS`)               |
| `MANDOCERR_DOC_EMPTY`      | no document body                                     |

**Conventional section order** (mandoc enforces via `SEC_ORDER`):
```
NAME → LIBRARY → SYNOPSIS → DESCRIPTION → CONTEXT → IMPLEMENTATION NOTES →
RETURN VALUES → ENVIRONMENT → FILES → EXIT STATUS → EXAMPLES →
DIAGNOSTICS → ERRORS → SEE ALSO → STANDARDS → HISTORY → AUTHORS →
CAVEATS → BUGS → SECURITY CONSIDERATIONS
```

#### Text-level style

| Rule                       | Trigger                                    |
|----------------------------|--------------------------------------------|
| `MANDOCERR_TEXT_LONG`      | line > 80 bytes                            |
| `MANDOCERR_DASHDASH`       | verbatim `--` (use `\(em` em-dash)         |
| `MANDOCERR_FUNC`           | `name()` without `Fn`/`Xr` markup          |
| `MANDOCERR_SPACE_EOL`      | trailing whitespace                        |
| `MANDOCERR_COMMENT_BAD`    | non-`\"`  comment                          |
| `MANDOCERR_TITLE_CASE`     | lowercase in document title                |
| `MANDOCERR_EOS`            | new sentence not on new line               |

#### Portability

| Rule                       | Trigger                                    |
|----------------------------|--------------------------------------------|
| `MANDOCERR_BD_NEST`        | nested displays (`.Bd`/`.D1`/`.Dl`)        |
| `MANDOCERR_ESC_UNDEF`      | undefined escape sequence                  |
| `MANDOCERR_CHAR_BAD`       | non-ASCII control character                |
| `MANDOCERR_BLK_NEST`       | badly nested block macros                  |
| `MANDOCERR_MACRO_OBS`      | deprecated macro                           |
| `MANDOCERR_MACRO_CALL`     | macro called in non-callable context       |

**Full table** (all 184 rules) is in [`utils/mandoc-rules.txt`](./mandoc-rules.txt) — one row per rule with severity band and one-line description. Canonical file in upstream: [`mandoc/mandoc.h` lines 50–280](./mandoc/mandoc.h).

---

## 2. help2man format requirements

Extracted from `help2man/help2man.PL` lines 400–620. These are the regex-driven patterns help2man looks for in your `--help` output. If a pattern doesn't match, the corresponding man section is missing or malformed.

### Top-level requirements

| Requirement              | Pattern / Detail                                       |
|--------------------------|--------------------------------------------------------|
| `--help` must succeed    | Non-zero exit fails the pipeline                       |
| `--version` must succeed | Non-zero exit fails; first word = program name         |
| Version line format      | `<program> <version>` on first line                    |
| NAME auto-extraction     | `^([^\s,]+)(?:,?\s*[^\s,\\-]+)*\s+\\?-` — name + dash  |

### Recognized section headings (localized)

| English heading   | Variable           | Effect                         |
|-------------------|--------------------|--------------------------------|
| `Usage:`          | `$PAT_USAGE`       | Becomes `SYNOPSIS`             |
| `  or:`           | `$PAT_USAGE_CONT`  | Alternate usage line           |
| `Options:`        | `$PAT_OPTIONS`     | Becomes `OPTIONS`              |
| `Environment:`    | `$PAT_ENVIRONMENT` | Becomes `ENVIRONMENT`          |
| `Files:`          | `$PAT_FILES`       | Becomes `FILES`                |
| `Examples:`       | `$PAT_EXAMPLES`    | Becomes `EXAMPLES`             |
| `Copyright`       | inline regex       | Becomes `COPYRIGHT`            |
| `Report bugs`     | `$PAT_BUGS`        | Becomes `REPORTING BUGS`       |
| `Written by`      | `$PAT_AUTHOR`      | Becomes `AUTHOR`               |
| `*Words*`         | inline             | New section                    |
| `Words:` (line)   | inline             | New sub-section (`.SS`)        |

### Option-line grammar (OPTIONS section)

help2man looks for three patterns in order:

1. **Option with description, aligned on same line:**
   ```
   ^( {1,10}([+-]\S.*?))(?:(  +(?!-))|\n( {20,}))(\S.*)\n
   ```
   Two or more spaces between flag and description. Descriptions must align in a consistent column.

2. **Option without description:**
   ```
   ^ {1,10}([+-]\S.*)\n
   ```

3. **Indented paragraph with tag:**
   ```
   ^( +(\S.*?)  +)(\S.*)\n
   ```

### Derived requirements for GNU-compliant `--help`

To pass help2man cleanly, your output must:

1. Start with a description paragraph (used for `NAME`) OR `Usage:` line.
2. Use `Usage: <prog>` (or localised equivalent) followed by `  or: <prog>` for alternates.
3. Indent options to column 2, with ≥2 spaces between the flag and description.
4. Descriptions continued on subsequent lines must start at the same column.
5. Include `Report bugs to <addr>.` line near the end.
6. Include a `Copyright` line.

Canonical file: [`help2man/help2man.PL`](./help2man/help2man.PL).

---

## 3. groff warning categories (`-w<name>`)

20 categories from `groff/src/roff/troff/input.cpp:10660` and `troff.h`. Enable selectively or use `-ww` (everything) / `-Wall` / `-Wstyle`.

| Name      | What it catches                                        |
|-----------|--------------------------------------------------------|
| `char`    | Invalid character escapes                              |
| `range`   | Arguments out of numeric range                         |
| `break`   | Bad line breaks                                        |
| `delim`   | Missing closing delimiters                             |
| `style`   | Stylistic issues (enabled by `-ww`, not `-Wall`)       |
| `scale`   | Bad scaling indicators                                 |
| `syntax`  | Generic syntax errors                                  |
| `tab`     | Misused tab stops                                      |
| `missing` | Missing arguments                                      |
| `input`   | Weird input-encoding issues                            |
| `escape`  | Bad escape sequences                                   |
| `space`   | Improper spacing                                       |
| `font`    | Unknown or bad font requests                           |
| `di`      | `.di` (diversion) misuse (verbose; excluded from -Wall)|
| `mac`     | Macro misuse (verbose; excluded from -Wall)            |
| `reg`     | Register misuse (verbose; excluded from -Wall)         |
| `ig`      | `.ig` (ignore) issues                                  |
| `color`   | Color request issues                                   |
| `file`    | File-related issues                                    |
| `w`       | All warnings (= `-ww`)                                 |

For our pipeline `groff -man -ww -z`:
- `-man` = use man(7) macros
- `-ww` = all warnings on
- `-z` = parse only, no output

Canonical file: [`groff/src/roff/troff/input.cpp`](./groff/src/roff/troff/input.cpp) lines 10655–10685.

---

## 4. What this means for godmode

Out of 184 mandoc rules + 20 groff warnings + help2man's format grammar, the rules godmode's `--help` output needs to satisfy reduce to ~25:

### Must-have for `MANDOCERR_*` clean
1. First line = `<name> - <description>` (NAME extraction)
2. `Usage:` line follows, continuation with `  or:`
3. `Options:` heading, options indented 2 columns, descriptions ≥2 spaces after flag, aligned
4. `Report bugs to …` line
5. `Copyright …` line
6. No lines > 80 bytes
7. ASCII-only text (or escape non-ASCII properly)
8. No trailing whitespace
9. No verbatim `--` inside descriptions (use em-dash escape)
10. Sections in conventional order

### Must-have at help2man invocation time
1. `--version` must respond with `<name> <version>` format
2. Either set date via `sed` post-process or accept `MANDOCERR_DATE_BAD` warning
3. Pass `--no-info` to suppress the Texinfo pointer
4. Pass `--name=STRING` if the first line doesn't match the NAME extraction regex

### What we're getting right already

`godmode --help` and all 10 sub-helps pass `help2man → mandoc -Tlint -Werror → groff -man -ww -z` per `.gmverify/verify.sh`.

### What's merely lint-clean but not canonical

Sub-help pages (`godmode extension --help`, `godmode agent --help`, `godmode api <ext> --help`) currently render "Usage:" as an `.SS` sub-section rather than promoting it to `SYNOPSIS`, because they lead with a description paragraph. Fix = reorder so `Usage:` is the first section.

### Out of scope for our pipeline

~120 of mandoc's rules are for mdoc/tbl/eqn/Bd/Bl macros we never emit. BADARG is about mandoc CLI usage. SYSERR is OS-level failures. Those can't fire from our generated output.

---

## Source references in this folder

| Repo       | URL                                                      | Lines of note                      |
|------------|----------------------------------------------------------|------------------------------------|
| `mandoc`   | https://github.com/salewski/mandoc-mirror                | `mandoc.h:50–280` (the enum)       |
| `help2man` | https://github.com/Distrotech/help2man                   | `help2man.PL:400–620` (parser)     |
| `groff`    | https://git.savannah.gnu.org/git/groff.git               | `troff.h`, `input.cpp:10655–10685` |
