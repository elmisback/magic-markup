# Goals
* `codetations` is designed for **source code** annotation, but may extend to other cases.
* Initial work is focused on **range annotations representing conceptually complete *expressions*** (expressions may be incorrect).
* When convenient, plugin hooks will be offered for handling other cases.
* Handle online updates when running with IDE support.
* Handle offline updates through language model guessing when running without IDE support.
* Probably a system for double-checking guesses until reliability is guaranteed.
* Annotations should not interfere with reading in a text-based editor or running code.
* Annotations should be editor-agnostic and should not break (too much) if someone who doesn't care about them works with the code.

## What should be stored for an annotation
TODO

OLD below
* The last version of the file being annotated that codetations knows about.
* Two (row, column) pairs indicating where the annotation range starts and ends in that file.
* Additional metadata about the position gathered from the parser, in case the parser is not available later.
