# 🪄⚓ Magic Markup

* Observable demo (needs an update): https://observablehq.com/@elmisback/re-annotate-v0
* Retagging function: https://observablehq.com/@elmisback/magic-markup-retag
* Benchmark generation tools: https://observablehq.com/@elmisback/tcu-benchmark-generator
* Tagged Code Updates benchmark: https://observablehq.com/@elmisback/tagged-code-updates-benchmark
* Evaluation results: https://observablehq.com/@elmisback/magic-markup-eval

# IN PROGRESS -- System Design and Applications (How will this work in practice?)

The system models document interactions with a websocket-based **document server** that enables clients to access and receive document texts and updates.

Tags are managed separately from the document itself, stored in a JSON **state** file where each tag is associated with metadata and (for now) the full document text at the time of tagging.
This ensures independence between tags and avoids losing version information.

The JSON file is managed by a **state server**, similar in function to the document server.

**Tag editors** are tools (probably in the editor UI, but can be independent/CLI) that talk with the state server to create tags.

**Annotation viewers** are UIs that display the state and let the user edit metadata.

The **tag update function** is a stateless function that takes an old tagged document and an updated untagged document, and re-applies tags in parallel to obtain an updated tagged document.

* Tag update function (exists at https://observablehq.com/@elmisback/magic-markup-retag, should be hosted somewhere)
* Document server (untested, exists in some state at https://github.com/elmisback/magic-markup/blob/main/codetations-react/document-server.ts)
* Tag state + State server (untested, exists in some state at https://github.com/elmisback/magic-markup/blob/main/codetations-react/state-server.ts)
* Tag editor: tools for adding tags to the document (space for an example is https://github.com/elmisback/magic-markup/tree/main/annotator)
* Annotation viewer: tools for viewing sets of tags (wizard of oz example is https://github.com/elmisback/magic-markup/blob/main/codetations-react/src/App.tsx)

## TODO
* **Find collaborators?**
  * Andres Erbsen: mentioned tying proofs to code is currently a pain point--for example, mapping https://github.com/PrincetonUniversity/VST/blob/0c4670d01127d5f6eb13a86df4500d025437bb21/progs64/verif_append2.v#L88C7-L88C18 to part of a C program like https://github.com/PrincetonUniversity/VST/blob/0c4670d01127d5f6eb13a86df4500d025437bb21/progs64/append.c#L12 (idk if that's actually the right part, we'd need a domain expert for this)
    * we could also look for other proofs people if Andres is busy, seems like this might be a general issue
* Work on infrastructure and basic applications above
* Look for more advanced applications

## Related research
* Rástočný and Bieliková 2015, *Metadata Anchoring for Source Code: Robust Location Descriptor Definition, Building and Interpreting*
* Juhár 2019, *Supporting Source Code Annotations with Metadata-Aware Development Environment*
* Walenstein, Andrew, et al. 2007. "Similarity in programs."
* Basman, Lewis, and Clark 2018. *The Open Authorial Principle: Supporting Networks of Authors in Creating Externalisable Designs* (section 6)
* A.J. Bernheim Brush and David Bargeron 2001. *Robustly Anchoring Annotations Using Keywords*
* Horvath et al. 2022. *Using Annotations for Sensemaking About Code* (catseye)
* Horvath et al. 2023. *Support for Long-Form Documentation Authoring and Maintenance* (sodalite)
* Horvath et al. 2024. *Meta-Manager: A Tool for Collecting and Exploring Meta Information about Code*
* Berners-Lee, Tim, James Hendler, and Ora Lassila. "The semantic web." Scientific american 284.5 (2001): 34-43.
* Fischer, Michael J., and Richard E. Ladner. "Data Structures for Efficient Implementation of Sticky Pointers in Text Editors." *Department of Computer Science University of Washington Seattle, Washington 98195 Technical Report 79-06-08.* (1979).
* Reiss, Steven P. *Tracking Source Locations* (2008, best method was recently used in Sodalite)
