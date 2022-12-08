# Codetations :anchor:

:construction: **Under construction! You probably shouldn't use this library yet unless you are ready to hack on things.** :construction:

Codetations are *location anchors* for code that allow referencing a particular location even after the code has been changed. 
It is possible for these anchors to live separately from the code to avoid affecting the editing experience.

A live demo of this behavior is available [here](https://elmisback.github.io/codetations/).

**Useful for:** documentation, testing, code review and discussion, debugging.

This repository includes
* a description of annotation storage format(s)
* a server for interacting with the stored annotations intended for editor plugins and visualization clients
* a program for automatically updating stored annotation positions using diffs and anchor information 
if the code was edited without a connection to the annotation server

## Connected projects
* [Viviquote](https://github.com/elmisback/viviquote), a client that executes quoted regions. Includes a VSCode extension.

## Related work
* Rástočný and Bieliková 2015, *Metadata Anchoring for Source Code: Robust Location Descriptor Definition, Building and Interpreting*
* Juhár 2019, *Supporting Source Code Annotations with Metadata-Aware Development Environment*
