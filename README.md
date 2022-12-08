# :anchor: Codetations 

:construction: **Under construction! You probably shouldn't use this library yet unless you are ready to hack on things.** :construction:

Codetations are *location anchors* for code that allow referencing a particular location even after the code has been changed. 
It is possible for these anchors to live separately from the code to avoid affecting the editing experience.

A live demo of this behavior is available [here](https://elmisback.github.io/codetations/).



This repository includes
* a server for interacting with the stored annotations intended for editor plugins and visualization clients
* a program for automatically updating stored annotation positions using diffs and anchor information 
if the code was edited without a connection to the annotation server
* a description of the annotation storage format(s) used by codetations

## Strategy
Keeping track of positions as code changes and moves between contributors is not an easy problem. Codetations aims to provide a robust solution to this problem using the following methods:
* a server for editor clients to update annotation positions during editing
* loose language-aware parsing for resolving positions as expression delimiters
* a plain-text fallback implemented with text diffing + string similarity, in case the parser fails or is unavailable for a language

For more information, see the project [goals](https://github.com/elmisback/codetations/blob/main/goals.md).

## Connected projects
* [Viviquote](https://github.com/elmisback/viviquote), a client that executes quoted regions. Includes a VSCode extension.

## Related research
* Rástočný and Bieliková 2015, *Metadata Anchoring for Source Code: Robust Location Descriptor Definition, Building and Interpreting*
* Juhár 2019, *Supporting Source Code Annotations with Metadata-Aware Development Environment*
