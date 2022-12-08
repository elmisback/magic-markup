# Goals
* `codetations` is designed for **source code** annotation.
* Initial work is focused on **range annotations representing *expressions*** (or partially-complete expressions).
* When convenient, plugin hooks will be offered for handling other cases.
* Provide a **robust** solution: a barebones fallback method (text diffing + string similarity) as well as online updates and language-aware (loose) parsing-based methods.
* Annotations should avoid interfering with reading in a text-based editor or running code.
* Annotations should be editor-agnostic and should not break (too much) if someone who doesn't care about them works with the code.
* A perfect solution for the offline case is not possible, but we can use heuristics to handle the most important kinds of changes.

## What should be stored for an annotation
* The last version of the file being annotated that codetations knows about.
* Two (row, column) pairs indicating where the annotation range starts and ends in that file.
* Additional metadata about the position gathered from the parser, in case the parser is not available later.
